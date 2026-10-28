# 基准需求

三条脱敏页面规格，给阶段 2 的评测用。契约是片段，不是完整后端。分数表目前只有两行无 skill 基线（没加载插件）；带 skill 的两行于 2026-10-28 补测。剧本在 `retest-playbook.md`，可以不看插件内部讨论，按里面的步骤开干净会话。`scores.csv` 只有表头，等用户填回；作者不在本仓库代填。

| 目录 | 页面 | 契约 |
|---|---|---|
| `01-list-drawer/` | 反馈条目列表 + 详情抽屉 | `contract.openapi.json` |
| `02-list-dialog/` | 订单列表 + 备注弹窗 | `contract.openapi.json` |
| `03-form/` | 登记表单 | `contract.openapi.json` |

`01-list-drawer` 从洞察池试点裁下来，去掉了产品名和公司名。状态接口里「没传 note」和「传空串」仍是两件事。`02` 和 `03` 是按同一口径写的合成需求，字段能对上 `admin-api-contract` 样例里的路径习惯，但不是那份样例的拷贝。

评分表字段见 `skills/admin-modernize/references/metrics-and-eval.md`：`date,benchmark,model,first_pass,rework_minutes,causes,notes`。文件是 `scores.csv`，`notes` 以「无 skill 基线」或「带 skill」开头区分两组。填回方式见 `retest-playbook.md`。
