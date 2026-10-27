# D1 笔记

指标定义见 `skills/admin-modernize/SKILL.md` 的 D1：每页人工返工时长、首次检查通过率、接后端耗时、对接时发现的契约不一致数。

本插件仓没有改 `pilot-source/`。内网仓 `dingdong-ux-radar` 分支 `feat/insights-thin-api` 已用薄数据层接回 6 个调用点（用户本机已提交，尚未 push）。已直连后台的「接测试环境」仍是：本地跑 `check-contract`，对着录制/合成响应；雷达进程不在这份副本里起。能记的是校验日志和契约流水线，不是上线前后的计时。

| 指标 | 试点前 | 试点后 |
|---|---|---|
| 每页人工返工时长 | 未测量。现网洞察池页面已经在用，没有「新生成一页再改」的样本 | 未测量。没有改 `pilot-source/ui/app.js`，也没有新页面 |
| 首次检查通过率 | 未测量。这个后台没有接上约束面检查 | 未测量。棘轮只冻结了副本存量（117 处），没有「新生成一页再检查」的通过率。截图跑的是 preview-loop fixture，不是雷达页面 |
| 接后端耗时 | 不适用作为新对接耗时：页面与 `get` / `post` 已经接在真实接口上 | 未在本目录产生新的联调计时。雷达本机分支已用薄层接回，行为与接回前一致（disposition 仍是 `direct`）。`pilot-source/` 仍是接回前快照 |
| 对接时发现的契约不一致数 | 不能从校验日志计数。没有开发态响应校验。基线记 **N/A**，不记成 0 | **可计数。** `samples/` 跑 `check-contract`：`CONTRACT_SUMMARY mismatch_count=0 warning_count=0 checked=6 error_count=0`。`samples-bad/`：`mismatch_count=1`（缺 `items,total`）。日志在 `check-contract.log` |

gap 仍是 6 条 `reshape`、0 条 `missing`、`disposition` 全是 `direct`。这是期望侧没抽出响应字段，**不计入**上一行的不一致数。不一致数只认 `mismatch_count`。

P0-3 里最小约束面和 fixture 离线预览已做。已直连这一段以校验器 + 录制响应为准。「上线或可合并」已勾：可合并材料在雷达本机分支 `feat/insights-thin-api`，内网 GitLab MR 由用户决定何时 push。阶段 0→1 子项齐，业务仓 MR 未开。见 `docs/roadmap-0.5.0.md`。
