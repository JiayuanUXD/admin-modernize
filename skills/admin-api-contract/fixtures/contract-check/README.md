# contract-check

给 `check-contract` 用的最小契约和响应。不是真实业务。

| 目录 | 期望 |
|---|---|
| `good/` | 两条响应都含齐 `response.fields`。`mismatch_count=0`，退出码 0 |
| `bad/` | `GET /api/orders` 缺 `status`，多 `note`。`mismatch_count=1`，`warning_count=1`，退出码 1 |

`good/desired.ir.json` 的列表多要求一个 `note`。和 actual 一起传入时以 actual 为准，好样本仍然全过。只传 desired 则会缺字段。

顶层键按字母序写进 `missing=` / `extra=`。不比较嵌套字段。

## 对拍

在仓库根目录：

```bash
node skills/admin-api-contract/scripts/check-contract.mjs \
  --actual skills/admin-api-contract/fixtures/contract-check/good/actual.ir.json \
  --samples skills/admin-api-contract/fixtures/contract-check/good/samples

node skills/admin-api-contract/scripts/check-contract.mjs \
  --actual skills/admin-api-contract/fixtures/contract-check/bad/actual.ir.json \
  --samples skills/admin-api-contract/fixtures/contract-check/bad/samples
```

好样本再加 desired，仍应是 `mismatch_count=0`：

```bash
node skills/admin-api-contract/scripts/check-contract.mjs \
  --actual skills/admin-api-contract/fixtures/contract-check/good/actual.ir.json \
  --desired skills/admin-api-contract/fixtures/contract-check/good/desired.ir.json \
  --samples skills/admin-api-contract/fixtures/contract-check/good/samples
```

好样本的标准输出只有一行：

```
CONTRACT_SUMMARY mismatch_count=0 warning_count=0 checked=2 error_count=0
```

坏样本：

```
CONTRACT_MISMATCH op=listOrders method=GET path=/api/orders missing=status
CONTRACT_WARNING op=listOrders method=GET path=/api/orders extra=note
CONTRACT_SUMMARY mismatch_count=1 warning_count=1 checked=1 error_count=0
```
