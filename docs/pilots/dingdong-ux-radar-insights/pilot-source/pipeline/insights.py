"""洞察池：把「看板上的一个数字」变成「一条可以认领、流转、回看的事」。

这是后台的地基。看板回答"发生了什么"，追踪层回答"在变好还是变坏"，
洞察池回答第三个问题：**这条反馈现在归谁管、走到哪一步了。**

三层结构：
  items           帖子与评论拉平成统一的"洞察条目"
  insight_state   条目上的工作状态（负责人 / 状态 / 星标 / 忽略）——懒创建，没有行 = 未认领
  insight_event   每一次操作都留痕（谁在什么时候把什么改成了什么）

设计要点：
  1. 口径继承。（taxonomy_version）与人工标签规则与 report/metrics 完全一致，
     不另起一套，否则同一个数字在三个页面上会有三个值。
  2. 忽略（muted）的条目默认不出现在列表和统计里，但不删除 —— 误判要能撤回。
  3. 所有写操作都写事件。内部工具不需要复杂审计，但需要能回答"谁改的"。
  4. 纯标准库实现，不引 ORM —— 这一层的价值在筛选语义，不在抽象。
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Any

from . import db

# 允许筛选的标签轴。写死白名单，因为这个值会拼进 SQL 的列名位置。
AXES = ("experience", "category", "sentiment", "severity", "persona")

# 允许排序的键 → SQL 片段。同样是为了不把用户输入拼进 ORDER BY。
SORTS = {
    "time_desc": "i.ts DESC",
    "time_asc": "i.ts ASC",
    "likes": "i.like_count DESC, i.ts DESC",
    "sev": "(sev IS NULL), sev ASC, i.ts DESC",
}

# 「已经变成有 owner 的工单」的状态集合：待评估不算，不处理不算。
IN_PROGRESS = ("st.backlog", "st.scheduled", "st.fixed")

# 2026-09-22 起没有「已回帖」（st.replied）：它并入「已修复」，老库由 db.migrate 迁。
STATUS_LABELS = {
    "st.todo": "待评估", "st.backlog": "已建需求", "st.scheduled": "排期中",
    "st.fixed": "已修复", "st.wontfix": "不处理",
}

PAGE_SIZE_DEFAULT = 50
PAGE_SIZE_MAX = 500

# 帖子与评论拉平成同一种行。所有查询都建立在这张 items 上。
_ITEMS_CTE = """
WITH items AS (
  SELECT 'post' AS item_type, p.post_id AS item_id, p.post_id AS post_id,
         COALESCE(p.title, '') AS title,
         TRIM(COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')) AS text,
         COALESCE(p.publish_ts, 0) AS ts,
         COALESCE(p.like_count, 0) AS like_count,
         COALESCE(p.url, '') AS url,
         COALESCE(p.source, '') AS source,
         COALESCE(p.hit_keyword, '') AS keyword
    FROM post p
  UNION ALL
  SELECT 'comment', c.comment_id, c.post_id, '',
         COALESCE(c.content, ''),
         COALESCE(c.publish_ts, p.publish_ts, 0),
         COALESCE(c.like_count, 0),
         COALESCE(p.url, ''), '', ''
    FROM comment c
    LEFT JOIN post p ON p.post_id = c.post_id
)
"""


# ---------- 筛选条件 ----------

def normalize_filters(raw: dict | None) -> dict:
    """把 URL query / JSON 里的原始参数收敛成规范形状，顺手干掉空值。"""
    raw = raw or {}
    out: dict[str, Any] = {}

    # 标签轴：接受 "experience=exp.home,exp.search"、列表、或单个值
    for axis in AXES:
        vals = _as_list(raw.get(axis))
        if vals:
            out[axis] = vals

    # 严重度额外支持 none（未识别）——第一版踩过"未识别被灌成 P2"的坑
    sev_none = str(raw.get("severity_none", "")).lower() in ("1", "true", "yes")
    if sev_none:
        out["severity_none"] = True

    if raw.get("q"):
        out["q"] = str(raw["q"]).strip()
    if raw.get("keyword"):
        out["keyword"] = _as_list(raw["keyword"])
    if raw.get("source"):
        out["source"] = _as_list(raw["source"])
    if raw.get("item_type") in ("post", "comment"):
        out["item_type"] = raw["item_type"]

    if raw.get("owner"):
        out["owner"] = _as_list(raw["owner"])  # 特殊值 "__none__" = 未认领
    if raw.get("status"):
        out["status"] = _as_list(raw["status"])  # "__none__" = 还没建过状态行

    if raw.get("tracker"):
        out["tracker"] = str(raw["tracker"])
    if raw.get("view"):
        out["view"] = str(raw["view"])

    for key in ("days", "from_ts", "to_ts", "likes_min"):
        if raw.get(key) not in (None, ""):
            try:
                out[key] = int(raw[key])
            except (TypeError, ValueError):
                pass

    for key in ("starred", "include_muted", "only_open", "me"):
        if str(raw.get(key, "")).lower() in ("1", "true", "yes"):
            out[key] = True

    if raw.get("sort") in SORTS:
        out["sort"] = raw["sort"]

    return out


def _as_list(value) -> list[str]:
    if value in (None, "", []):
        return []
    if isinstance(value, (list, tuple)):
        return [str(v).strip() for v in value if str(v).strip()]
    return [p.strip() for p in str(value).split(",") if p.strip()]


def resolve_me(filters: dict, actor: str = "") -> dict:
    """把 me=True 这个占位符换成真实操作人。

    视图是共享资产，「我负责且未闭环」必须对每个人显示不同的结果。
    所以保存视图时不能把名字写死，只能存一个占位符，到调用边界再落地。
    """
    if not filters.get("me"):
        return filters
    out = dict(filters)
    out.pop("me", None)
    me = (actor or "").strip()
    if me:
        owners = [o for o in (out.get("owner") or []) if o != "__none__"]
        if me not in owners:
            owners.append(me)
        out["owner"] = owners
    return out


# ---------- SQL 构造 ----------

def _tag_clause(axis: str, values: list[str], version: str, negate: bool = False):
    """条目在某个轴上命中任一给定值。人工标签不受版本过滤，和 report 保持一致。

    注意 version 必须作为**真实参数**传进来：曾经这里返回过占位符字符串忘了替换，
    结果所有按标签的筛选都静默返回 0 条 —— 不报错，只是永远查不到东西。
    """
    ph = ",".join("?" * len(values))
    inner = (
        f"SELECT 1 FROM tag t WHERE t.item_type = i.item_type AND t.item_id = i.item_id "
        f"AND t.axis = ? AND t.value IN ({ph}) AND (t.taxonomy_version = ? OR t.method = 'manual')"
    )
    head = "NOT EXISTS" if negate else "EXISTS"
    return f"{head} ({inner})", [axis, *values, version]


def load_trackers() -> list[dict]:
    """追踪项定义（config/trackers.json）里页面要用的那几个字段。

    从配置读、不从库里读：追踪项是**定义**，不是数据。库里只有 followup（跟进状态）
    和 tracker_metric（周四算一次的快照）；定义改了就该立刻生效，不该等下一轮算分。

    配置坏了就让它报错。这里**不做 try/except 兜底** —— 兜底的结果是洞察池里
    那一排追踪项悄无声息地消失，而"筛选器里少了一排"不会有人当成故障上报。
    """
    from . import metrics

    out = []
    for trk in metrics.load_config().get("trackers", []):
        if not trk.get("id"):
            continue
        out.append({
            "id": trk["id"],
            # 名字缺失时退回 id：宁可在页面上看到 trk.xxx，也不要看到一栏空白。
            "name": trk.get("name") or trk["id"],
            "owner": trk.get("owner") or "",
            "desc": trk.get("desc") or "",
        })
    return out


def _tracker_clause(conn, tracker_id: str, version: str):
    """命中某个追踪项：复用 trackers.json 的 filter/match 语义，不另写一套。"""
    from . import metrics

    config = metrics.load_config()
    trk = next((t for t in config["trackers"] if t["id"] == tracker_id), None)
    if not trk:
        # 把可选值一起吐出来。校验清单（config/trackers.json）和调用点永远会漂移，
        # 报"未知追踪项"而不说有哪些，等于让调用方去翻文件 —— 而它多半在看终端。
        ids = "、".join(t.get("id", "?") for t in config.get("trackers", []))
        raise ValueError(f"未知追踪项 {tracker_id}（可选：{ids or '配置里一个都没有'}）")

    filt = trk.get("filter", {})
    mode = trk.get("match", "all")
    parts, params = [], []
    for axis, values in filt.items():
        sql, ps = _tag_clause(axis, list(values), version)
        parts.append(f"({sql})")
        params += ps
    if not parts:
        # 没写 filter 的追踪项 = 谁都不命中。必须显式给一个永假子句：
        # 拼出来的 "()" 是 SQL 语法错误，而"命中全部"更糟 ——
        # 那会把一个配置疏漏变成一批凭空出现的 P0。
        # metrics.item_matches 对空 filter 也是返回 False，两边保持一致。
        return "0", []
    joiner = " AND " if mode == "all" else " OR "
    return "(" + joiner.join(parts) + ")", params


def build_where(conn, filters: dict, version: str, exclude_axis: str | None = None):
    """把规范化的筛选条件翻成 WHERE 子句。返回 (sql, params)。

    `exclude_axis` 只给 facets 用：算某一轴的计数时要先把该轴自己的条件摘掉，
    否则一勾上某个值，同轴的其他值全变成 0，筛选器就没法用了。
    除了 AXES 里的标签轴，它还接受一个伪轴名 `"tracker"` —— 追踪项不是标签轴
    （它不写进 tag 表，而是一组标签条件的组合），但"排除自身条件"这条规矩是一样的。
    """
    clauses, params = [], []

    # 严重度那一轴特殊：「未识别」（没有严重度标签）和具体等级同时选时是 OR ——
    # 严重度列头的菜单里它就是一个普通选项，勾 P1 再勾未识别，人的意思是"这两类都要"。
    none_sql = ("NOT EXISTS (SELECT 1 FROM tag t WHERE t.item_type = i.item_type "
                "AND t.item_id = i.item_id AND t.axis = 'severity' "
                "AND (t.taxonomy_version = ? OR t.method = 'manual'))")
    for axis in AXES:
        if axis == exclude_axis:
            continue
        if filters.get(axis):
            sql, ps = _tag_clause(axis, filters[axis], version)
            if axis == "severity" and filters.get("severity_none"):
                sql = f"({sql} OR {none_sql})"
                ps = ps + [version]
            clauses.append(sql)
            params += ps

    if filters.get("severity_none") and exclude_axis != "severity" and not filters.get("severity"):
        clauses.append(none_sql)
        params.append(version)

    if filters.get("q"):
        clauses.append("i.text LIKE ?")
        params.append(f"%{filters['q']}%")

    for col, key in (("i.keyword", "keyword"), ("i.source", "source"), ("i.item_type", "item_type")):
        values = filters.get(key)
        if not values:
            continue
        if key == "item_type":
            if exclude_axis == "item_type":   # 类型列头菜单的计数：摘掉自己
                continue
            clauses.append(f"{col} = ?")
            params.append(values if isinstance(values, str) else values[0])
        else:
            clauses.append(f"{col} IN ({','.join('?' * len(values))})")
            params += values

    if filters.get("days"):
        since = int((datetime.now() - timedelta(days=filters["days"])).timestamp())
        clauses.append("i.ts >= ?")
        params.append(since)
    if filters.get("from_ts"):
        clauses.append("i.ts >= ?")
        params.append(filters["from_ts"])
    if filters.get("to_ts"):
        clauses.append("i.ts < ?")
        params.append(filters["to_ts"])
    if filters.get("likes_min"):
        clauses.append("i.like_count >= ?")
        params.append(filters["likes_min"])

    owners = filters.get("owner")
    if owners:
        want_none = "__none__" in owners
        named = [o for o in owners if o != "__none__"]
        parts = []
        if named:
            parts.append(f"s.owner IN ({','.join('?' * len(named))})")
            params += named
        if want_none:
            parts.append("(s.owner IS NULL OR s.owner = '')")
        clauses.append("(" + " OR ".join(parts) + ")")

    statuses = filters.get("status")
    if statuses:
        want_none = "__none__" in statuses
        named = [s for s in statuses if s != "__none__"]
        parts = []
        if named:
            parts.append(f"s.status_id IN ({','.join('?' * len(named))})")
            params += named
        if want_none:
            parts.append("s.status_id IS NULL")
        clauses.append("(" + " OR ".join(parts) + ")")

    if filters.get("only_open"):
        clauses.append("(s.status_id IS NULL OR s.status_id NOT IN ('st.fixed', 'st.wontfix'))")

    if filters.get("starred"):
        clauses.append("COALESCE(s.starred, 0) = 1")
    if not filters.get("include_muted"):
        clauses.append("COALESCE(s.muted, 0) = 0")

    if filters.get("tracker") and exclude_axis != "tracker":
        sql, ps = _tracker_clause(conn, filters["tracker"], version)
        clauses.append(sql)
        params += ps

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def _resolve(conn, filters: dict) -> dict:
    """展开保存的视图：视图 = 一组筛选条件 + 一个名字。"""
    out = dict(filters)
    view_id = out.pop("view", None)
    if view_id:
        saved = get_view(conn, view_id)
        if saved:
            q = saved["query"]
            merged = normalize_filters(q if isinstance(q, dict) else json.loads(q or "{}"))
            merged.update({k: v for k, v in out.items() if k not in ("sort",)})
            out = merged
    return out


# ---------- 查询 ----------

_SEV_SUBQUERY = (
    "(SELECT t.value FROM tag t WHERE t.item_type = i.item_type AND t.item_id = i.item_id "
    "AND t.axis = 'severity' AND (t.taxonomy_version = ? OR t.method = 'manual') "
    "ORDER BY t.confidence DESC, t.id ASC LIMIT 1)"
)


def _row_to_dict(row: sqlite3.Row, truncate: int | None = 140) -> dict:
    text = row["text"] or ""
    out = {
        "insight_id": row["insight_id"],
        "item_type": row["item_type"],
        "item_id": row["item_id"],
        "post_id": row["post_id"],
        "title": row["title"],
        "text": (text[:truncate] + "…") if truncate and len(text) > truncate else text,
        "ts": row["ts"],
        "time": datetime.fromtimestamp(row["ts"]).strftime("%Y-%m-%d %H:%M") if row["ts"] else "",
        "like_count": row["like_count"],
        "url": row["url"],
        "source": row["source"],
        "keyword": row["keyword"],
        "severity": row["sev"],
        "owner": row["owner"],
        "status_id": row["status_id"],
        "status": STATUS_LABELS.get(row["status_id"] or "", "待评估"),
        "starred": bool(row["starred"]),
        "muted": bool(row["muted"]),
        "has_state": bool(row["status_id"] or row["owner"]),
    }
    return out


def list_insights(conn, raw_filters: dict | None = None, version: str | None = None,
                  page: int = 1, page_size: int = PAGE_SIZE_DEFAULT,
                  truncate: int | None = 140, actor: str = "") -> dict:
    """洞察池主查询。返回 total / page / items，total 是**筛选后**的总数，用于分页。"""
    filters = resolve_me(_resolve(conn, normalize_filters(raw_filters)), actor)
    ver = version or db.resolve_version(conn)
    where, params = build_where(conn, filters, ver)

    page = max(1, int(page or 1))
    page_size = max(1, min(PAGE_SIZE_MAX, int(page_size or PAGE_SIZE_DEFAULT)))
    order = SORTS.get(filters.get("sort", "time_desc"), SORTS["time_desc"])

    total = conn.execute(
        f"{_ITEMS_CTE} SELECT COUNT(*) FROM items i "
        f"LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id{where}",
        params,
    ).fetchone()[0]

    rows = conn.execute(
        f"""{_ITEMS_CTE}
        SELECT i.*, i.item_type || ':' || i.item_id AS insight_id,
               {_SEV_SUBQUERY} AS sev,
               s.owner, s.status_id, s.starred, s.muted
          FROM items i
          LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id
          {where}
         ORDER BY {order}
         LIMIT ? OFFSET ?""",
        [ver, *params, page_size, (page - 1) * page_size],
    ).fetchall()

    items = [_row_to_dict(r, truncate) for r in rows]
    _attach_tags(conn, items, ver)
    _attach_trackers(items)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "taxonomy_version": ver,
        "filters": filters,
        "items": items,
    }


def _attach_tags(conn, items: list[dict], ver: str) -> None:
    """给当前这一页的条目补上标签。一次查完，不要在循环里查（N+1）。"""
    if not items:
        return
    keys = [(i["item_type"], i["item_id"]) for i in items]
    marks = ",".join("(?, ?)" for _ in keys)
    params: list = []
    for it, iid in zip(items, keys):
        params += list(iid)
    params.append(ver)
    rows = conn.execute(
        f"""SELECT item_type, item_id, axis, value FROM tag
             WHERE (item_type, item_id) IN ({marks})
               AND (taxonomy_version = ? OR method = 'manual')
             ORDER BY CASE WHEN method = 'manual' THEN 0 ELSE 1 END, confidence DESC""",
        params,
    ).fetchall()
    by_key: dict[tuple[str, str], dict[str, list[str]]] = {}
    for r in rows:
        by_key.setdefault((r["item_type"], r["item_id"]), {}).setdefault(r["axis"], []).append(r["value"])
    for it in items:
        it["tags"] = by_key.get((it["item_type"], it["item_id"]), {})


def _attach_trackers(items: list[dict]) -> None:
    """给条目补上「命中了哪些追踪项」。**纯内存计算，一次库都不查。**

    判定用的是 `metrics.item_matches` —— 追踪中心那根线就是它算的。
    这里再写一份「命中判定」等于开了第二把尺子：同一条内容在洞察池里算命中、
    在追踪中心里不算，两边都不报错，只是数字对不上，而那种对不上最难查。
    标签已经由 _attach_tags 一次取回来了，所以这一趟没有额外成本。

    为什么要显示这个：条目级的负责人是人、主题级的负责人是团队，而**追踪项是
    团队与内容的唯一连接**。一条 P0 旁边写着「履约时效与超时」，就同时回答了
    "这条该给谁看"和"它会不会让那根线抬头"。
    """
    if not items:
        return
    from . import metrics

    cfgs = metrics.load_config().get("trackers", [])
    for it in items:
        if not cfgs:
            it["trackers"] = []
            continue
        # item_matches 读的是 `sev`（report.load_items 的形状），这里把已经是
        # 高置信度那一条的 severity 映射过去，免得为了让两个模块对齐而去改 metrics。
        probe = {**it, "sev": it.get("severity")}
        it["trackers"] = [
            {"id": t["id"], "name": t.get("name") or t["id"], "owner": t.get("owner") or ""}
            for t in cfgs if metrics.item_matches(probe, t)
        ]


def _tracker_names(it: dict) -> str:
    """CSV 里要的是一个字符串，不是嵌套结构。"""
    return " / ".join(t["name"] for t in it.get("trackers", []))


def facets(conn, raw_filters: dict | None = None, version: str | None = None,
           actor: str = "") -> dict:
    """各个维度的可选值与计数，供筛选器渲染。

    每个轴的计数用「去掉该轴自身条件」后的结果算 —— 否则一勾上某个类目，
    其他类目就全变成 0，筛选器直接没法用。
    """
    filters = resolve_me(_resolve(conn, normalize_filters(raw_filters)), actor)
    ver = version or db.resolve_version(conn)

    out: dict[str, Any] = {"taxonomy_version": ver, "axes": {}, "owners": [], "statuses": []}

    for axis in ("experience", "category", "sentiment", "severity", "persona"):
        where, params = build_where(conn, filters, ver, exclude_axis=axis)
        # 这里只能剥掉最外层那一个 WHERE，不能对整条字符串做 replace(' WHERE ', ' AND ')：
        # 标签条件里的 EXISTS (SELECT 1 FROM tag t WHERE ...) 和 severity_none 的
        # NOT EXISTS 子查询里也各有一个 WHERE，一起被换掉就变成 SQL 语法错误。
        # 症状很隐蔽——只在带了标签类筛选时才炸。
        body = where[len(" WHERE "):] if where.startswith(" WHERE ") else where
        extra = (" AND " + body) if body else ""
        rows = conn.execute(
            f"""{_ITEMS_CTE}
            SELECT t.value, COUNT(DISTINCT i.item_type || ':' || i.item_id) AS n
              FROM items i
              LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id
              JOIN tag t ON t.item_type = i.item_type AND t.item_id = i.item_id
             WHERE t.axis = ? AND (t.taxonomy_version = ? OR t.method = 'manual'){extra}
             GROUP BY t.value ORDER BY n DESC""",
            [axis, ver, *params],
        ).fetchall()
        out["axes"][axis] = [{"value": r["value"], "count": r["n"]} for r in rows]
        if axis == "severity":
            # 「未识别」= 没有严重度标签的条数，同样摘掉本轴条件算。列头菜单里它是普通一项。
            n = conn.execute(
                f"""{_ITEMS_CTE}
                SELECT COUNT(*) AS n FROM items i
                  LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id
                 WHERE NOT EXISTS (SELECT 1 FROM tag t WHERE t.item_type = i.item_type
                                     AND t.item_id = i.item_id AND t.axis = 'severity'
                                     AND (t.taxonomy_version = ? OR t.method = 'manual')){extra}""",
                [ver, *params],
            ).fetchone()["n"]
            out["axes"][axis].append({"value": "__none__", "count": n})

    where, params = build_where(conn, filters, ver)
    out["owners"] = [
        {"value": r["owner"], "count": r["n"]}
        for r in conn.execute(
            f"""{_ITEMS_CTE}
            SELECT s.owner, COUNT(*) AS n FROM items i
              JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id{where}
             GROUP BY s.owner ORDER BY n DESC""",
            params,
        )
    ]
    out["statuses"] = [
        {"value": r["status_id"], "count": r["n"]}
        for r in conn.execute(
            f"""{_ITEMS_CTE}
            SELECT s.status_id, COUNT(*) AS n FROM items i
              JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id{where}
             GROUP BY s.status_id ORDER BY n DESC""",
            params,
        )
    ]

    # 追踪项。和标签轴同一条规矩：**计数要去掉追踪项自身的条件再算**。
    # 不这么做的话，勾上「履约时效与超时」的那一瞬间，其余九个追踪项全变成 0 ——
    # 这一排就从"看哪个追踪项最近在冒头"退化成一个单选按钮，
    # 而且它看起来完全正常（数字都在，只是都是 0）。
    #
    # 十个追踪项 = 十条计数 SQL。这里刻意不合成一条大 SQL：数据量是几百条，
    # 合成之后每条 filter 会被内联进 CASE WHEN 展开十遍，改一个追踪项要动整条语句，
    # 而这个函数的全部价值就在于"计数规则和单筛结果一模一样" —— 可读比省几条查询重要。
    trk_base_where, trk_base_params = build_where(conn, filters, ver, exclude_axis="tracker")
    trk_base = (trk_base_where[len(" WHERE "):]
                if trk_base_where.startswith(" WHERE ") else trk_base_where)
    # 类型（笔记 / 评论）：给类型列头的菜单用，同样摘掉自己的条件。
    where_t, params_t = build_where(conn, filters, ver, exclude_axis="item_type")
    out["item_types"] = [
        {"value": r["item_type"], "count": r["n"]}
        for r in conn.execute(
            f"""{_ITEMS_CTE}
            SELECT i.item_type, COUNT(*) AS n FROM items i
              LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id{where_t}
             GROUP BY i.item_type""",
            params_t,
        )
    ]

    out["trackers"] = []
    for trk in load_trackers():
        clause, cparams = _tracker_clause(conn, trk["id"], ver)
        where = " WHERE " + " AND ".join(x for x in (trk_base, clause) if x)
        out["trackers"].append({
            "value": trk["id"],
            "label": trk["name"],
            "owner": trk["owner"],
            "count": conn.execute(
                f"""{_ITEMS_CTE}
                SELECT COUNT(*) FROM items i
                  LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id{where}""",
                [*trk_base_params, *cparams],
            ).fetchone()[0],
        })
    return out


def get_insight(conn, insight_id: str, version: str | None = None) -> dict | None:
    """单条详情：原文 + 上下文 + 标签 + 相似条目 + 操作日志。"""
    if ":" not in insight_id:
        return None
    item_type, item_id = insight_id.split(":", 1)
    if item_type not in ("post", "comment"):
        return None
    ver = version or db.resolve_version(conn)

    row = conn.execute(
        f"""{_ITEMS_CTE}
        SELECT i.*, i.item_type || ':' || i.item_id AS insight_id,
               {_SEV_SUBQUERY} AS sev,
               s.owner, s.status_id, s.starred, s.muted, s.note, s.updated_at, s.updated_by
          FROM items i
          LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id
         WHERE i.item_type = ? AND i.item_id = ?""",
        [ver, item_type, item_id],
    ).fetchone()
    if not row:
        return None

    detail = _row_to_dict(row, truncate=None)
    detail["note"] = row["note"]
    detail["updated_at"] = row["updated_at"]
    detail["updated_by"] = row["updated_by"]

    tags: dict[str, list[str]] = {}
    manual: dict[str, list[str]] = {}
    for r in conn.execute(
        """SELECT axis, value, method FROM tag WHERE item_type = ? AND item_id = ?
             AND (taxonomy_version = ? OR method = 'manual')
            ORDER BY axis, CASE WHEN method = 'manual' THEN 0 ELSE 1 END, confidence DESC""",
        (item_type, item_id, ver),
    ):
        tags.setdefault(r["axis"], []).append(r["value"])
        if r["method"] == "manual":
            manual.setdefault(r["axis"], []).append(r["value"])
    detail["tags"] = tags
    detail["manual_tags"] = manual
    _attach_trackers([detail])

    if item_type == "comment":
        host = conn.execute(
            "SELECT post_id, title, url, publish_ts FROM post WHERE post_id = ?",
            (row["post_id"],),
        ).fetchone()
        siblings = conn.execute(
            "SELECT comment_id, content, publish_ts, like_count FROM comment "
            "WHERE post_id = ? AND comment_id != ? ORDER BY like_count DESC LIMIT 5",
            (row["post_id"], item_id),
        ).fetchall()
        detail["context"] = {
            "post": dict(host) if host else None,
            "siblings": [dict(s) for s in siblings],
        }
    else:
        detail["context"] = {"post": None, "siblings": []}

    detail["similar"] = _similar(conn, item_type, item_id, ver)
    detail["events"] = list_events(conn, insight_id)
    return detail


def _similar(conn, item_type: str, item_id: str, ver: str, limit: int = 8) -> list[dict]:
    """同类痛点聚集度：与本条共享 ≥2 个体验域/品类线标签的**其他笔记**。

    按 post_id 聚合，不按条目聚合 —— 否则同一篇爆文下的十几条评论会刷满整屏，
    看起来像"普遍现象"，其实是"一条爆文带节奏"。这个坑在追踪层已经踩过一次
    （所以那里有 unique_posts 这个指标），这里沿用同一个判断。
    """
    rows = conn.execute(
        f"""{_ITEMS_CTE},
        mine AS (
          SELECT axis, value FROM tag WHERE item_type = ? AND item_id = ?
            AND axis IN ('experience', 'category') AND (taxonomy_version = ? OR method = 'manual')
        )
        SELECT i.post_id, MAX(i.ts) AS ts, COUNT(*) AS items, COUNT(DISTINCT t.value) AS shared,
               MIN(substr(i.text, 1, 70)) AS text
          FROM items i
          JOIN tag t ON t.item_type = i.item_type AND t.item_id = i.item_id
         WHERE t.axis IN ('experience', 'category')
           AND (t.taxonomy_version = ? OR t.method = 'manual')
           AND (t.axis, t.value) IN (SELECT axis, value FROM mine)
           AND i.post_id != ?
         GROUP BY i.post_id
        HAVING COUNT(DISTINCT t.value) >= 2
         ORDER BY shared DESC, items DESC, ts DESC
         LIMIT ?""",
        (item_type, item_id, ver, ver, _post_of(conn, item_type, item_id), limit),
    ).fetchall()
    return [{"post_id": r["post_id"], "ts": r["ts"], "text": r["text"],
             "items": r["items"], "shared": r["shared"]} for r in rows]


def _post_of(conn, item_type: str, item_id: str) -> str:
    table, key = ("post", "post_id") if item_type == "post" else ("comment", "comment_id")
    row = conn.execute(f"SELECT post_id FROM {table} WHERE {key} = ?", (item_id,)).fetchone()
    return row["post_id"] if row else ""


def list_events(conn, insight_id: str, limit: int = 30) -> list[dict]:
    rows = conn.execute(
        "SELECT action, from_value, to_value, actor, note, at FROM insight_event "
        "WHERE insight_id = ? ORDER BY id DESC LIMIT ?",
        (insight_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def export_csv(conn, raw_filters: dict | None = None, version: str | None = None,
               limit: int = 5000, actor: str = "") -> str:
    """导出当前筛选结果。CSV 是唯一不会被业务方拒绝的交付格式。

    一条一行（内容级明细）。要"拿去发给某个团队读"的原帖清单请用 `export_posts` ——
    两件事：这份回答"这批东西各自是什么"，那份回答"要打开哪几篇看"。
    """
    data = list_insights(conn, raw_filters, version, page=1, page_size=min(limit, PAGE_SIZE_MAX),
                         truncate=400, actor=actor)
    buf = io.StringIO()
    cols = ["insight_id", "time", "item_type", "severity", "owner", "status",
            "trackers", "like_count", "source", "keyword", "text", "url"]
    writer = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    writer.writeheader()
    for it in data["items"]:
        writer.writerow({**it, "trackers": _tracker_names(it)})
    return buf.getvalue()


# ---------- 原帖清单导出 ----------
#
# 和 export_csv 的分工，写在这里免得以后有人"顺手合并"：
#   export_csv   一条内容一行。回答"这批东西各自长什么样"，给做分类的人看。
#   export_posts 一篇笔记一行。回答"我要打开哪几篇"，给要接手的那位看。
# 合并成一个就必然丢掉其中一个用途 —— 而丢掉的通常是要接手的那位。

POST_COLS = ["post_id", "url", "title", "items", "p0", "severity",
             "owner", "status", "trackers", "like_count", "time", "text"]

# 严重度排序用的名次。只用来决定清单里谁排前面，不参与筛选。
_SEV_RANK = {"sev.p0": 0, "sev.p1": 1, "sev.p2": 2}


def _items_by_ids(conn, ids, ver: str) -> list[dict]:
    """按 insight_id 精确取条目。不分页、不排序、不截断 —— 导出要看全文。

    和 list_insights 共用同一张 CTE、同一个 _row_to_dict、同一个 _attach_tags：
    导出件和屏幕上必须来自同一套读数，否则"导出来少了 2 条"永远说不清。
    """
    wanted = list(dict.fromkeys(x.strip() for x in ids if x and x.strip()))
    if not wanted:
        return []
    marks = ",".join("?" * len(wanted))
    rows = conn.execute(
        f"""{_ITEMS_CTE}
        SELECT i.*, i.item_type || ':' || i.item_id AS insight_id,
               {_SEV_SUBQUERY} AS sev,
               s.owner, s.status_id, s.starred, s.muted
          FROM items i
          LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id
         WHERE i.item_type || ':' || i.item_id IN ({marks})""",
        [ver, *wanted],
    ).fetchall()
    items = [_row_to_dict(r, truncate=None) for r in rows]
    _attach_tags(conn, items, ver)
    _attach_trackers(items)
    return items


def _join_unique(values, sep: str = " / ", cap: int = 3) -> str:
    """去重保序拼接，超出的用 …+n 收尾。

    直接 join 会把 12 条不同负责人的条目写成一行 300 字的名单，
    而这一列的作用是"打开前就知道该找谁"，不是"把所有人都念一遍"。
    """
    seen, out = [], []
    for v in values:
        v = (v or "").strip()
        if v and v not in seen:
            seen.append(v)
            out.append(v)
    if len(out) > cap:
        return sep.join(out[:cap]) + f" …+{len(out) - cap}"
    return sep.join(out)


def export_posts(conn, item_ids=None, raw_filters=None, version: str | None = None,
                 limit: int = PAGE_SIZE_MAX, actor: str = "") -> dict:
    """把一批条目还原成「要读的原帖清单」。返回 csv + 报账字段。

    为什么不直接给 export_csv 那种一条一行：一篇爆文底下 20 条评论，
    一条一行就是 20 行**同一个链接**。团队拿到那份清单，看到的是"有 20 条要处理"，
    而实际上要读的东西只有 1 篇 —— 数量被评论数放大了，真正该读的被淹掉。
    所以这里按 post_id 归并，`items` 列才是条数，`p0` 列是有几条是 P0。

    两种入口（勾选的一批 / 筛选出来的一批）走同一条归并逻辑：
    先把条目取回来，再按 post_id 分组。两支各写一遍必然分叉，
    然后同一批内容在后台导出和在命令行导出会得到不一样的行数。
    """
    ver = version or db.resolve_version(conn)

    if item_ids is not None:
        asked = list(dict.fromkeys(x.strip() for x in item_ids if x and x.strip()))
        items = _items_by_ids(conn, asked, ver)
        found = {it["insight_id"] for it in items}
        # 勾中的东西已经不在了（别人清过库、或数据被重算换掉了 id）必须报出来。
        # 静默少一行是最坏的：那份清单看起来完整，收件人不会知道自己少看了两条。
        missing = [i for i in asked if i not in found]
    else:
        data = list_insights(conn, raw_filters, version=ver, page=1,
                             page_size=min(int(limit), PAGE_SIZE_MAX),
                             truncate=None, actor=actor)
        items = data["items"]
        missing = []

    groups: dict[str, dict] = {}
    for it in items:
        pid = it.get("post_id") or it["item_id"]
        g = groups.get(pid)
        if g is None:
            g = groups[pid] = {
                "post_id": pid, "items": 0, "p0": 0,
                "_sev": [], "_owners": [], "_status": [], "_trks": [], "_ts": 0,
            }
        g["items"] += 1
        if it.get("severity") == "sev.p0":
            g["p0"] += 1
        g["_sev"].append(it.get("severity") or "")
        g["_owners"].append(it.get("owner") or "")
        g["_status"].append(it.get("status") or "")
        g["_trks"] += [t["name"] for t in it.get("trackers", [])]
        g["_ts"] = max(g["_ts"], it.get("ts") or 0)

    # 笔记自身的标题 / 链接 / 正文 / 点赞数，一次性补上。
    # 勾了一批评论时这一步不能省：评论行的 title 是空的，url 也只是从宿主笔记那里
    # 借来的 —— 清单里那一行"标题"栏空着，人打开清单的第一反应是"这篇是哪篇"。
    if groups:
        pids = list(groups)
        marks = ",".join("?" * len(pids))
        for r in conn.execute(
            f"""SELECT post_id, title, content, url, publish_ts, like_count
                  FROM post WHERE post_id IN ({marks})""", pids):
            g = groups.get(r["post_id"])
            if g is None:
                continue
            g["url"] = r["url"] or ""
            g["title"] = r["title"] or ""
            g["text"] = " ".join(x for x in ((r["title"] or ""), (r["content"] or "")) if x)
            g["like_count"] = r["like_count"] or 0
            g["_ts"] = max(g["_ts"], r["publish_ts"] or 0)

    rows = []
    for g in groups.values():
        sev = sorted({s for s in g["_sev"] if s}, key=lambda s: _SEV_RANK.get(s, 9))
        rows.append({
            "post_id": g["post_id"],
            "url": g.get("url", ""),
            "title": g.get("title", ""),
            "items": g["items"],
            "p0": g["p0"],
            "severity": sev[0] if sev else "",
            "owner": _join_unique(g["_owners"]),
            "status": _join_unique(g["_status"]),
            "trackers": _join_unique(g["_trks"]),
            "like_count": g.get("like_count", 0),
            "time": (datetime.fromtimestamp(g["_ts"]).strftime("%Y-%m-%d %H:%M")
                     if g["_ts"] else ""),
            "text": (g.get("text") or "")[:200],
            "_ts": g["_ts"],          # 只用来排序，写 CSV 时被 extrasaction 忽略
        })

    # 谁排前面：有 P0 的先读，然后讨论集中的（条目多），然后赞多的。
    # 不按时间排 —— 这份清单是"今天该读哪几篇"，不是"这周发了什么"。
    rows.sort(key=lambda r: (r["p0"] <= 0, -r["p0"], -r["items"], -r["like_count"], -r["_ts"]))

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=POST_COLS, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow(r)

    return {
        "csv": buf.getvalue(),
        "posts": len(rows),
        "items": len(items),
        "comments": sum(1 for it in items if it["item_type"] == "comment"),
        "missing": missing,
        "no_url": sum(1 for r in rows if not r["url"]),
        "taxonomy_version": ver,
        "columns": POST_COLS,
    }


# ---------- 写操作 ----------

def _ensure_state(conn, insight_id: str, actor: str) -> None:
    conn.execute(
        """INSERT OR IGNORE INTO insight_state
             (insight_id, status_id, starred, muted, updated_at, updated_by)
           VALUES (?, 'st.todo', 0, 0, ?, ?)""",
        (insight_id, db.now_iso(), actor),
    )


def _log(conn, insight_id: str, action: str, from_value=None, to_value=None,
         actor: str = "cli", note: str = "") -> None:
    conn.execute(
        """INSERT INTO insight_event (insight_id, action, from_value, to_value, actor, note, at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (insight_id, action, _s(from_value), _s(to_value), actor, note, db.now_iso()),
    )


def _s(value) -> str | None:
    return None if value is None else str(value)


def _require(conn, insight_id: str) -> None:
    item_type, _, item_id = insight_id.partition(":")
    table = {"post": ("post", "post_id"), "comment": ("comment", "comment_id")}.get(item_type)
    if not table:
        raise ValueError(f"非法的 insight_id：{insight_id}（应为 post:<id> 或 comment:<id>）")
    hit = conn.execute(f"SELECT 1 FROM {table[0]} WHERE {table[1]} = ?", (item_id,)).fetchone()
    if not hit:
        raise ValueError(f"库里没有这条内容（不存在）：{insight_id}")


def claim(conn, insight_id: str, owner: str, actor: str = "cli", note: str = "") -> dict:
    """认领 / 分配 / 转交共用这一个入口（都是"改 owner"），靠 from/to/actor 推导语义：

    - 认领：to == actor（自己接手）；
    - 分配：to != actor 且 from 为空（把池里的条目推给别人）；
    - 转交：to != actor 且 from 有值（把我名下的条目换个人）。

    分配和转交是"别人被动接收"的动作，所以开放 `note` 让发起方附一句理由进活动日志
    —— 没有理由的转交就是甩锅通道（见设计文档 §3.5.4）。认领自己接手，note 可不填。
    """
    _require(conn, insight_id)
    _ensure_state(conn, insight_id, actor)
    old = conn.execute("SELECT owner FROM insight_state WHERE insight_id = ?", (insight_id,)).fetchone()
    conn.execute(
        "UPDATE insight_state SET owner = ?, updated_at = ?, updated_by = ? WHERE insight_id = ?",
        (owner, db.now_iso(), actor, insight_id),
    )
    _log(conn, insight_id, "claim", old["owner"] if old else None, owner, actor,
         (note or "").strip() or None)
    conn.commit()
    return {"insight_id": insight_id, "owner": owner, "was": old["owner"] if old else None}


def set_status(conn, insight_id: str, status_id: str, actor: str = "cli",
               note: str | None = None) -> dict:
    """改状态。`note=None` 表示「不动备注」，`note=""` 表示「明确清空」。

    这两个必须分开，理由是一个真实踩过的坑：原来的签名是 `note: str = ""`，
    于是「只改状态、不提备注」被当成「把备注清空」——
    从列表改一次状态，抽屉里写过的理由就没了，而且没有任何提示。
    这很讽刺：整套设计一直在强调「不处理的理由要留下」（见 ADMIN-IA §5.6），
    结果下一次点状态就把那个理由删了。列表页、抽屉下拉、CLI 三条路全中招。

    所以约定改成：**没提到备注，就不要动它。** 想清空就显式传空串。
    返回里带 `note_touched`，让调用方一眼看出这次到底动没动备注。
    """
    _require(conn, insight_id)
    if status_id not in STATUS_LABELS:
        raise ValueError(f"未知状态 {status_id}，可选：{'/'.join(STATUS_LABELS)}")
    _ensure_state(conn, insight_id, actor)
    old = conn.execute("SELECT status_id FROM insight_state WHERE insight_id = ?", (insight_id,)).fetchone()
    if note is None:
        conn.execute(
            "UPDATE insight_state SET status_id = ?, updated_at = ?, updated_by = ? WHERE insight_id = ?",
            (status_id, db.now_iso(), actor, insight_id),
        )
    else:
        conn.execute(
            "UPDATE insight_state SET status_id = ?, note = ?, updated_at = ?, updated_by = ? "
            "WHERE insight_id = ?",
            (status_id, note, db.now_iso(), actor, insight_id),
        )
    _log(conn, insight_id, "status", old["status_id"] if old else None, status_id, actor, note or "")
    conn.commit()
    return {"insight_id": insight_id, "status_id": status_id,
            "was": old["status_id"] if old else None,
            "note_touched": note is not None}


def set_note(conn, insight_id: str, note: str, actor: str = "cli") -> dict:
    _require(conn, insight_id)
    _ensure_state(conn, insight_id, actor)
    conn.execute(
        "UPDATE insight_state SET note = ?, updated_at = ?, updated_by = ? WHERE insight_id = ?",
        (note, db.now_iso(), actor, insight_id),
    )
    _log(conn, insight_id, "note", None, None, actor, note)
    conn.commit()
    return {"insight_id": insight_id, "note": note}


def set_flag(conn, insight_id: str, flag: str, value: bool, actor: str = "cli") -> dict:
    """starred / muted。忽略不是删除——误判要能一键撤回。"""
    _require(conn, insight_id)
    if flag not in ("starred", "muted"):
        raise ValueError("flag 只能是 starred 或 muted")
    _ensure_state(conn, insight_id, actor)
    old = conn.execute(f"SELECT {flag} FROM insight_state WHERE insight_id = ?", (insight_id,)).fetchone()
    conn.execute(
        f"UPDATE insight_state SET {flag} = ?, updated_at = ?, updated_by = ? WHERE insight_id = ?",
        (1 if value else 0, db.now_iso(), actor, insight_id),
    )
    _log(conn, insight_id, flag, old[flag] if old else 0, 1 if value else 0, actor)
    conn.commit()
    return {"insight_id": insight_id, flag: bool(value)}


def tag_manual(conn, insight_id: str, axis: str, value: str, op: str = "add",
               actor: str = "cli") -> dict:
    """人工标注。写入 method='manual'，按既定规则不受分类版本过滤。"""
    _require(conn, insight_id)
    if axis not in AXES:
        raise ValueError(f"axis 必须是 {'/'.join(AXES)} 之一")
    if op not in ("add", "remove"):
        raise ValueError("op 只能是 add 或 remove")
    item_type, _, item_id = insight_id.partition(":")

    if op == "add":
        # 只**追加**，不删规则标签。体验域天然是多值的：一条"闪退进了购物车"的反馈
        # 既属于性能稳定也属于购物车凑单。人加一个标签，不代表他否认另一个。
        conn.execute(
            """INSERT OR IGNORE INTO tag
                 (item_type, item_id, axis, value, confidence, method, taxonomy_version, created_at)
               VALUES (?, ?, ?, ?, 1.0, 'manual', ?, ?)""",
            (item_type, item_id, axis, value, db.taxonomy_version(), db.now_iso()),
        )
    else:
        # 删除**不论来源**：这是人的否决权。规则打错了就得能压掉，
        # 只删 manual 等于人只能改自己写的，规则给错标签时无能为力。
        conn.execute(
            "DELETE FROM tag WHERE item_type = ? AND item_id = ? AND axis = ? AND value = ?",
            (item_type, item_id, axis, value),
        )
    _log(conn, insight_id, "tag", axis, f"{op}:{value}", actor)
    conn.commit()
    return {"insight_id": insight_id, "axis": axis, "value": value, "op": op}


def set_severity(conn, insight_id: str, value: str, actor: str = "cli") -> dict:
    """在列表上点一下改严重度：**替换**，不是追加。

    严重度在所有页面都按单值显示（_SEV_SUBQUERY 取 LIMIT 1，列表的 chip 也只印
    第一个），所以不能借用 tag_manual 的 add —— 那是给体验域那种多值轴用的。
    而且只追加会踩一个不报错的坑：规则标签的 confidence 能打到 1.0，
    和人工标签打平后靠更小的 id 赢回显示位，界面就成了
    "点了 P1、徽章还是 P0" —— 比没有这个按钮更糟。

    所以这里是"先删后加"：删不分来源（同 tag_manual 的 remove，人的否决权），
    再写一个人工的。value 传空串 = 改回「未识别」，只删不加。
    """
    _require(conn, insight_id)
    value = str(value or "").strip()
    if value and not value.startswith("sev."):
        raise ValueError(f"严重度的值应为 sev.* 或空串（空串 = 未识别），收到 {value!r}")
    item_type, _, item_id = insight_id.partition(":")

    # 校验通过才动数据：先删后写不是事务原子操作，宁可让非法值在删除前就报出来。
    old = [r["value"] for r in conn.execute(
        "SELECT value FROM tag WHERE item_type = ? AND item_id = ? AND axis = 'severity'",
        (item_type, item_id),
    )]
    conn.execute(
        "DELETE FROM tag WHERE item_type = ? AND item_id = ? AND axis = 'severity'",
        (item_type, item_id),
    )
    if value:
        conn.execute(
            """INSERT OR IGNORE INTO tag
                 (item_type, item_id, axis, value, confidence, method, taxonomy_version, created_at)
               VALUES (?, ?, 'severity', ?, 1.0, 'manual', ?, ?)""",
            (item_type, item_id, value, db.taxonomy_version(), db.now_iso()),
        )
    _log(conn, insight_id, "severity", ",".join(old) or None, value or None, actor)
    conn.commit()
    return {"insight_id": insight_id, "severity": value, "was": old}


# ---------- 批量操作 ----------

# 一次最多动多少条。批量是为了省事，不是为了清库 ——
# 一个手滑把 300 条标成「不处理」，没有任何界面能把它救回来。
BULK_MAX = 200

# 允许批量的动作。**故意不含 note**：把同一句话写到 200 条上几乎没有第二种含义，
# 那属于备注滥用。真要留"我看过了"的痕迹就用星标 —— 它可撤销，而且不占语义。
BULK_ACTIONS = {
    "claim": "认领",
    "unclaim": "取消认领",   # 显式动作：退回未认领。不是"认领给空字符串"，那种写法是忘了填人
    "status": "改状态",
    "tag": "打标签",
    "flag": "星标 / 静音",
}


def _precheck(action: str, p: dict) -> None:
    """参数错误是**整批**的错误，必须在动第一行之前拦下来。

    否则 30 条会因为同一个填错的参数各报一次错，界面上看到 30 条「失败」，
    而真正的原因只有一个：参数填错了。一次能说清的事，别拆成 30 条。
    条级的问题（比如 id 已经不在库里）才是逐条报的 —— 那种失败每条都不一样。
    """
    if action == "claim":
        if not (p.get("owner") or "").strip():
            raise ValueError("批量认领必须先指定负责人。"
                             "批量退回未认领是另一个动作，不支持顺手做")
    elif action == "status":
        sid = p.get("status_id") or ""
        if sid not in STATUS_LABELS:
            raise ValueError(f"未知状态 {sid!r}，可选：{'/'.join(STATUS_LABELS)}")
    elif action == "tag":
        axis = p.get("axis") or ""
        if axis not in AXES:
            raise ValueError(f"axis 必须是 {'/'.join(AXES)} 之一")
        if not (p.get("value") or "").strip():
            raise ValueError("打标签必须给出标签值")
        if (p.get("op") or "add") not in ("add", "remove"):
            raise ValueError("op 只能是 add 或 remove")
    elif action == "flag":
        if (p.get("flag") or "starred") not in ("starred", "muted"):
            raise ValueError("flag 只能是 starred 或 muted")


def _apply_one(conn, action: str, insight_id: str, p: dict, actor: str) -> dict:
    """一条的实际动作。**只做参数翻译，不重新实现任何语义。**"""
    if action == "claim":
        return claim(conn, insight_id, (p.get("owner") or "").strip(), actor,
                     p.get("note") or "")
    if action == "unclaim":
        return claim(conn, insight_id, "", actor)
    if action == "status":
        # 不传 note（= None = 保留原备注）。批量改状态还顺手清空 200 条备注的话，
        # 那不叫批量，那叫事故。
        return set_status(conn, insight_id, p.get("status_id") or "", actor)
    if action == "tag":
        return tag_manual(conn, insight_id, p.get("axis") or "", p.get("value") or "",
                          p.get("op") or "add", actor)
    if action == "flag":
        return set_flag(conn, insight_id, p.get("flag") or "starred",
                        bool(p.get("value", True)), actor)
    raise ValueError(f"不能批量执行 {action!r}")


def bulk(conn, action: str, ids, params: dict | None = None, actor: str = "cli") -> dict:
    """批量操作 = 循环调用单条实现 + 逐条记账。

    补这一层不是因为条数多了。文档原先写的是「354 条的时候够用，上千条就要补批量」，
    但真正的理由不是总量，是**有些动作天生是批量的**：
    「把这一批 P0 未认领的一次认领给我」本来就是一个动作，
    拆成 12 次点击只是把一个动作做慢，不会让它更安全。

    ## 为什么不做成一个事务
    批量改 30 条，其中 3 条的 id 已经不在库里了（数据被清过、或别人同时处理了）。
    整体回滚意味着那个人要重做另外 27 条 —— 一次点击的代价是重来一遍。
    所以这里是「能成的先成，不成的逐条报出来」，而不是「要么全成要么全不成」。

    ## 但必须有交代
    部分成功必须**永远**报数：applied 和 failed 一个都不能省，失败项还要带可读的原因。
    否则「30 条里成了 27 条」会伪装成「成功」，而那 3 条就是没人管的 3 条 ——
    这恰好是这个系统最该避免的事。前端的处理是：失败的那些**保持选中**，重试只要再点一次。

    ## 为什么是循环，不是一条 UPDATE ... WHERE id IN (...)
    因为「认领」不只是写一个字段：它要懒建状态行、比对旧值、写事件留痕。
    这些语义已经写在 claim / set_status / tag_manual / set_flag 里了。
    再写一条批量 SQL 就是第二份实现，两份迟早分叉，
    然后同一个动作在列表里点、和批量点，表现不一样。
    批量这一层只负责循环和记账 —— 这是它唯一该做的事。
    """
    params = params or {}
    if action not in BULK_ACTIONS:
        raise ValueError(f"不能批量执行 {action!r}（可选：{'/'.join(BULK_ACTIONS)}）")
    _precheck(action, params)

    # 去重但保持顺序：同一个 id 传两次不该被记两次账，
    # 否则 applied + failed 会大于 requested，那两个数就没法用来核对。
    seen, uniq = set(), []
    for raw in ids or []:
        x = (raw or "").strip()
        if x and x not in seen:
            seen.add(x)
            uniq.append(x)
    if not uniq:
        raise ValueError("没有选中任何条目")
    if len(uniq) > BULK_MAX:
        raise ValueError(f"一次最多 {BULK_MAX} 条，收到 {len(uniq)} 条，请分几批处理")

    ok: list[str] = []
    failures: list[dict] = []
    for iid in uniq:
        try:
            _apply_one(conn, action, iid, params, actor)
        except ValueError as exc:            # 条级问题：id 不在库里、状态被删了之类
            failures.append({"insight_id": iid, "error": str(exc)})
        except Exception as exc:             # noqa: BLE001 — 一条失败不该拖垮整批
            failures.append({"insight_id": iid, "error": f"{type(exc).__name__}: {exc}"})
        else:
            ok.append(iid)

    return {
        "action": action,
        "label": BULK_ACTIONS[action],
        "requested": len(uniq),
        "applied": len(ok),
        "failed": len(failures),
        "applied_ids": ok,
        "failures": failures,
        "actor": actor,
    }


# ---------- 北极星指标 ----------

def north_star(conn, weeks: int = 12, version: str | None = None) -> dict:
    """每周有多少条洞察，变成了有 owner 的工单。

    口径说明（写死，避免以后各页面对不上）：
      - 按**内容发布时间**归周，不按认领时间 —— 回答的是"这周冒出来的问题被接住了多少"
      - 「变成工单」= 有 owner 且状态属于推进态（已建需求/排期中/已修复）
      - 被忽略（muted）的条目不计入
    这个数连续三周为 0，说明系统已经死了，只是还没人宣布。
    """
    from . import metrics

    ver = version or db.resolve_version(conn)
    windows = metrics.recent_windows(weeks)
    series = []
    for idx, (label, start, end) in enumerate(windows):
        row = conn.execute(
            f"""{_ITEMS_CTE}
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN s.owner IS NOT NULL AND s.owner != '' THEN 1 ELSE 0 END) AS claimed,
                   SUM(CASE WHEN s.owner IS NOT NULL AND s.owner != ''
                             AND s.status_id IN ({','.join('?' * len(IN_PROGRESS))})
                            THEN 1 ELSE 0 END) AS ticketed
              FROM items i
              LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id
             WHERE i.ts >= ? AND i.ts < ? AND COALESCE(s.muted, 0) = 0""",
            [*IN_PROGRESS, start, end],
        ).fetchone()
        total = row["total"] or 0
        ticketed = row["ticketed"] or 0
        series.append({
            "week": label,
            "short": metrics.week_short(label),
            "start": start, "end": end,
            "total": total,
            "claimed": row["claimed"] or 0,
            "ticketed": ticketed,
            "rate": round(ticketed / total * 100, 1) if total else 0.0,
        })

    recent = [s["ticketed"] for s in series[-3:]]
    return {
        "definition": "有 owner 且状态为已建需求/排期中/已修复 的洞察数，按内容发布时间归周",
        "series": series,
        "current": series[-1]["ticketed"] if series else 0,
        "weeks_zero": sum(1 for v in recent if v == 0),
        "dead": all(v == 0 for v in recent) and len(recent) == 3,
        "taxonomy_version": ver,
    }


# ---------- 保存视图 ----------

def list_views(conn, owner: str | None = None) -> list[dict]:
    sql = "SELECT * FROM saved_view WHERE 1=1"
    params: list = []
    if owner:
        sql += " AND (owner = ? OR shared = 1)"
        params.append(owner)
    sql += " ORDER BY created_at DESC"
    return [dict(r) for r in conn.execute(sql, params)]


def get_view(conn, view_id: str) -> dict | None:
    row = conn.execute("SELECT * FROM saved_view WHERE view_id = ?", (view_id,)).fetchone()
    if not row:
        return None
    out = dict(row)
    # query 存的是 JSON 字符串；调用方要的是对象。在这里解析掉，别让每个调用方各解析一遍。
    try:
        out["query"] = json.loads(out["query"] or "{}")
    except (TypeError, json.JSONDecodeError):
        out["query"] = {}
    return out


def save_view(conn, name: str, query: dict | object, owner: str = "", shared: bool = True,
              view_id: str | None = None) -> dict:
    if not isinstance(query, dict):
        raise TypeError("query must be a dict")
    # 不用内置 hash()：字符串哈希带随机盐，同一份条件每跑一次会生成一个新 id，
    # 于是"保存视图"变成每次都在新建重复项。按名字算稳定摘要。
    vid = view_id or "view." + hashlib.md5(name.encode("utf-8")).hexdigest()[:8]
    conn.execute(
        """INSERT INTO saved_view (view_id, name, owner, query, shared, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(view_id) DO UPDATE SET
             name = excluded.name, query = excluded.query,
             shared = excluded.shared, owner = excluded.owner""",
        (vid, name, owner, json.dumps(normalize_filters(query), ensure_ascii=False),
         1 if shared else 0, db.now_iso()),
    )
    conn.commit()
    return {"view_id": vid, "name": name}


def delete_view(conn, view_id: str) -> bool:
    cur = conn.execute("DELETE FROM saved_view WHERE view_id = ?", (view_id,))
    conn.commit()
    return cur.rowcount > 0


BUILTIN_VIEWS: list[tuple[str, str, dict, str, int]] = [
    # 这里刻意不加 days 窗口：一个三个月前冒出来、至今没人认领的 P0，
    # 比昨天冒出来的更该被看见。加时间窗等于把烂得最久的先忘掉。
    ("view.builtin-p0", "P0 未认领", {"severity": ["sev.p0"], "owner": ["__none__"],
                                      "sort": "time_desc"}, "", 1),
    # me=True 是占位符，在调用边界（api.py / CLI）才替换成真实操作人。
    # 视图是共享的，「我负责」必须对每个人显示不同的结果，所以不能在保存时写死名字。
    ("view.builtin-mine", "我负责且未闭环", {"only_open": True, "me": True}, "", 1),
    ("view.builtin-hots", "高赞但没人管", {"owner": ["__none__"], "likes_min": 50,
                                        "only_open": True}, "", 1),
]


def seed_builtin_views(conn) -> int:
    """装三个开箱可用的视图。第一次打开洞察池的人不该面对一个空筛选器。

    已存在的一并刷新定义 —— 内置视图是代码资产，不是用户数据，
    升级时让人发现"这个内置视图还停留在三个版本前的口径"比覆盖它更糟。
    """
    added = 0
    for vid, name, query, owner, shared in BUILTIN_VIEWS:
        existed = get_view(conn, vid) is not None
        save_view(conn, name, query, owner=owner, shared=bool(shared), view_id=vid)
        if not existed:
            added += 1
    return added


# ---------- 概览 ----------

def summary(conn, version: str | None = None) -> dict:
    """洞察池顶部的几个数：总量、未认领、P0 未认领、我的人手分布。"""
    ver = version or db.resolve_version(conn)
    row = conn.execute(
        f"""{_ITEMS_CTE}
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN COALESCE(s.muted, 0) = 1 THEN 1 ELSE 0 END) AS muted,
               SUM(CASE WHEN s.owner IS NULL OR s.owner = '' THEN 1 ELSE 0 END) AS unclaimed,
               SUM(CASE WHEN (s.status_id IS NULL OR s.status_id NOT IN ('st.fixed','st.wontfix'))
                        THEN 1 ELSE 0 END) AS open
          FROM items i
          LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id"""
    ).fetchone()

    p0 = conn.execute(
        f"""{_ITEMS_CTE}
        SELECT COUNT(*) AS n FROM items i
          LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id
         WHERE EXISTS (SELECT 1 FROM tag t WHERE t.item_type = i.item_type AND t.item_id = i.item_id
                        AND t.axis = 'severity' AND t.value = 'sev.p0'
                        AND (t.taxonomy_version = ? OR t.method = 'manual'))
           AND (s.owner IS NULL OR s.owner = '')
           AND COALESCE(s.muted, 0) = 0""",
        (ver,),
    ).fetchone()["n"]

    return {
        "total": row["total"] or 0,
        "open": row["open"] or 0,
        "unclaimed": row["unclaimed"] or 0,
        "p0_unclaimed": p0,
        "muted": row["muted"] or 0,
        "taxonomy_version": ver,
    }


def meta(conn, version: str | None = None) -> dict:
    """给前台用的「字典表」：轴的中文名、每个标签值的中文名、状态清单、排序方式。

    存在的意义是让 UI 不需要硬编码任何中文标签 —— 分类体系改版时，
    页面上的下拉框跟着 config/taxonomy.json 自动变，不会出现「配置改了、页面还是旧的」。
    """
    # trackers 在模块顶部 import 了 insights，这里反向引用只能放在函数里，否则循环导入。
    from . import trackers

    tax = db.load_taxonomy()
    ver = version or db.resolve_version(conn)

    axes = []
    for axis_id in AXES:
        spec = (tax.get("axes") or {}).get(axis_id) or {}
        values = []
        for item in spec.get("items") or []:
            if not isinstance(item, dict) or not item.get("id"):
                continue
            values.append({
                "id": item["id"],
                "label": item.get("label") or item["id"],
                "weight": item.get("weight"),
            })
        # 库里实际出现过的值（含人工标签）也可能不在配置里，补进来，否则 UI 筛不到。
        seen = conn.execute(
            """SELECT DISTINCT t.value FROM tag t
                WHERE t.axis = ? AND (t.taxonomy_version = ? OR t.method = 'manual')""",
            (axis_id, ver),
        ).fetchall()
        known = {v["id"] for v in values}
        for row in seen:
            if row["value"] and row["value"] not in known:
                values.append({"id": row["value"], "label": row["value"], "weight": None})
        axes.append({
            "id": axis_id,
            "label": spec.get("label") or axis_id,
            "desc": spec.get("desc") or "",
            "values": values,
        })

    statuses = [{"id": sid, "label": label} for sid, label in STATUS_LABELS.items()]

    # 负责人名单是配置资产（config/trackers.json 各追踪项的 owner，配置中心可改），
    # 不从库里 distinct：那份名单跟着数据漂 —— 新团队要等第一条被分给它之后才出现在
    # 下拉里，顺序反了。配置是源头，数据是结果。不在名单里的历史 owner 不受影响：
    # 筛选器把 facets 计数的键并进来照常可筛，详情抽屉把当前值并进 datalist 照常可改。
    owners, _seen_owner = [], set()
    for t in load_trackers():
        o = (t.get("owner") or "").strip()
        if o and o not in _seen_owner:
            _seen_owner.add(o)
            owners.append(o)

    return {
        "taxonomy_version": ver,
        "axes": axes,
        # 追踪项也走字典表，不写在前端里。"追踪项"这四个中文字和它下面每个
        # 追踪项的名字都是配置资产（config/trackers.json），
        # 页面写死一份就会在配置改版后出现"库里改了、筛选器里还是旧名字"。
        "trackers": [{"id": t["id"], "label": t["name"], "owner": t["owner"],
                      "desc": t["desc"]} for t in load_trackers()],
        "statuses": statuses,
        "in_progress": list(IN_PROGRESS),
        "sorts": [{"id": k, "label": v} for k, v in {
            "time_desc": "最新在前", "time_asc": "最早在前",
            "likes": "点赞最多", "sev": "最严重在前",
        }.items()],
        "page_sizes": [20, 50, 100, 200],
        "owners": owners,
        "token_none": "__none__",
        # 口径清单。顶栏的全站口径选择器挂在哪一页上都要能取到它，
        # 所以不能只靠 weekly / trackers 各自接口里那两份 —— 这里和追踪中心共用同一个算法。
        "versions": trackers.versions(conn)["versions"],
    }


def owner_loads(conn, version: str | None = None) -> list[dict]:
    """每人名下「还没闭环」的 P0 / P1 / 总条数 —— 分配 / 转交弹层的负载提示（设计文档 §3.5.3）。

    为什么不是筛选项里的那个计数：facets 的 owners 计数跟着**当前筛选**走，
    而分配恰恰发生在「正在看未认领队列」的时候——那时候每个人的 facets 计数都是 0，
    全员零负载是最有误导性的数字。负载必须是全局的、独立于任何筛选的"这个人手上
    有多少活"。

    口径对齐列表页的默认视图：静音的不算、已闭环（st.fixed / st.wontfix）不算、
    还没建过状态行的算（懒创建，没行 = 待评估）。只数 P0 / P1 两档——
    把东西转给一个已经挂了 15 条 P0 的人才需要在指尖看见；
    P2 和未识别量大而轻，数进负载只会把信号推平。
    """
    ver = version or db.resolve_version(conn)
    rows = conn.execute(
        f"""{_ITEMS_CTE}
        SELECT owner, COALESCE(SUM(sev = 'sev.p0'), 0) AS p0,
               COALESCE(SUM(sev = 'sev.p1'), 0) AS p1, COUNT(*) AS open
          FROM (
            SELECT s.owner AS owner, s.status_id AS status_id, COALESCE(s.muted, 0) AS muted,
                   {_SEV_SUBQUERY} AS sev
              FROM items i
              LEFT JOIN insight_state s ON s.insight_id = i.item_type || ':' || i.item_id
          )
         WHERE owner IS NOT NULL AND owner <> ''
           AND muted = 0
           AND (status_id IS NULL OR status_id NOT IN ('st.fixed', 'st.wontfix'))
         GROUP BY owner
         ORDER BY p0 DESC, p1 DESC, open DESC, owner""",
        [ver],
    ).fetchall()
    return [{"owner": r["owner"], "p0": r["p0"], "p1": r["p1"], "open": r["open"]} for r in rows]
