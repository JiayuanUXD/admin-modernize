# 变更日志

## 0.5.0

### 新增

- `admin-recon` 可选模式 `capabilities.mjs`：按模块列出页面已用接口和数据层方法，每条带 `file:line`。洞察池副本的盘点在 `docs/pilots/dingdong-ux-radar-insights/recon-capabilities.md`。
- `build-gap` 拒绝没有完整 `sources` 的期望或实际能力，不写 gap-table。断言是 `assert-gap-sources.mjs`。
- 拓扑：本仓库、合成单仓、合成分仓各跑通一次。样例树不再参与形态判定。误判写在 `admin-recon` 的「常见错误」。
- 反馈环无 skill 对照：人工清单，见 `skills/admin-preview-loop/baseline-noskill.md`。没有另开 agent。
- `docs/ai-benchmarks/`：3 条脱敏需求、契约片段、空的 `scores.csv`、复测剧本。
- `admin-repo-split` 合成 monorepo。逻辑拆清单在临时目录跑通，`python3 -m git_filter_repo` 在 3 笔合成历史上跑通（3 笔变 2 笔，后端路径被去掉）。无发布节奏和所有权压力时默认仓内隔离。
- `CODEOWNERS`。所有者账号占位。

### 未做

- 编排、对接面的修订版没有用全新 agent 复测。`scores.csv` 只有表头。
- P2-8 MCP exposure、P2-9 第二 adapter、P2-10 多 runtime 包装。进 0.6。

## 0.4.0

- `inventory.mjs --topology` 判单仓或分仓。
- `admin-repo-split` 拆仓 playbook。
- `map-tokens.mjs` 把硬编码值映射到现有 token。
