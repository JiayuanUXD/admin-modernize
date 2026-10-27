# 无出处不得进 gap-table

`build-gap` 在写文件之前检查期望和实际的每条操作。`sources` 缺失、空数组、空 `file`、或 `lineStart` 小于 1，都退出码 2，并且不创建 `--out`。

| 文件 | 作用 |
|---|---|
| `desired-ok.ir.json` | 有出处，对照用 |
| `actual-ok.ir.json` | 有出处，和上面是同一条 `GET /api/items` |
| `desired-no-source.ir.json` | `sources` 是空数组 |
| `desired-bad-line.ir.json` | `lineStart` 为 0 |
| `actual-no-source.ir.json` | 实际能力没有 `sources` |

在仓库根目录：

```bash
node skills/admin-api-contract/scripts/assert-gap-sources.mjs
```

标准输出三行 `rejected`，一行 `accepted`。退出码 0。
