# sample-app

给 `extract-desired` / `build-gap` 用的合成前端，不是真实业务。

| 文件 | 作用 |
|---|---|
| `src/pages/orders/index.tsx` | `axios.get` / `axios.post` / 模板 URL |
| `src/services/orders-api.js` | `$.ajax` 与 `fetch`（和列表接口合并） |
| `src/mocks/orders.mock.js` | 纯字段对照，没有调用点，不应被抽成接口 |
| `actual.openapi.json` | 脚本读的 OpenAPI 3 JSON |
| `actual.openapi.yaml` | 同一份契约的对照，脚本不解析 YAML |
| `expected/` | 黄金输出。`generatedAt` 固定成 `2026-01-01T00:00:00.000Z`，对拍时忽略它 |

## 大致条数

期望 4 条：

| id | 方法 + 路径 | 置信度 | 响应字段 | 差距 |
|---|---|---|---|---|
| `listOrders` | `GET /api/orders` | medium（两处来源：axios 与 fetch） | `id`, `status` | reshape：实际多 `createdAt` |
| `createOrder` | `POST /api/orders` | medium | `id`, `note`, `status` | reshape：实际没有 `note` |
| `getOrder` | `GET /api/orders/{id}` | low（模板 URL） | `id`, `status` | missing：实际没有这条 |
| `listOrdersStats` | `GET /api/orders/stats` | medium | `count` | match |

差距合计：reshape 2、missing 1、match 1。`disposition` 与 `exposure` 都是 `null`。

对齐规则见 `../../references/ir-schema.md` 的「脚本怎么规范化」。

## 对拍

在仓库根目录：

```bash
node skills/admin-api-contract/scripts/extract-desired.mjs \
  --root skills/admin-api-contract/fixtures/sample-app \
  --out /tmp/desired.ir.json
node skills/admin-api-contract/scripts/build-gap.mjs \
  --desired /tmp/desired.ir.json \
  --actual skills/admin-api-contract/fixtures/sample-app/actual.openapi.json \
  --out /tmp/gap.ir.json
```

标准输出各是写出的路径。`build-gap` 的标准错误是 `match N，reshape N，missing N`。

忽略 `generatedAt` 之后，两份输出应与 `expected/` 一致。
