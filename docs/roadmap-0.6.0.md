# admin-modernize 0.6.0 改进清单

版本主题：**可信度收口 + 加载说明、暴露面、第二栈**。版本号 **0.6.0**。

依据：`docs/superpowers/specs/2026-10-28-admin-modernize-0.6-design.md`。

0.5.0 路线图里 P2 的 8、9、10 仍写「进 0.6，本轮不做」。完成态写在本文件。不回去改 `docs/roadmap-0.5.0.md` 的勾选。

## 1. 复测包

剧本和 `docs/ai-benchmarks/scores.csv` 已经可以独立使用。2026-10-28 已填回编排、对接面两行（干净 Claude Code 会话，无本插件 skill，模型 `claude-sonnet-5-5`），下面这一项已勾。

- [x] 全新 agent 复测：用户已把编排与对接面两行填回 `docs/ai-benchmarks/scores.csv`，且不是在带本插件 skill 的会话里产生的

## 2. P2-10 多 runtime 加载说明

- [x] `docs/runtime-loading.md` 写明 Claude Code `--plugin-dir`、Cursor 打开本仓库、其他 agent 按 `skills/*/SKILL.md` 加载
- [x] 七个 skill 的 YAML `description` 保持 `Use when` 触发条件

## 3. P2-8 MCP 暴露面

- [x] `generate-skeleton` 把缺省 `exposure` 当作 `rest`，非法值退出码 2 且不写文件
- [x] `mcp` 且 `disposition` 为 `direct` 或 `bff` 的项写入 `mcp-tools.stub.mjs`；页面路径仍走数据层
- [x] `skills/admin-api-contract/scripts/assert-exposure.mjs` 覆盖合法五条、`graphql`、空字符串

## 4. P2-9 Vue 2 + Element UI

- [x] `adapters/vue2-element/` 含 `README.md`、`ratchet.config.json`、`kit-manifest.md` 和 `fixtures/pages/`
- [x] `ratchet.mjs --report` 的处数与文件数等于 E1 2/2、E2 1/1、E3 2/2、E4 2/2、E5 1/1

## 5. 版本卫生

- [x] `.claude-plugin/plugin.json` 的 `version` 为 `0.6.0`，名称、描述、作者未改
- [x] `CHANGELOG.md` 有 `## 0.6.0`，并写明 `scores.csv` 仍只有表头、复测未勾
- [x] README 现状是 0.6.0；薄数据层当前状态写已经合并；链到 `docs/runtime-loading.md` 和 `adapters/vue2-element/`
