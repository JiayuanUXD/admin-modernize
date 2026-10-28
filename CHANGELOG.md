# 变更日志

## 0.6.0

### 新增

- 复测包：`docs/ai-benchmarks/retest-playbook.md` 可以单独开跑（干净会话步骤、两段压力话术、填表说明）。2026-10-28 填回两条 `01-list-drawer`（编排 + 对接面），来自干净 Claude Code 会话（模型 `claude-sonnet-5-5`）。
- `docs/runtime-loading.md`：Claude Code 仍用 `--plugin-dir`。Cursor 与其他 agent 把本目录当 skills 加载。没有新的 Cursor 包。
- `scripts/generate-skeleton.mjs` 在 disposition 通过后解释 `exposure`：缺字段、`null` 和空字符串当作 `rest`；只为 `mcp` 且 `direct` 或 `bff` 的项写入 `mcp-tools.stub.mjs`；非法值退出码 2，不写文件。`pending` 且 `mcp` 不发布工具，并在 `pending.md` 注明。
- `adapters/vue2-element/`：Vue 2 + Element UI 的棘轮规则、标准件清单和合成夹具。`--report` 的五条数字是 E1 2/2、E2 1/1、E3 2/2、E4 2/2、E5 1/1。

### 未做

- 不另起 MCP server 进程，不新增真实 Vue 2 试点仓库。

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
