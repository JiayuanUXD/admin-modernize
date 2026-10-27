"""洞察池的 HTTP 接口。纯标准库 http.server，零依赖 —— 和流水线其余部分保持一致。

为什么不是 FastAPI：这套东西的约束是"单机内部工具"，多一个依赖就多一份运维。
将来真要换框架，换掉的只是这一层薄壳，`insights.py` 里的语义一行不用动。

用法：
    python -m pipeline.run api --port 8771          # 只读+可写，绑定 127.0.0.1
    python -m pipeline.run api --role read          # 只读角色：聚合数字可见，原文被抹掉
    python -m pipeline.run api --host 0.0.0.0 --port 8781 --role owner
                                                    # 给局域网里的同事另起一个，启动时打印局域网地址

接口一览（全部返回 JSON，除 export.csv）：
    GET    /api/health
    GET    /api/summary                       洞察池顶部几个数
    GET    /api/taxonomy                      分类体系版本状态
    GET    /api/dashboard?version=&days=      看板：这段时间发生了什么（每个数都带它自己的筛选条件）
    GET    /api/facets?<filters>              各维度可选值与计数
    GET    /api/insights?<filters>&page=      洞察池列表
    GET    /api/insights/<insight_id>         单条详情
    GET    /api/insights/owner-loads          每人名下未闭环 P0/P1 条数（分配 / 转交弹层的负载）
    POST   /api/insights/<id>/claim           {"owner": "交易", "note": "分配 / 转交理由，进操作日志"}
    POST   /api/insights/<id>/status          {"status_id": "st.scheduled", "note": "..."}
    POST   /api/insights/<id>/note            {"note": "..."}
    POST   /api/insights/<id>/tag             {"axis": "experience", "value": "exp.notify", "op": "add"}
    POST   /api/insights/<id>/severity        {"value": "sev.p1"}   替换式改严重度；空串 = 改回未识别
    POST   /api/insights/<id>/flag            {"flag": "starred", "value": true}
    POST   /api/insights/bulk                 {"ids": [...], "action": "claim|status|tag|flag", ...}
                                              → 循环单条实现 + 逐条记账，部分成功如实报数
    GET    /api/north-star?weeks=12
    GET    /api/views   POST /api/views   DELETE /api/views/<view_id>
    GET    /api/export.csv?<filters>            内容级明细，一条一行
    POST   /api/export/posts.csv                {"ids": ["post:x", ...]}（ids 必填）
                                               → 按 post_id 归并的「要读的原帖清单」，
                                                 评论并进所属笔记；返回 csv + 报账字段
                                               （两端导出都包含用户原话，role=read 一律拒绝）

跟进看板（页面 5，主题级）：
    GET    /api/board?kind=exp|trk&include_empty=1   泳道 + 卡片，一次算完
    GET    /api/board/meta                           泳道字典（状态、类型、停滞阈值）
    GET    /api/board/<theme_id>                     单张卡片明细（theme_id 形如 exp:exp.home）
    POST   /api/board/<theme_id>/status              {"status_id": "...", "owner": "...", "note": "..."}

工作台（页面 1，今天该我做什么）：
    GET    /api/workbench?actor=家园                 一句话结论 + 我的名下的条目 + 需要拍板的主题
    GET    /api/workbench/summary?actor=家园         只出角标要的几个数（不查主题，导航用）

数据管道（页面 6，数据还值不值得信 · 以及怎么办）：
    GET    /api/ops                                  健康自检 + 新鲜度 + 数据量 + 运行日志 + 作业
    GET    /api/ops/summary                          只出自检结论（导航角标用）
    GET    /api/jobs                                 作业列表 + 有哪些作业可跑 + 当前在跑的
    GET    /api/jobs/<job_id>                        单个作业（含日志尾部）
    POST   /api/jobs                                 {"kind": "check|crawl|ingest|weekly"}
                                                      → 立刻返回，后台线程跑；结果写回 job 表
                                                      → 已有作业在跑时 **409**（不是 400：请求没错，
                                                        是时机不对 —— 用 400 会让人去改参数）
    GET    /api/samples?version=                     人工抽样：准确率 + 各轴各类目 + 待判 + 最近判过的
    POST   /api/samples/draw                         {"n": 30, "force": false}
                                                      → 抽一批**行**落库（不是现算的查询结果）。
                                                        上一轮还有没判完的会 400 拦下，除非 force
    POST   /api/samples/<id>/review                  {"verdict": "ok|bad|unsure", "note": "..."}
                                                      → 记录"人对标签的评价"，一行 tag 都不改；
                                                        判错/说不清必须写原因，且不许沿用旧备注

追踪中心（页面 3，这道题在变好还是变坏 · 以及量它用的哪把尺子）：
    GET    /api/trackers                             列表：走势 + 口径差（?version= 可切口径）
    GET    /api/trackers/meta                        字典表：负责人 / 方向 / 排序 / 版本沿革
    GET    /api/trackers/<tracker_id>                单项：10 周序列 + 双尺子对照 + 逐周条目
    POST   /api/trackers/<tracker_id>/status         登记跟进状态（与看板同一个主题，同一条真相）

配置中心（页面 7，改了会怎样）——**这一页没有任何写接口**：
    GET    /api/settings                             一屏：状态 + diff + 影响面 + 关键词 + 角色
                                                     ?impact=0 跳过全库重算（最贵的一步，
                                                       跳过时 impact 返回 null，不返回 0）
    GET    /api/settings/summary                     只出漂移告警（导航角标用，不重算）
    GET    /api/settings/diff                        工作区配置 vs 最近登记的快照
                                                     ?from=1.0&to=1.1 换成两个已登记版本的对照
    GET    /api/settings/test?<filters>&match=&weeks= 试算：这组条件过去 N 周命中多少条
                                                     （轴名写错会**报出来**，不静默返回 0）
    其它方法 → 405，并且说清"改配置走命令行"。真正的改动只能走
    `taxonomy --publish` / `retag` / 手改 JSON —— 改分类是这套系统里最危险的动作，
    而危险的动作不该有一个按钮。

归档（页面 8，历史还在不在）——**这一页也只读**：
    GET    /api/archive                              产物清单 + 按周对齐 + 口径快照
    GET    /api/archive/summary                      只出结论（导航角标用）
    GET    /api/archive/weekly/<week>                某一周的周报：原文 + 渲染好的 HTML
                                                     （周次只认 YYYY-WNN；这是唯一的文件读取入口）
    这里把"归档产物"和"当前产物"分开：名字里带周次的才是档，
    `dashboard.html` / `tracker-*.html` 每次出报表都会重写。
    三个接口都只认 GET；别的落到这一页前缀下 → 405 并列出这三个（不是 404：
    404 读起来像"归档还没做"，而它做了，只是没有写接口）。

回滚某次导入（页面 6 的危险区，整套系统里唯一真删用户数据的动作）：
    GET    /api/rollback                             可回滚的批次（含已撤过的、以及"没记批次"的那些）
    GET    /api/rollback/preview?batch=<批次号>       会删哪些、哪些删不了、连带动什么
                                                     → 只读，**不限角色**：让人知道能撤什么，
                                                       和让人有能力撤，是两件事
    POST   /api/rollback/apply                       {"batch_id": "...", "confirm": "<同一个批次号>"}
                                                     → 真删。**只给管理员**（不可撤销）
                                                     → confirm 必须是批次号本身，
                                                       不是 true —— 布尔确认拦不住手滑

筛选参数（与 insights.normalize_filters 一一对应）：
    experience=exp.home,exp.search  category=cat.seafood   sentiment=sen.complaint
    severity=sev.p0   severity_none=1   q=关键词   keyword=冷链   source=mediacrawler
    item_type=comment   owner=交易 或 __none__   status=st.todo 或 __none__
    tracker=trk.fulfill-late   days=30   likes_min=50   starred=1   only_open=1
    sort=time_desc|time_asc|likes|sev   page=1   page_size=50   view=<view_id>
"""

from __future__ import annotations

import json
import re
import socket
import struct
import sys
import urllib.parse
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import (archive, board, config_center, config_editor, dashboard, db, insights, jobs, ops,
               rollback, samples, trackers, workbench)

ROLES = ("read", "owner", "admin")

# 只读角色下被抹掉的字段。原文可见性是这套系统里唯一需要认真对待的权限，
# 它涉及合规；其余权限（谁能改状态）属于运维约定，不值得为它建一套 RBAC。
# sample 是看板卡片上的原文摘要 —— 漏了它等于只读角色照样能看到用户原话。
# snippet 是抽样列表上那段原文片段，同一个道理：它是"为了让人判标签对不对"而摘出来的，
# 所以它比别处**更**是原文，漏掉它整条抹除就白做了。
RAW_FIELDS = ("text", "title", "url", "context", "siblings", "note", "similar", "sample",
              "snippet")

# `text` 在这里指的是**用户原话**，所以见一个抹一个 —— fail-closed，这是对的。
# 但同一个词也被用来放**系统自己写的那句话**：headline.text（工作台/数据管道的
# 一句话结论）、conclusion.text（抽样准确率、配置中心）。一律抹掉的结果是：
# 只读角色打开工作台，最上面那句"今天该做什么"变成「（只读角色不展示原文）」——
# 页面上唯一一句人话没了，而它一个字的用户原话都没有。
#
# 所以给这几个容器开一张白名单。白名单小、且都是我们自己构造的对象；
# 关键是它**只**放过 `text` 一个键（headline 里真要有原话字段照样被抹）。
# 更彻底的做法是别把我们的诊断文字叫 text —— 那几个字段分散在四个模块里，
# 改名的收益不如在这里写清楚。
_OUR_PROSE_PARENTS = ("headline", "conclusion")


def _redact(payload, parent: str | None = None):
    """把原文相关字段抹空，保留聚合数字。只看汇总的人不需要看到用户原话。"""
    if isinstance(payload, list):
        return [_redact(p, parent) for p in payload]
    if not isinstance(payload, dict):
        return payload
    out = {}
    for key, value in payload.items():
        ours = parent in _OUR_PROSE_PARENTS and key == "text"
        if key in RAW_FIELDS and not ours:
            if key == "text":
                out[key] = "（只读角色不展示原文）"
                out["text_redacted"] = True
            elif key == "snippet":
                # 抹成空串会让抽样列表变成一排空白行 —— 看起来像"没数据"，
                # 而不是"你没权限看"。这里如实说一句，代价是那一行不好判，
                # 但不好判总比看不了还以为坏了强。
                out[key] = "（只读角色不展示原文）"
            elif key == "similar":
                out[key] = []
            elif key == "context":
                out[key] = {"post": None, "siblings": []}
            else:
                out[key] = ""
        else:
            out[key] = _redact(value, key)
    return out


class Api:
    """把 HTTP 请求翻译成 insights 层的调用。这一层不写业务逻辑。"""

    def __init__(self, role: str = "admin", actor: str = "api"):
        if role not in ROLES:
            raise ValueError(f"role 必须是 {'/'.join(ROLES)} 之一")
        self.role = role
        self.actor = actor

    @property
    def can_write(self) -> bool:
        return self.role in ("owner", "admin")

    def _actor(self, query: dict) -> str:
        """谁来用这个页面。显式传的优先，其次服务启动时的 --actor，最后才是无名氏。

        无名氏而不是空串：空串在工作台里等于"没有任何待办"，会渲染成"今天干净了" ——
        一个配置疏漏看起来像好消息，是最糟的失败方式。
        """
        return (query.get("actor") or self.actor or "我").strip() or "我"

    def dispatch(self, method: str, path: str, query: dict, body: dict, conn) -> tuple[int, dict | str]:
        seg = [s for s in path.strip("/").split("/") if s]
        if not seg or seg[0] != "api":
            return 404, {"error": "not found", "path": path}
        seg = seg[1:]

        if seg == ["health"]:
            return 200, {"ok": True, "role": self.role, "actor": self.actor}

        if seg == ["summary"]:
            return 200, insights.summary(conn)

        if seg == ["meta"]:
            return 200, insights.meta(conn)

        if seg == ["taxonomy"]:
            return 200, db.version_drift(conn)

        if seg == ["dashboard"]:
            return 200, dashboard.build(
                conn, version=query.get("version") or None, days=query.get("days"))

        if seg == ["facets"]:
            # 口径要跟着列表走。筛选器按当前口径算、列表按请求的口径算，
            # 会出现"每个选项都点得动、点进去却是 0 条"—— 两个数都对，就是不是一套。
            return 200, insights.facets(conn, query, version=query.get("version") or None,
                                        actor=self.actor)

        if seg == ["north-star"]:
            return 200, insights.north_star(conn, int(query.get("weeks", 12) or 12))

        if seg == ["export.csv"]:
            self._deny_raw_export()
            return 200, insights.export_csv(conn, query, version=query.get("version") or None,
                                            actor=self.actor)

        # 按条目导出原帖清单。用 POST 只因为一次可能带 200 个 id ——
        # 200 × "comment:c_1a2b3c" 塞进 URL 会超长，而超长的后果是被截断后
        # 导出一份少了几行的清单，且没有任何提示。它**不是写操作**，所以不 _deny_write。
        #
        # ids **必填**。"没传 ids"和"传了空数组"都当错误处理，不做成"那就导出全部"——
        # 空选择导出全库是一个没人会预期到的动作，而它看起来跟成功一模一样。
        # 想按筛选条件导原帖清单是另一个入口：命令行 `insights --csv-posts`。
        if seg == ["export", "posts.csv"] and method == "POST":
            self._deny_raw_export()
            ids = [i for i in (body.get("ids") or []) if str(i).strip()]
            if not ids:
                return 400, {"error": "没有选中任何条目（ids 不能为空）"}
            return 200, insights.export_posts(
                conn, item_ids=ids,
                version=body.get("version") or query.get("version") or None,
                actor=body.get("actor") or self.actor,
            )

        if seg == ["insights"] and method == "GET":
            return 200, insights.list_insights(
                conn, query,
                version=query.get("version") or None,
                page=int(query.get("page", 1) or 1),
                page_size=int(query.get("page_size", insights.PAGE_SIZE_DEFAULT) or
                              insights.PAGE_SIZE_DEFAULT),
                actor=self.actor,
            )

        if seg == ["views"]:
            if method == "GET":
                return 200, {"views": insights.list_views(conn, owner=query.get("owner"))}
            if method == "POST":
                self._deny_write()
                return 200, insights.save_view(
                    conn, body.get("name", "未命名"), body.get("query", {}),
                    owner=body.get("owner", ""), shared=bool(body.get("shared", True)),
                    view_id=body.get("view_id"),
                )
            return 405, {"error": "method not allowed"}

        if len(seg) == 2 and seg[0] == "views":
            view_id = urllib.parse.unquote(seg[1])
            if method == "GET":
                view = insights.get_view(conn, view_id)
                if view is None:
                    return 404, {"error": f"没有这个视图：{view_id}"}
                return 200, view
            if method == "DELETE":
                self._deny_write()
                return 200, {"deleted": insights.delete_view(conn, view_id)}
            return 405, {"error": "method not allowed"}

        # ---- 工作台（页面 1）----
        # actor 没传时退回服务启动时记下的操作人 —— 前端的"我"跟服务端对齐，
        # 否则一个人以为自己在看自己的待办，其实看的是全量。
        if seg == ["workbench", "summary"]:
            return 200, workbench.summary(conn, actor=self._actor(query))

        if seg == ["workbench"] and method == "GET":
            return 200, workbench.build(conn, actor=self._actor(query))

        # ---- 数据管道（页面 6）----
        # 这一页的自检只读：它回答"数据还值不值得信"，不在这里改数据。
        # 下半部的「运行区」是作业（/api/jobs），动作和自检分开 —— 见 ops.py 的说明。
        if seg == ["ops", "summary"]:
            return 200, ops.summary(conn)

        if seg == ["ops"] and method == "GET":
            return 200, ops.build(conn, version=query.get("version") or None)

        # ---- 后台作业：页面 6 下半部那个「运行」区 ----
        # 顺序要紧：`seg == ["jobs"]` 必须排在下面那条 `/api/jobs/<job_id>` 之前。
        # job_id 的形状是 job-20260917-1039-ab12，不会真的叫成别的，所以没有歧义 ——
        # 但顺序仍然写死，免得将来改 id 规则时踩到（洞察池那边同样的教训）。
        if seg == ["jobs"] and method == "GET":
            return 200, {
                "jobs": jobs.list_jobs(conn),
                "kinds": jobs.kinds(),
                "current": jobs.current(conn),
            }
        if seg == ["jobs"] and method == "POST":
            self._deny_write()
            kind = (body.get("kind") or "").strip()
            if not kind:
                raise ValueError(
                    f"得说清要跑哪个作业（可选：{'、'.join(j['kind'] for j in jobs.kinds())}）")
            self._deny_admin_only_job(kind)
            # 立刻返回，不等它跑完 —— 采集要十几分钟，同步等必然超时。
            # 正在跑的时候 `jobs.start` 抛 JobBusy，由 _handle 翻成 409。
            params = body.get("params") or {}
            if not isinstance(params, dict):
                raise ValueError("params 得是一个对象")
            return 200, jobs.start(conn, kind, actor=body.get("actor") or self.actor, params=params)
        if seg and seg[0] == "jobs" and len(seg) == 2 and method == "GET":
            job = jobs.get_job(conn, urllib.parse.unquote(seg[1]))
            if job is None:
                return 404, {"error": f"没有这个作业：{seg[1]}"}
            return 200, job

        # ---- 人工抽样：这一页的下半部，「尺子量得准不准」----
        # 顺序同样要紧：/api/samples/draw 必须排在 /api/samples/<id>/review 之前。
        # draw 的形状不会和样本编号撞（编号是数字），但顺序仍然写死，理由和上面几处一样。
        if seg == ["samples"] and method == "GET":
            return 200, samples.report(conn, version=query.get("version") or None)

        if seg == ["samples", "draw"] and method == "POST":
            self._deny_write()
            return 200, samples.draw(
                conn,
                # 没给条数就用默认的 30：够算出大致区间，又不至于让人判不完。
                n=body.get("n") or samples.DEFAULT_N,
                version=body.get("version") or query.get("version") or None,
                actor=body.get("actor") or self.actor,
                # force 换一批题。上一轮那几条**留在库里**，不删 —— 详见 samples.draw。
                force=bool(body.get("force", False)),
            )

        if len(seg) == 3 and seg[0] == "samples" and seg[2] == "review" and method == "POST":
            self._deny_write()
            if not body.get("verdict"):
                raise ValueError("得说清判成什么：ok（对）/ bad（错）/ unsure（说不清）")
            return 200, samples.review(
                conn, urllib.parse.unquote(seg[1]),
                body.get("verdict", ""),
                actor=body.get("actor") or self.actor,
                # note 用 get("note") 而不是 get("note", "")：没传 = 不改备注。
                # 和 /api/insights/<id>/status 同一条规矩（见 insights.set_status）。
                note=body.get("note"),
            )

        # ---- 追踪中心（页面 3）----
        # 顺序同样要紧：/api/trackers/meta 必须先于 /api/trackers/<tracker_id> 命中，
        # 否则 "meta" 会被当成一个追踪项 id 解析，返回「没有这条追踪项」——
        # 一个"接口不存在"的假象。
        if seg == ["trackers", "meta"]:
            return 200, trackers.meta(conn)

        if seg == ["trackers"] and method == "GET":
            return 200, trackers.overview(
                conn,
                version=query.get("version"),
                # 口径差默认开着。它才是这一页的重点：没有它，
                # "换过尺子"这件事只能靠人去翻旧周报才发现。
                compare=query.get("compare", "1") not in ("0", "false"),
                owner=query.get("owner"),
                status=query.get("status"),
                alert_only=query.get("alert", "") not in ("", "0", "false"),
                direction=query.get("direction"),
                q=query.get("q"),
                sort=query.get("sort") or "alert",
            )

        if len(seg) >= 2 and seg[0] == "trackers":
            tracker_id = urllib.parse.unquote(seg[1])
            if len(seg) == 2 and method == "GET":
                detail = trackers.detail(conn, tracker_id, version=query.get("version"))
                if detail is None:
                    return 404, {"error": f"没有这个追踪项：{tracker_id}"}
                return 200, detail
            if len(seg) == 3 and seg[2] == "status" and method == "POST":
                self._deny_write()
                # 写的是**宿主主题**，不是追踪项自己那行。
                # 锚定在一个体验域上的追踪项不独立成卡，它的状态就是那张体验域卡的状态；
                # 直接写 tracker 行会让看板和追踪中心从这一刻开始各说各话。
                theme_id = board.host_theme_id(conn, tracker_id)
                if theme_id is None:
                    return 404, {"error": f"没有这个追踪项：{tracker_id}"}
                return 200, board.set_theme_status(
                    conn, theme_id, body.get("status_id", ""),
                    actor=body.get("actor") or self.actor,
                    owner=body.get("owner"),      # None = 不动负责人，"空串" = 清空
                    note=body.get("note", ""),
                )
            return 404, {"error": f"未知的追踪操作：{'/'.join(seg[2:]) or method}"}

        # ---- 跟进看板（页面 5）----
        # 顺序要紧：/api/board/meta 必须先于 /api/board/<theme_id> 命中，
        # 否则 "meta" 会被当成一个主题 id 解析。
        if seg == ["board", "meta"]:
            return 200, board.board_meta(conn)

        if seg == ["board"] and method == "GET":
            kind = query.get("kind") or None
            if kind and kind not in board.KINDS:
                return 400, {"error": f"未知主题类型 {kind!r}（可选 {list(board.KINDS)}）"}
            # 口径要跟着 URL 走：从看板点「未登记 3」过来时若换成当前口径算，
            # 那里的 3 和这里的 3 就不是同一批卡片 —— 两个页面都正常，只是尺子不同。
            # 不存在的版本直接报错（复用追踪中心那一条规矩），不静默退回。
            ver = trackers.resolve(conn, query.get("version") or None)
            return 200, board.list_board(
                conn,
                version=ver,
                kind=kind,
                # 默认带上空主题：板上"本该有人管却没人提"的格子空着，比藏起来更有信息量。
                include_empty=(query.get("include_empty", "1") not in ("0", "false", "")),
                actor=self.actor,
            )

        if len(seg) >= 2 and seg[0] == "board":
            theme_id = urllib.parse.unquote(seg[1])
            if len(seg) == 2 and method == "GET":
                detail = board.card_detail(conn, theme_id)
                if detail is None:
                    return 404, {"error": f"没有这个主题：{theme_id}"}
                return 200, detail
            if len(seg) == 3 and seg[2] == "status" and method == "POST":
                self._deny_write()
                return 200, board.set_theme_status(
                    conn, theme_id, body.get("status_id", ""),
                    actor=body.get("actor") or self.actor,
                    owner=body.get("owner"),          # None = 不动负责人，"空串" = 清空
                    note=body.get("note", ""),
                )
            return 404, {"error": f"未知的看板操作：{'/'.join(seg[2:]) or method}"}

        # ---- 洞察池：批量操作 ----
        # 顺序要紧：必须排在下面那个通用的 /api/insights/<id> 分支之前。
        # 好在 insight_id 的形状是 post:<id> / comment:<id>，不会真的叫 "bulk"，
        # 所以这里不存在歧义 —— 但顺序仍然写死，免得将来改 id 规则时踩到。
        if seg == ["insights", "bulk"] and method == "POST":
            self._deny_write()
            return 200, insights.bulk(
                conn,
                body.get("action", ""),
                body.get("ids") or [],
                body,
                actor=body.get("actor") or self.actor,
            )

        # 每人负载。排在 /api/insights/<id> 之前，和 bulk 同理：
        # "owner-loads" 不是合法的 insight_id 形状（post:<id> / comment:<id>）。
        if seg == ["insights", "owner-loads"] and method == "GET":
            return 200, insights.owner_loads(conn, query.get("version") or None)

        if seg and seg[0] == "insights" and len(seg) >= 2:
            insight_id = urllib.parse.unquote(seg[1])
            if len(seg) == 2 and method == "GET":
                detail = insights.get_insight(conn, insight_id)
                if detail is None:
                    return 404, {"error": f"没有这条洞察：{insight_id}"}
                return 200, detail

            if len(seg) == 3 and method == "POST":
                self._deny_write()
                return self._command(conn, seg[2], insight_id, body)

        # ---- 配置中心（页面 7）：只回答「改了会怎样」----
        # 这一页一行数据都不动，也没有任何写接口。真正的改动只能走 CLI
        # （taxonomy --publish / retag / 手改 JSON）—— 理由见下面那条 405。
        if seg == ["settings", "summary"]:
            # 角标这一条**不重算影响面**：它每换一页都要刷一次，
            # 挂上全库重算等于每次导航都把整库打一遍标。
            return 200, config_center.summary(conn)

        if seg == ["settings", "diff"]:
            a, b = query.get("from"), query.get("to")
            if a and b:
                # 两个已登记版本之间的对照归"版本历史里点开看"，
                # 不传 from/to 才是这一页正面的那个问题（工作区 vs 最近登记）。
                return 200, config_center.diff_releases(conn, a, b)
            return 200, config_center.taxonomy_diff(conn)

        if seg == ["settings", "test"]:
            # 试算必须单独一条：它随人改条件反复请求。塞进整屏那个 build 里，
            # 等于每拨一个下拉都重算一遍全库。
            return 200, config_center.tracker_test(
                conn, query,
                match=query.get("match") or "all",
                weeks=query.get("weeks") or config_center.TEST_WEEKS,
            )

        if seg == ["settings"] and method == "GET":
            # impact=0 跳过重算。跳过时 impact 是 null —— 页面必须如实说"没算"，
            # 不能拿 0 冒充：0 是有含义的（配置改了但一条都没动），两者长得一样。
            #
            # 这一页刻意不接受 ?version=：它问的是"我手上这份配置会怎样"，
            # 换成历史快照就是另一个问题（那个有 /api/settings/diff?from=&to=）。
            return 200, config_center.build(
                conn,
                with_impact=query.get("impact", "1") not in ("0", "false", "no"),
            )

        # ---- 配置编辑器（2026-09-22）：三份 config/*.json 的读 / 预览 / 写 ----
        # 写只给管理员（和回滚同一档）；预览要跑全库重算，read 角色不给；读谁都行（内容本来就在 /api/settings 里）。
        if len(seg) == 3 and seg[:2] == ["settings", "edit"]:
            kind = seg[2]
            if kind not in config_editor.KINDS:
                return 404, {"error": f"没有这种配置：{kind}（可选：{'、'.join(config_editor.KINDS)}）"}
            if method == "GET":
                return 200, config_editor.load(kind)
            if method == "PUT":
                self._deny_destructive()
                doc = body.get("doc")
                if not isinstance(doc, dict):
                    raise ValueError("body.doc 得是整份文档（对象）")
                return 200, config_editor.save(kind, doc, str(body.get("base_fingerprint") or ""), actor=self.actor)
            return 405, {"error": "这条路只认 GET / PUT"}
        if seg == ["settings", "preview"] and method == "POST":
            self._deny_write()
            kind = body.get("kind")
            if kind not in config_editor.KINDS:
                raise ValueError(f"kind 得是 {'、'.join(config_editor.KINDS)} 之一")
            if not isinstance(body.get("doc"), dict):
                raise ValueError("body.doc 得是整份文档（对象）")
            return 200, config_editor.preview(kind, body["doc"], conn)

        if seg and seg[0] == "settings":
            # 明说"这里没有写接口"，而不是回一个笼统的 404 ——
            # 404 会让人以为路径敲错了，然后去改路径，而真正该改的是做法。
            return 405, {"error": "这条路没有写接口。改配置走编辑器：PUT /api/settings/edit/<taxonomy|trackers|keywords>"
                                  "（仅管理员，先 GET 拿指纹）；登记发布 / 重算走 POST /api/jobs"}

        # ---- 归档（页面 8）：历史还在不在 ----
        # 和配置中心同一条纪律：这一页读产物文件与库里的指标，一行都不写。
        # 三个接口都**只认 GET** —— 不写 method 判断的话，POST 到它们也会返回 200，
        # 一个"读接口接受了写方法"的状态是那种没人会去看、但会在某天被引用成"它支持 POST"的东西。
        if seg == ["archive", "summary"] and method == "GET":
            return 200, archive.summary(conn)

        # 顺序要紧：/api/archive/weekly/<week> 必须在 /api/archive 之前命中，
        # 否则 "weekly" 会被当成一个不存在的子路径。周次交给 read_weekly 自己校验
        # （它只认 YYYY-WNN，别的一律拒）—— 这是内部工具里唯一的文件读取入口，
        # 拿参数去拼路径等于把目录遍历送出去。
        if len(seg) == 3 and seg[0] == "archive" and seg[1] == "weekly" and method == "GET":
            try:
                return 200, archive.read_weekly(urllib.parse.unquote(seg[2]))
            except ValueError as exc:
                return 400, {"error": str(exc)}

        if seg == ["archive"] and method == "GET":
            return 200, archive.build(conn)

        if seg and seg[0] == "archive":
            # 这一页确实只有三个 GET 接口。落到这里要说清"这里没有写接口"，
            # 而不是回一个笼统的 404 —— 404 读起来像"这一页还没做"，
            # 它会让人去敲别的路径，而真正该改的是做法（归档只读）。
            routes = ("归档只有三个接口：GET /api/archive、GET /api/archive/summary、"
                      "GET /api/archive/weekly/<周次>。这一页只读，没有写接口")
            # 路径存在、方法不对 → 405；路径敲错 → 404。两者要说不同的话。
            known = (seg == ["archive"] or seg == ["archive", "summary"]
                     or (len(seg) == 3 and seg[1] == "weekly"))
            return (405 if known else 404), {"error": routes}

        # ---- 回滚某次导入：整套系统里唯一真的会删用户数据的动作 ----
        #
        # 预览（GET）**所有角色都能看**：让人知道自己本来能撤掉什么，
        # 和让人有能力撤掉它，是两件事。执行（POST）只给管理员，见 _deny_destructive。
        if seg == ["rollback", "preview"]:
            try:
                return 200, rollback.preview(conn, query.get("batch") or "")
            except ValueError as exc:
                return 400, {"error": str(exc)}

        if seg == ["rollback", "apply"] and method == "POST":
            self._deny_destructive()
            # batch_id / confirm 都从 body 取。confirm 传错会走 ValueError → 400。
            return 200, rollback.apply(
                conn,
                body.get("batch_id") or "",
                actor=body.get("actor") or self.actor,
                confirm=body.get("confirm") or "",
            )

        if seg == ["rollback"] and method == "GET":
            return 200, rollback.build(
                conn,
                batch_id=query.get("batch") or None,
                limit=int(query.get("limit") or 30),
            )

        if seg and seg[0] == "rollback":
            # 落到这里有两种情况，两种该说不同的话（都已把接口列出来了）：
            #   · 路径存在、方法不对（POST /api/rollback）→ 405。回 404 会让人以为回滚没做。
            #   · 路径敲错（GET /api/rollback/preveiw）→ 404。回 405 会让人去换方法，而该换的是路径。
            routes = ("回滚只有两个接口：GET /api/rollback/preview?batch=<批次号>（看会删哪些），"
                      "POST /api/rollback/apply（真删，要管理员 + 批次号确认）")
            if seg in (["rollback"], ["rollback", "preview"], ["rollback", "apply"]):
                return 405, {"error": routes}
            return 404, {"error": routes}

        return 404, {"error": "not found", "path": path}

    def _deny_write(self):
        if not self.can_write:
            raise PermissionError(f"角色 {self.role} 只能读")

    def _deny_destructive(self):
        """回滚单独一道闸，不跟着 `can_write` 走。

        `can_write` 管的是"谁能改状态、认领、打标签"——那些都可以撤回，
        所以 owner 和 admin 都行。回滚不一样：它删的是别人采集回来的原始内容，
        **不可撤销**。把一件不可撤销的事交给"任何能改状态的人"，
        等于把这道闸设在了一个跟后果不匹配的高度上。
        """
        if self.role != "admin":
            raise PermissionError(
                f"角色 {self.role} 不能回滚 —— 它删数据且不可撤销，只给管理员。"
                f"预览不限角色：GET /api/rollback/preview?batch=<批次号> 谁都能看。")

    def _deny_admin_only_job(self, kind: str):
        """注册表里标了 admin_only 的作业只给管理员，理由写在 `jobs.REGISTRY` 上面。

        页面上这几颗按钮对非管理员是灰的，这里是真正的那道闸：局域网里的同事
        直接调接口，照样得挡住。先于参数校验 —— 没权限的人不该先被要求把参数填对。
        未知的作业不在这里管，交给 `jobs.start` 去报"可选哪些"。
        """
        meta = jobs.REGISTRY_BY_KIND.get(kind)
        if meta and meta.get("admin_only") and self.role != "admin":
            raise PermissionError(
                f"「{meta['title']}」只有管理员能运行，当前角色 {self.role}。需要跑的话请联系管理员。")

    def _deny_raw_export(self):
        """导出这条路要单独挡一道，因为它绕过了 _redact。

        `_redact` 只认 list / dict —— CSV 是一整块字符串，从它旁边原样走过去。
        后果是只读角色点一次「导出 CSV」就能拿到全部用户原话，
        而页面上明明写着"原文已抹除"，`/api/health` 也还报着 role=read。
        这类漏法最坏的地方在于**它不报错**：权限看起来是配对的，数据也真拿到了。

        为什么是拒绝，不是"导出抹掉原文的版本"：一份 text 列全空的 CSV 长得跟
        正常导出件一模一样，收到的人只会以为这批数据没内容。
        真要聚合数字，只读角色有 /api/summary、/api/facets、/api/dashboard。
        """
        if self.role == "read":
            raise PermissionError(
                f"角色 {self.role} 不能导出（导出件包含用户原话）。"
                f"聚合数字请看 /api/summary、/api/facets、/api/dashboard")

    def _command(self, conn, action: str, insight_id: str, body: dict):
        actor = body.get("actor") or self.actor
        if action == "claim":
            return 200, insights.claim(conn, insight_id, body.get("owner", "").strip(), actor,
                                        body.get("note", ""))
        if action == "status":
            # note 用 body.get("note") 而不是 body.get("note", "")：
            # 没传备注 = 不改备注。传空串才是明确清空。见 insights.set_status 的说明。
            return 200, insights.set_status(conn, insight_id, body.get("status_id", ""),
                                             actor, body.get("note"))
        if action == "note":
            return 200, insights.set_note(conn, insight_id, body.get("note", ""), actor)
        if action == "tag":
            return 200, insights.tag_manual(conn, insight_id, body.get("axis", ""),
                                            body.get("value", ""),
                                            body.get("op", "add"), actor)
        # 列表里点一下改严重度。不并进 tag：严重度是单值轴，改 = 替换
        # （删旧不分来源 + 写人工），只追加会被规则标签压住显示位 —— 见 set_severity。
        if action == "severity":
            return 200, insights.set_severity(conn, insight_id, body.get("value", ""), actor)
        if action == "flag":
            return 200, insights.set_flag(conn, insight_id, body.get("flag", "starred"),
                                          bool(body.get("value", True)), actor)
        return 404, {"error": f"未知操作 {action}"}


def make_handler(api: Api, static_dirs):
    """static_dirs 按优先级排序：先命中 ui/（后台页面，是源码），再回落到 out/（生成出来的看板）。"""
    if static_dirs is None:
        static_dirs = []
    elif isinstance(static_dirs, (str, Path)):
        static_dirs = [static_dirs]
    static_dirs = [Path(d) for d in static_dirs]

    class Handler(BaseHTTPRequestHandler):
        server_version = "dd-ux-radar/1.0"

        def log_message(self, fmt, *args):
            if api.role == "admin" or True:
                print(f"  {self.address_string()} {fmt % args}")

        # ---- 基础设施 ----

        def _send(self, status: int, payload, content_type="application/json; charset=utf-8"):
            if isinstance(payload, str):
                raw = payload.encode("utf-8")
            else:
                raw = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)

        def _read_body(self) -> dict:
            try:
                length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                return {}
            if not length:
                return {}
            try:
                return json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            except (json.JSONDecodeError, UnicodeDecodeError):
                return {}

        def _split(self):
            parsed = urllib.parse.urlparse(self.path)
            query = {k: v[0] if len(v) == 1 else v
                     for k, v in urllib.parse.parse_qs(parsed.query).items()}
            return parsed.path, query

        # ---- 路由 ----

        def do_GET(self):
            path, query = self._split()
            if not path.startswith("/api/") and static_dirs and self._serve_static(path):
                return
            self._handle("GET", path, query, {})

        def do_POST(self):
            path, query = self._split()
            self._handle("POST", path, query, self._read_body())

        def do_PUT(self):
            # 配置编辑器的写接口（PUT /api/settings/edit/<kind>）。整份文档覆盖，语义上就是 PUT。
            path, query = self._split()
            self._handle("PUT", path, query, self._read_body())

        def do_DELETE(self):
            path, query = self._split()
            self._handle("DELETE", path, query, {})

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Allow", "GET, POST, PUT, DELETE, OPTIONS")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def _handle(self, method, path, query, body):
            conn = db.connect()
            conn.execute("PRAGMA foreign_keys = ON")
            try:
                status, payload = api.dispatch(method, path, query, body, conn)
                if api.role == "read":
                    payload = _redact(payload)
                self._send(status, payload)
            except PermissionError as exc:
                self._send(403, {"error": str(exc)})
            except jobs.JobBusy as exc:
                # 409 而不是 400：请求本身没错，是**时机**不对 —— 已经有作业在跑。
                # 用 400 会让人以为是自己参数填错了，然后去改参数。
                self._send(409, {"error": str(exc), "busy": True})
            except config_editor.ConflictError as exc:
                # 同样是"时机"：文件在你加载之后被别人改了。重新加载再改，别覆盖。
                self._send(409, {"error": str(exc), "conflict": True})
            except ValueError as exc:
                self._send(400, {"error": str(exc)})
            except Exception as exc:  # noqa: BLE001 — 内部工具，把真实错误如实吐出来更好排查
                self._send(500, {"error": f"{type(exc).__name__}: {exc}"})
            finally:
                conn.close()

        # ---- 静态文件（后台页面 / 生成的看板），让页面与接口同源 ----

        def _serve_static(self, path: str) -> bool:
            # 目录穿越防护：解析后必须仍在某个允许的静态根目录里。
            raw = urllib.parse.unquote(path).lstrip("/")
            if "\x00" in raw:
                self._send(403, {"error": "forbidden"})
                return True
            # 根路径按顺序试这几个默认页：后台首页优先，其次生成的看板。
            candidates = [raw] if raw else ["index.html", "dashboard.html"]

            for sdir in static_dirs:
                root = sdir.resolve()
                if not root.is_dir():
                    continue
                for rel in candidates:
                    target = (root / rel).resolve()
                    try:
                        target.relative_to(root)
                    except ValueError:
                        continue  # 越界，换下一个目录，不告诉对方目录结构
                    if target.is_file():
                        self._send_file(target)
                        return True
            return False

        def _send_file(self, target: Path) -> None:
            ctype = {
                ".html": "text/html; charset=utf-8",
                ".md": "text/plain; charset=utf-8",
                ".txt": "text/plain; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".json": "application/json; charset=utf-8",
                ".csv": "text/csv; charset=utf-8",
                ".svg": "image/svg+xml",
                ".png": "image/png",
                ".ico": "image/x-icon",
                ".woff2": "font/woff2",
            }.get(target.suffix, "application/octet-stream")
            texty = ctype.startswith("text/") or "json" in ctype or "svg" in ctype or "javascript" in ctype
            body = target.read_text(encoding="utf-8") if texty else target.read_bytes()
            self._send(200, body, ctype)

    return Handler


def serve(port: int = 8771, host: str = "127.0.0.1", role: str = "admin",
          actor: str = "api", static_dir: Path | None = None,
          ui_dir: Path | None = None) -> None:
    """起服务。默认只绑 127.0.0.1，只有本机能打开；`host="0.0.0.0"` 给局域网里的同事用。

    没有登录：打开这个地址的人都是 `role` 那个角色。所以开给局域网时通常另起一个
    read / owner 的服务，管理员那个留在 127.0.0.1。

    默认端口特意避开 8770：macOS 的 sharingd（隔空投送/接力）会常驻占用它，
    报错却是 "Address already in use"，很难往系统服务上想。
    """
    api = Api(role=role, actor=actor)
    dirs = []
    for d in (ui_dir, static_dir):
        if d:
            dirs.append(Path(d))

    # 清扫：起它的进程已经不在了的作业标成「被打断」。另一个服务、命令行正在跑的不动 ——
    # 两个服务读同一个库，这边重启不该把那边正在跑的作业说成被打断（见 jobs.sweep_orphans）。
    conn = db.connect()
    try:
        swept = jobs.sweep_orphans(conn)
    finally:
        conn.close()

    httpd = ThreadingHTTPServer((host, port), make_handler(api, dirs))
    lan_ips = _lan_ips() if host in _ALL_INTERFACES else []
    for line in _banner_lines(host, port, api, lan_ips):
        print(line)
    if swept:
        print(f"  清扫：{swept} 个作业没跑完、跑它的服务已经退出，已标为「被打断」")
    for d in dirs:
        print(f"  静态目录：{d}")
    print("  Ctrl-C 停止\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        httpd.server_close()


_ALL_INTERFACES = ("0.0.0.0", "")

# 列网卡用的 ioctl：(SIOCGIFADDR, SIOCGIFFLAGS, sizeof(struct ifreq))。两个平台上返回值里
# 地址都在 [20:24]、flags 都在 [16:18]。别的平台不列网卡，横幅退回"没查到本机 IP"。
_IFREQ = {"darwin": (0xC0206921, 0xC0206911, 32), "linux": (0x8915, 0x8913, 40)}
_IFF_LOOPBACK, _IFF_POINTOPOINT = 0x8, 0x10


def _is_loopback(host: str) -> bool:
    return host in ("localhost", "::1") or host.startswith("127.")


def _interfaces() -> list[tuple[str, str, int]]:
    """本机每块有 IPv4 的网卡：(名字, 地址, flags)。"""
    consts = _IFREQ.get("linux" if sys.platform.startswith("linux") else sys.platform)
    try:
        import fcntl
    except ImportError:                       # Windows 没有 fcntl
        return []
    if not consts:
        return []
    get_addr, get_flags, size = consts
    out = []
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        for _, name in socket.if_nameindex():
            req = struct.pack(f"{size}s", name.encode()[:15])
            try:
                addr = fcntl.ioctl(sock.fileno(), get_addr, req)
                flags = fcntl.ioctl(sock.fileno(), get_flags, req)
            except OSError:                   # 这块网卡没有 IPv4
                continue
            out.append((name, socket.inet_ntoa(addr[20:24]), struct.unpack("=H", flags[16:18])[0]))
    finally:
        sock.close()
    return out


def _pick_lan_ips(ifaces) -> list[str]:
    """挑出局域网里别的电脑能打开的地址。

    不用"UDP connect 按路由选出口"那招：开着代理（Clash、Surge 这类 TUN 模式）时，
    默认路由走虚拟网卡，选出来的是 198.18.0.1，别的电脑打不开。所以直接列网卡：
    跳过回环和点对点（utun 这类隧道：代理、VPN），再按地址跳过链路本地 169.254/16
    和基准测试段 198.18/15（代理的 fake-ip 网卡用它，真局域网不会分到）。
    """
    return [ip for _, ip, flags in ifaces
            if not flags & (_IFF_LOOPBACK | _IFF_POINTOPOINT)
            and not ip.startswith(("127.", "169.254.", "198.18.", "198.19."))]


def _lan_ips() -> list[str]:
    return _pick_lan_ips(_interfaces())


def _banner_lines(host: str, port: int, api: Api, lan_ips: list[str]) -> list[str]:
    """起服务时打印的那几行。`0.0.0.0` 本身别的电脑打不开，所以打印本机、局域网两种真地址。"""
    if host in _ALL_INTERFACES:
        lan = "  ".join(f"http://{ip}:{port}" for ip in lan_ips)
        lines = [f"后台已启动：http://127.0.0.1:{port}（本机）",
                 f"  局域网：{lan}（发给同一网络里的同事）" if lan_ips
                 else f"  局域网：用本机的局域网 IP 加 :{port} 打开（没查到本机 IP）"]
    else:
        lines = [f"后台已启动：http://{host}:{port}"]
    lines.append(f"  角色 {api.role} · 操作人 {api.actor}" + ("" if api.can_write else "（只读，原文已抹除）"))
    if api.role == "admin" and not _is_loopback(host):
        lines.append("  提醒：没有登录，局域网里打开的人都是管理员，能改配置、回滚删数据。"
                     "只给同事看数用 --role read，要认领流转用 --role owner。")
    return lines


def _sanitize_actor(value: str) -> str:
    return re.sub(r"[^\w\u4e00-\u9fa5.\-]", "", value or "")[:32] or "api"
