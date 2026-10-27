# 踩坑

改的是抽取脚本和这篇记录，不是雷达那一页。

## 包装层

`ui/app.js` 的请求几乎都是 `get(path)` / `post(path, body)` / `api(method, path, body)`。真正的 `fetch(path)` 在包装函数里，`path` 是参数。只认 `axios` / `fetch` / `$.ajax` 时，对这个目录抽出来是 0 条。

默认名单是 `get` / `delete`、`post` / `put` / `patch`、`api(方法字面量, url, body?)`。同形态的别名加进 `THIN_CALLS` 或 `THIN_API`。业务函数名不要写进名单。

URL 还认「以路径字面量开头的拼接」。`'/api/insights/' + encodeURIComponent(id)` 收成 `/api/insights/{param}`。`` `/api/insights/${encodeURIComponent(id)}/claim` `` 同样是 `{param}`，因为插值不是裸标识符。不把 `{param}` 改写成 `{id}`。

下面几种跳过，不编接口：

- `fetch(path)`、`get(path)`、`api('GET', path)` 这种整段变量
- `api(method, url)` 的方法不是字符串字面量
- 拼接里夹了三元表达式。追踪项详情是 `'/api/trackers/' + encodeURIComponent(id) + (version ? '?version=' + … : '')`。看不清后半段是路径还是查询串，整段跳过。它不在这 6 条里，全文对照里也没有一条编出来的 `/api/trackers/{id}`

主列表是 `get('/api/insights?' + p.toString())`，筛选键在 `URLSearchParams` 里，抽不到。命令面板那次写成了 `'/api/insights?q=' + … + '&page_size=6'`，所以合并后的 query 只有 `q` 和 `page_size`。没有按 `api.py` 头注释把筛选参数补进 desired。

请求体只收对象字面量的键。`{ note: $('#dnote').value, actor }` 的键是 `note` 和 `actor`，不是 `value`。

响应字段仍只认 `res.data.<字段>` 这一路。这个页面是 `const d = await get(...)` 然后直接读 `d`，所以 6 条 desired 的 `response.fields` 都是空的。

`sources.symbol` 取调用点前面最近的函数。备注保存写在 `drawDrawer` 里、`const claimTo = …` 之后的点击监听器上，symbol 会落成 `claimTo`。对行号以 `file` + `lineStart` 为准。

## 没有 OpenAPI

`api.py` 开头的注释是接口一览，不是可解析的契约。本切片不编一份 OpenAPI 来凑 `build-gap`。

actual IR 手写，`generator` 是 `manual`。每条至少一处路由（`api.py` 的 `dispatch` / `_command`）和一处实现（`insights.py` 的 `list_insights` / `facets` / `get_insight` / `claim` / `set_status` / `set_note`）。行号指 `pilot-source/` 这份副本。

`response.fields` 写的是该接口返回 JSON 的顶层键，不是列表元素内部的字段。

## status / note

`insights.set_status` 把 `note is None` 和 `note == ""` 分开：没传备注就不动原来的备注，传空串才清空。`api.py` 用 `body.get("note")`，不用 `body.get("note", "")`。

页面上两处改状态故意不带 `note`（列表菜单、抽屉里的状态下拉），标「不处理」那次才带 `note`。抽取把这些调用并成一条，请求体里看得到 `note`，但看不出「缺省」和「空串」不是一回事。

`set_note` 不是这套语义：它总是写入 `note`。`claim` 的 `note` 缺省走空串，再收成「没有备注」，也和 `set_status` 不同。适配层不能把三种缺省收成一种。

差距表的 `status` 六条都是 `reshape`，因为期望侧字段为空、实际侧有顶层键。`disposition` 仍填 `direct`：页面已经在调这些接口，不是缺后端，也不该为了字段没抽出来就生成一层 BFF。

## 不一致数

D1 的契约不一致数不是这 6 条 reshape。reshape 只说明抽取没看见 `res.data.<字段>`，而页面是直接读返回值。

切真接口之后跑 `check-contract`，读 `CONTRACT_SUMMARY` 的 `mismatch_count`。它只比 actual（优先于 desired）`response.fields` 的顶层键：缺字段算 1 条 mismatch，多余字段是 warning，不算不一致。`samples/` 是按 `insights.py` 返回形状写的合成响应，汇总是 `mismatch_count=0`、`checked=6`。`samples-bad/` 故意拿掉列表的 `total` 和 `items`，汇总是 `mismatch_count=1`。

已直连的后台，「接到测试环境」是本地把校验器跑起来，对着录制响应或已经起来的 `--base`。副本里没有数据库，不起雷达进程。连不上记 `CONTRACT_ERROR`，不要把拉失败算进 mismatch。

## 接回薄数据层

雷达页面没有打包步骤。`ui/index.html` 按顺序加载普通脚本。`skeleton/client.stub.mjs` 是 ESM，这种仓库收不了 `export`，不能把 stub 文件原样丢进页面。

`createStubClient` 的每个方法都会 `throw new Error('stub client: … 未接数据层')`。那是占住方法名的入口，不是可以上线的实现。接回时要换成真正打到现有 `get` / `post` 的函数。

薄层挂在页面已经在用的 `get` / `post` 上，不另起一套请求。方法名与 `client.stub.mjs` 的 `operations` 对齐，才好和骨架对账。洞察池这一例是 `createInsightsApi(get, post)`，六个名字是 `listFacets`、`listInsights`、`getInsight`、`createInsightsClaim`、`createInsightsNote`、`createInsightsStatus`。只把这 6 个调用点改到薄层；bulk、flag、tag、severity、owner-loads 仍直接调。`index.html` 先加载 `insights-api.js`，再加载 `app.js`。

这发生在内网仓 `dingdong-ux-radar` 的分支 `feat/insights-thin-api`（用户本机已提交，尚未 push，没有 MR）。本目录的 `pilot-source/` 仍是接回前快照。disposition 仍是 `direct`。
