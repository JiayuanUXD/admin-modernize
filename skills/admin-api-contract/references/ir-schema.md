# 契约 IR

对接面的中间表示是三份 JSON。页面、mock、OpenAPI 都先落到这里，再生成骨架。不在页面里手写第二份契约。

JSON Schema（draft-07）在 `../schemas/`：

| 文件 | Schema |
|---|---|
| `desired-openapi.ir.json` | `schemas/desired.schema.json` |
| `actual-capabilities.ir.json` | `schemas/actual.schema.json` |
| `gap-table.ir.json` | `schemas/gap.schema.json` |

三份文档的顶层都是 `version: "1"`、`generatedAt`（ISO-8601）、`generator`。

## desired-openapi

原型需要的操作。`generator` 通常是 `extract-desired`。

```json
{
  "version": "1",
  "generatedAt": "ISO-8601",
  "generator": "extract-desired",
  "operations": [
    {
      "id": "listOrders",
      "method": "GET",
      "path": "/api/orders",
      "summary": "",
      "request": { "query": {}, "body": null },
      "response": { "fields": ["id", "status"] },
      "sources": [{ "file": "src/pages/orders/index.tsx", "lineStart": 42 }],
      "confidence": "medium"
    }
  ]
}
```

- `confidence`：`high | medium | low`。脚本对字面量 URL 写 `medium`，对模板 URL 写 `low`。`high` 只留给人工改过的条目，脚本不写。
- `sources` 至少一条。`file` 相对扫描根目录，`lineStart` 从 1 起。跨行调用可带 `lineEnd`。能认出外层函数时带 `symbol`。
- 没有出处的接口不许写入。变量拼出来、脚本认不出 URL 的调用直接跳过，不编一条。`build-gap` 若读到空 `sources`、空 `file` 或 `lineStart` 小于 1，退出码 2，不写 gap 文件。

## actual-capabilities

后端已经有的操作。`generator` 是 `from-openapi` 或 `manual`。

```json
{
  "version": "1",
  "generatedAt": "ISO-8601",
  "generator": "from-openapi",
  "operations": [
    {
      "id": "listOrders",
      "method": "GET",
      "path": "/api/orders",
      "sources": [{ "file": "openapi.yaml", "lineStart": 10 }],
      "response": { "fields": ["id", "status", "createdAt"] }
    }
  ]
}
```

从代码或 OpenAPI 抽出时同样必须带 `sources`。`build-gap` 读 OpenAPI JSON 时在内存里做成这种形状，不另写文件；OpenAPI 的 `operationId` 优先，没有才按路径推导。

本切片不解析 YAML。OpenAPI 用 JSON；样例里的 `actual.openapi.yaml` 只给人看。

## gap-table

期望驱动的对照结果。`generator` 是 `build-gap`。实际有、期望没有的接口不进这张表。

```json
{
  "version": "1",
  "generatedAt": "ISO-8601",
  "generator": "build-gap",
  "items": [
    {
      "desiredId": "listOrders",
      "actualId": "listOrders",
      "method": "GET",
      "path": "/api/orders",
      "status": "reshape",
      "notes": "响应字段不一致；实际有而期望无：createdAt",
      "disposition": null,
      "exposure": null
    }
  ]
}
```

对齐键是 **方法 + 规范化路径**（大写方法、前导 `/`、去掉查询串和多余斜杠，`:id` 与 `${id}` 都写成 `{id}`）。

| status | 含义 |
|---|---|
| `match` | 方法、路径相同，响应字段集合相同 |
| `reshape` | 方法、路径相同，响应字段集合不同 |
| `missing` | 期望有，实际没有。`actualId` 为 `null` |

字段集合只比 `response.fields`，忽略顺序。请求体差异写在期望 IR 里，不单独改 status。

`disposition` 一开始必须是 `null`。人工门禁之后才填：

| disposition | 含义 |
|---|---|
| `direct` | 直连，映射层原样透过 |
| `bff` | 在适配层改名、补字段 |
| `pending` | 后端还没有，页面不能假装成功 |

`generate-skeleton` 见到 `null` 或空字符串会以退出码 1 拒绝。

`exposure`：`rest | bff | mcp`。`build-gap` 仍写 `null`，不猜测暴露面。`generate-skeleton` 在 `disposition` 通过之后先去掉首尾空白：缺字段、`null` 和空字符串当作 `rest`；`rest`、`bff`、`mcp` 保持原值；其他值（含 `MCP`、`REST`、`BFF`）退出码 2，不写文件。只为规范化后是 `mcp` 且 `disposition` 为 `direct` 或 `bff` 的项，在同一次成功运行里写入 `mcp-tools.stub.mjs`。`pending` 且 `mcp` 不发布工具，`pending.md` 注明原因。`exposure: bff` 不改变 `disposition: bff` 的映射语义。页面路径仍走数据层，不读取该 stub。

## 脚本怎么规范化

`extract-desired` 与 `build-gap` 用同一套路径和 id 规则，样例的期望输出按这个对齐。

路径：去掉域名和查询串，补前导 `/`，合并重复斜杠，去掉末尾 `/`。模板 `${id}` 和 `:id` 都写成 `{id}`。查询键进 `request.query`，不进路径。

`id`：去掉 `api` / `v1` / `v2` / `v3` 段。GET 集合是 `list` + 资源名，GET 单项（末段是参数）是 `get` + 单数资源名，POST 是 `create`，PUT / PATCH 是 `update`，DELETE 是 `delete`。只对末段资源做简单英文单数；`status`、`stats`、`address` 等不再砍 `s`。同一轮里 id 撞了，后一条加 `_2`。OpenAPI 有 `operationId` 时 actual 侧用它，不重新推导。

响应字段：调用点之后有限几行里的 `res.data.<字段>`、`res.data.list.map(row => row.<字段>)`、`.then(data => data.<字段>)`，以及调用行上的 `response: a, b` 注释。字面量对象的键当作请求体。直接 `const row = await get(...)` 再读 `row.id` 的写法目前收不到字段。认不出的 URL 跳过。同一方法 + 路径的多次调用合并成一条，字段取并集，只要有一次是模板或拼接，置信度就是 `low`。

薄封装默认名单在 `scripts/extract-desired.mjs` 的 `THIN_CALLS` / `THIN_API`，说明见 `scripts/README.md`：

| 形态 | 调用 | 方法 |
|---|---|---|
| 无请求体 | `get(url)` / `delete(url)` | GET / DELETE |
| 第二参是请求体 | `post(url, body)` / `put` / `patch` | POST / PUT / PATCH |
| 方法字面量 | `api('METHOD', url, body?)` | METHOD 必须是字符串字面量 |

axios / fetch / `$.ajax` 仍按原来的规则。同形态的别名加进名单；参数位置不同要改扫描分支，不要靠猜 URL，也不要把业务函数名写进名单。

URL 除了字符串和模板，还认以路径字面量开头的 `+` 拼接。静态片段保留，其余动态片段收成 `{param}`。`${encodeURIComponent(id)}` 这种不是裸标识符的插值同样收成 `{param}`，不猜成 `{id}`。下面三种直接跳过，不编接口：整段都是变量；`api` 的方法不是字符串字面量；拼接里夹了三元表达式（看不清后面是路径还是查询串）。

`generatedAt` 是写出时的当前时间。和样例对拍时忽略它。
