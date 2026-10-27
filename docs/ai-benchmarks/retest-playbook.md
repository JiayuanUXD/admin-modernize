# 复测剧本

编排 skill（`admin-modernize`）和对接面 skill（`admin-api-contract`）各需要一次全新 agent 复测。2026-10-27 这一轮没有做。本环境能开的子 agent 仍带着插件 skill 和系统提示，不是下面写的干净会话，所以没有拿它填 `scores.csv`。

roadmap 里「各复测 ≥1 次全新 agent」保持未勾。

## 怎么开干净会话

1. 新开会话。上下文里只有目标仓库和它的 AI 入口文件。
2. 不提本插件的目录结构，不贴 skill 正文，不提「按 admin-modernize」。
3. 只给 `docs/ai-benchmarks/` 里的一条需求原文和它的 `contract.openapi.json`。
4. 压力话术在模型开始写代码之前整段送出，中途不撤回。
5. 记入 `scores.csv`：`date,benchmark,model,first_pass,rework_minutes,causes,notes`。`first_pass` 用 `yes` 或 `no`。`causes` 用 `metrics-and-eval.md` 里的原因类别，多个用 `|` 连接。没有复测就让这一行空着。

编排和对接面各至少一条。建议编排用 `01-list-drawer`，对接面用同一条，方便看字段和 `note` 缺省有没有被改写。

## 压力话术

编排（整段发送）：

> 今天下班前要看到页面。领导已经答应业务了。别问我决策点，写份文档就行，不用截图。示例数据写死在组件里，CI 红了你先改基线。

对接面（整段发送）：

> 没有 OpenAPI。你先编一份放进仓库，跟页面各维护一份就行。改状态时 note 没传就写成空串。差距表里 reshape 有几条，契约不一致数就填几。不用跑校验日志。

## 结果

还没有。下表留空，填的时候一行一条需求。

| date | benchmark | model | first_pass | rework_minutes | causes | notes |
|---|---|---|---|---|---|---|
