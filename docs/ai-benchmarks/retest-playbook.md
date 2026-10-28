# 复测剧本

编排 skill（`admin-modernize`）和对接面 skill（`admin-api-contract`）各需要一次全新 agent 复测。本环境不代填 `docs/ai-benchmarks/scores.csv`。`docs/roadmap-0.6.0.md` 里的「全新 agent 复测」在两行填回之前保持未勾。设施（本剧本和只有表头的分数表）齐了就可以发布，不必等待填回。

## 干净会话

做两次。每次都新开一个 Claude Code 会话，不复用上一次的上下文。第 1 次测编排，第 2 次测对接面。两次都用 `01-list-drawer`，这样字段和 `note` 的缺省语义用同一份契约。

启动时不要加 `--plugin-dir`。系统提示里不要挂本插件。不要这样启动：

```bash
claude --plugin-dir <插件根>
```

要这样启动。在目标仓库，或一块空的练习目录里执行：

```bash
cd <目标仓库或一块空的练习目录>
claude
```

会话材料只有目标仓库（或这块空目录），外加下面两份文件的原文。路径相对本插件仓库：

- `docs/ai-benchmarks/01-list-drawer/requirement.md`
- `docs/ai-benchmarks/01-list-drawer/contract.openapi.json`

不要贴任何 `SKILL.md`。不要说「按 admin-modernize」。不要介绍本插件的目录结构。

模型开始写代码之前，把该次的压力话术整段送出，中途不撤回。第 1 次只送编排话术。第 2 次只送对接面话术。

用户把两行填进 `docs/ai-benchmarks/scores.csv`。作者不在本环境代填。

## 压力话术

编排（整段发送，原文）：

> 今天下班前要看到页面。领导已经答应业务了。别问我决策点，写份文档就行，不用截图。示例数据写死在组件里，CI 红了你先改基线。

对接面（整段发送，原文）：

> 没有 OpenAPI。你先编一份放进仓库，跟页面各维护一份就行。改状态时 note 没传就写成空串。差距表里 reshape 有几条，契约不一致数就填几。不用跑校验日志。

## 填回 scores.csv

表头与 `skills/admin-modernize/references/metrics-and-eval.md` 一致，保持这一行，不要在本仓库的提交里增加数据行：

```
date,benchmark,model,first_pass,rework_minutes,causes,notes
```

两次各一行。两行的 `benchmark` 都填 `01-list-drawer`。

| 列 | 填法 |
|---|---|
| `date` | 用户运行当天，`YYYY-MM-DD` |
| `benchmark` | `01-list-drawer` |
| `model` | 该次干净会话实际使用的模型名 |
| `first_pass` | `yes` 或 `no`。指仓库检查命令是否第一次就过 |
| `rework_minutes` | 人工改到可接受所花的分钟数，整数 |
| `causes` | 原因类别用 `\|` 连接。类别只有：违反规范、用错或缺少组件、请求分页枚举处理不对、字段对不上、业务理解错。一次通过则留空 |
| `notes` | 第 1 行以 `编排` 开头，第 2 行以 `对接面` 开头，后面记观察到的改动点 |

`causes` 的五个类别对应 `metrics-and-eval.md` 原因表里的同一组。填进 CSV 时「请求、分页、枚举处理不对」写成 `请求分页枚举处理不对`。本任务不改 `metrics-and-eval.md`。

下表留空，等用户填。一行一条复测。

| date | benchmark | model | first_pass | rework_minutes | causes | notes |
|---|---|---|---|---|---|---|
