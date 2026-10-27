# thin-wrappers

给 `extract-desired` 用的合成前端，演示洞察池那种薄封装。不是真实业务。

| 文件 | 作用 |
|---|---|
| `src/insights-client.js` | `get` / `post` / `api('POST', …)`，以及字符串拼接、模板 URL |
| `expected/desired.ir.json` | 黄金输出。`generatedAt` 固定成 `2026-01-01T00:00:00.000Z`，对拍时忽略它 |

内部的 `fetch(path)`、`api(method, path)`、`get(path)`、`post(path, …)` 的 URL 是变量，必须跳过。注释里的调用必须跳过。带三元表达式的拼接（`version ? '?version=' + … : ''`）看不清是路径还是查询串，也必须跳过，不编接口。

`loadInsight` 里的 `row.id` / `row.status` 不会出现在响应字段里。抽取仍只认 axios 风格的 `res.data`，这是已知缺口。

## 大致条数

期望 7 条，置信度都是 `low`（拼接或模板）：

| id | 方法 + 路径 | 请求体 |
|---|---|---|
| `listFacets` | `GET /api/facets` | 无 |
| `listInsights` | `GET /api/insights` | 无 |
| `createInsightsNote` | `POST /api/insights/{id}/note` | `actor`, `note` |
| `createInsightsStatus` | `POST /api/insights/{id}/status` | `actor`, `status_id` |
| `getInsight` | `GET /api/insights/{param}` | 无 |
| `createInsightsClaim` | `POST /api/insights/{param}/claim` | `actor`, `note`, `owner` |
| `createSamplesReview` | `POST /api/samples/{param}/review` | `verdict` |

`${id}` 收成 `{id}`。`${encodeURIComponent(id)}` 和 `'…' + id` 收成 `{param}`，不猜名字。

## 对拍

在仓库根目录：

```bash
node skills/admin-api-contract/scripts/extract-desired.mjs \
  --root skills/admin-api-contract/fixtures/thin-wrappers \
  --out /tmp/thin-desired.ir.json
```

忽略 `generatedAt` 之后，输出应与 `expected/desired.ir.json` 一致。

`sample-app` 的 axios / fetch / `$.ajax` 对拍见 `../sample-app/README.md`，两条命令的结果不能变。
