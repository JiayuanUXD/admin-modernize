# 叮咚买菜 · 小红书体验雷达：洞察池试点

在不改雷达业务仓的前提下，用对接面流水线跑通一条真实切片：期望抽取 → 实际能力 → 差距 → 人工处置 → 骨架。

## 目标

页面已经用 `get` / `post` / `api` 打到现网接口。这次要证明两件事：扩完抽取之后，这 6 个接口能从副本里抽出 desired，对照手写的 actual IR 得到 gap，填上 disposition 之后能生成骨架；切真接口之后，契约不一致数能从 `check-contract` 的校验日志读出来。

不改雷达 UI，不把骨架接回页面。最小约束面只冻结这份副本里的存量；离线预览跑的是 `admin-preview-loop` 的 fixture，不是这个页面。已直连后台的「接到测试环境」见「阶段 0→1」，不是再改一版界面。

## 切片

只锁这 6 个。口语里的 `{id}` 在 IR 里写成 `{param}`：页面是 `` `/api/insights/${encodeURIComponent(…)}` `` 或 `'/api/insights/' + encodeURIComponent(id)`，不是裸的 `${id}`。脚本不猜参数名。actual 用同一写法，`build-gap` 才能对齐。

| 操作 | 方法 + 路径 | 请求 |
|---|---|---|
| 列表 | `GET /api/insights` | 查询串由页面拼出来。抽取只看见字面量里的 `q`、`page_size` |
| 筛选计数 | `GET /api/facets` | 查询串是变量，IR 里的 query 为空 |
| 详情 | `GET /api/insights/{param}` | 无请求体 |
| 认领 / 分配 / 转交 | `POST /api/insights/{param}/claim` | `owner`、`actor`，可选 `note` |
| 改状态 | `POST /api/insights/{param}/status` | `status_id`、`actor`，可选 `note`。**note 缺省 ≠ 空串** |
| 写备注 | `POST /api/insights/{param}/note` | `note`、`actor` |

其它调用留在 `desired.full.ir.json`（本次 49 条），没有收进这 6 条。

## 决策

D4 在这一例上覆盖插件默认。默认是：没有 OpenAPI / proto 时原型先行。这里没有 OpenAPI，但 `pipeline/api.py` 和 `insights.py` 已经是稳定实现，所以走**后端先行**：实际能力写成 actual IR（`generator: manual`），不另手写一份 OpenAPI，也不把页面再维护成第二份契约。

disposition 六条都是 `direct`。现网页面已经直接调用这些接口，不需要为了这次试点加一层 BFF。`status` 仍是 `reshape`：期望侧的响应字段是空的（抽取认 axios 的 `res.data`，这个页面直接用返回值），实际侧写了响应 JSON 的顶层键。这不是「接口对不上所以要做映射」，阅读时以 `lessons.md` 为准。

## 源码副本

`pilot-source/` 是雷达仓的只读副本，不是业务仓，本试点不改它：

| 路径 | 来源 |
|---|---|
| `pilot-source/ui/app.js` | 雷达 `ui/app.js` |
| `pilot-source/pipeline/api.py` | 雷达 `pipeline/api.py` |
| `pilot-source/pipeline/insights.py` | 雷达 `pipeline/insights.py` |

行号以这份副本为准。

- desired 的 `sources.file` 相对抽取用的 `--root`，也就是 `pilot-source/`。所以写成 `ui/app.js`。
- actual 的 `sources.file` 相对本目录。所以写成 `pilot-source/pipeline/api.py`。

## 产物

| 文件 | 怎么来的 |
|---|---|
| `desired.full.ir.json` | 对 `pilot-source/` 跑 `extract-desired` |
| `desired.ir.json` | 从全文收窄到上面 6 条，不改字段、不改路径 |
| `actual.ir.json` | 按路由和 `insights.py` 手写，每条有 `file` + `lineStart` |
| `gap.ir.json` | `build-gap` 的结果，再把 `disposition` 填成 `direct` |
| `skeleton/` | `generate-skeleton`。`client.stub.mjs` 仍是入口骨架，不是完整客户端 |
| `samples/` | 6 条录制/合成响应。顶层键对齐 actual 的 `response.fields`，不是现网抓包 |
| `samples-bad/` | 列表故意缺 `total` 和 `items`，证明 mismatch 能大于 0 |
| `check-contract.log` | 上面两组的校验日志 |
| `lessons.md` | 踩坑 |
| `d1-notes.md` | D1 四项的试点前 / 后 |

## 复跑

在仓库根目录：

```bash
node skills/admin-api-contract/scripts/extract-desired.mjs \
  --root docs/pilots/dingdong-ux-radar-insights/pilot-source \
  --out docs/pilots/dingdong-ux-radar-insights/desired.full.ir.json
```

收窄时只保留这 6 个方法 + 路径，操作对象原样留下：

- `GET /api/facets`
- `GET /api/insights`
- `GET /api/insights/{param}`
- `POST /api/insights/{param}/claim`
- `POST /api/insights/{param}/note`
- `POST /api/insights/{param}/status`

然后：

```bash
node skills/admin-api-contract/scripts/build-gap.mjs \
  --desired docs/pilots/dingdong-ux-radar-insights/desired.ir.json \
  --actual docs/pilots/dingdong-ux-radar-insights/actual.ir.json \
  --out docs/pilots/dingdong-ux-radar-insights/gap.ir.json
```

`build-gap` 会把 `disposition` 写回 `null`。六条再填 `direct`（`exposure` 保持 `null`）之后：

```bash
node scripts/generate-skeleton.mjs \
  --gap docs/pilots/dingdong-ux-radar-insights/gap.ir.json \
  --out-dir docs/pilots/dingdong-ux-radar-insights/skeleton
```

对拍时忽略各文件的 `generatedAt`。

## 切真接口后的校验

不一致数只认下面的 `CONTRACT_SUMMARY`。`gap.ir.json` 里 6 条 `reshape` 是期望侧没抽出响应字段，不是这个数。

样本按 `insights.py` 的返回形状手写，合成数据，没有连雷达。文件名里的下划线会还原成 `/`，`{param}` 保持原样。

在仓库根目录：

```bash
node skills/admin-api-contract/scripts/check-contract.mjs \
  --actual docs/pilots/dingdong-ux-radar-insights/actual.ir.json \
  --samples docs/pilots/dingdong-ux-radar-insights/samples
```

期望退出码 0，标准输出：

```
CONTRACT_SUMMARY mismatch_count=0 warning_count=0 checked=6 error_count=0
```

坏样本（期望退出码 1）：

```bash
node skills/admin-api-contract/scripts/check-contract.mjs \
  --actual docs/pilots/dingdong-ux-radar-insights/actual.ir.json \
  --samples docs/pilots/dingdong-ux-radar-insights/samples-bad
```

```
CONTRACT_MISMATCH op=listInsights method=GET path=/api/insights missing=items,total
CONTRACT_SUMMARY mismatch_count=1 warning_count=0 checked=1 error_count=0
```

雷达测试环境已经起来时，用 `--base http://127.0.0.1:端口` 现场拉。连不上记 `CONTRACT_ERROR`，脚本不崩，这次失败不进 `mismatch_count`。路径参数默认替换成 `sample`，要用真实 id 时加 `--param`。

## 阶段 0→1（已直连后台）

页面早就在调这 6 个真接口。这一阶段的「接到测试环境」不是改 UI，也不是把 `skeleton/` 接回 `pilot-source/ui/app.js`：

- 校验器在本仓库用 Node 跑通，对着 `samples/` 的录制/合成响应。
- 真要打测试环境时，服务在雷达仓里起，再用 `--base`。本目录的 `pilot-source/` 只有 `ui/app.js`、`pipeline/api.py`、`pipeline/insights.py`，没有数据库和包入口，这里不起雷达进程。

这一阶段里约束面和离线预览已经另做，上线还没有：

| 项 | 状态 | 补法 |
|---|---|---|
| 最小约束面 | 已做 | `guardrails/`。不改 `pilot-source/ui/app.js`，存量冻结。见下一节 |
| 离线预览 | 已做（fixture） | `skills/admin-preview-loop`。桌面 + 窄屏截图、漏 mock 冒烟。不是雷达页面 |
| 上线或可合并 | 未做 | 骨架停在 `skeleton/` |

## 最小约束面

规则和基线在 `guardrails/`。不改 `pilot-source/ui/app.js`，存量冻结。复跑命令、三条规则的处数（行内 style 107、游离字号 10、色值字面量 0）写在 `guardrails/README.md`。

```bash
node skills/admin-guardrails/scripts/ratchet.mjs \
  --config docs/pilots/dingdong-ux-radar-insights/guardrails/ratchet.config.json \
  --root docs/pilots/dingdong-ux-radar-insights \
  --report

node skills/admin-guardrails/scripts/ratchet.mjs \
  --config docs/pilots/dingdong-ux-radar-insights/guardrails/ratchet.config.json \
  --root docs/pilots/dingdong-ux-radar-insights
```

## 离线预览

没有给雷达页面接预览，也没有把骨架接回页面。桌面 + 窄屏截图、漏 mock 冒烟，跑的是 `skills/admin-preview-loop` 的 fixture。命令和本轮 PNG 见该 skill 的「本仓库可跑的最小设施」。

## D1 前后

试点前：现网页面和接口已经接在一起，没有独立契约层。契约不一致数不能从校验日志计数（基线 **N/A**，不是「脚手架计数为 0」）。

试点后：`samples/` 的 `mismatch_count=0`（`checked=6`）。这个 0 来自校验日志，不是把 gap 的 reshape 当成 0。`samples-bad/` 的 `mismatch_count=1`。详见 `d1-notes.md`。
