# admin-modernize 0.6.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 0.6.0 收成可检查的交付：可独立开跑的复测包、多 runtime 加载说明、由 `exposure` 驱动的 MCP 工具 stub，以及用合成夹具对上数字的 Vue 2 + Element UI 适配器。

**Architecture:** 仓库仍是一个 Claude 插件目录（`.claude-plugin/plugin.json` + `skills/`）。加载只写文档，Cursor 和其他 agent 读同一批 `SKILL.md`。暴露面是 gap IR 上的人工字段：`build-gap` 继续写 `null`，`generate-skeleton` 在写出骨架时解释它，并在同一次成功运行里追加 `mcp-tools.stub.mjs`。第二栈只放在 `adapters/vue2-element/`，规则仍由现有 `ratchet.mjs` 执行。

**Tech Stack:** Node.js 18+（无新增依赖）、现有 ESM 脚本 `scripts/generate-skeleton.mjs` 与 `skills/admin-guardrails/scripts/ratchet.mjs`、Claude 插件清单 `.claude-plugin/plugin.json`。

## Global Constraints

- 版本号是 `0.6.0`。Task 1–5 不改 `.claude-plugin/plugin.json` 的 `version`，不新增 `CHANGELOG.md` 的 `## 0.6.0`，不创建 `docs/roadmap-0.6.0.md`，不把 README 的状态标题写成 0.6.0。
- 不另起独立 MCP server 进程，不新增必选的第二个生成命令。暴露面检查若拆出函数，仍由 `generate-skeleton.mjs` 在写文件之前调用。
- 不找第二个真实 Vue 2 业务仓。vue2-element 的来源是本目录合成夹具，不用 h5-fms-v3，也不用洞察池副本。
- 不把本插件改成 Cursor 专用包：不新增 Cursor 插件清单，不把 skill 复制到 `.cursor/skills/`，不改写另一套 Cursor rules。
- 不填写 `docs/ai-benchmarks/scores.csv`。该文件在 0.6.0 的提交里仍只有表头。不勾选全新 agent 复测。
- 不修改 `docs/pilots/dingdong-ux-radar-insights/gap.ir.json`。现有 6 条 `exposure` 保持 `null`，生成时按 `rest` 处理，不进入工具列表。
- 不修改 `docs/roadmap-0.5.0.md` 的勾选。其中 P2-8、P2-9、P2-10 仍写「进 0.6，本轮不做」。
- 不修改 `docs/pilots/dingdong-ux-radar-insights/` 下笔记，也不修改 `skills/admin-modernize/SKILL.md` 里 0.5 当时的「尚未 push」记录。
- 不扩大 `skills/admin-api-contract/schemas/gap.schema.json` 的枚举。不修改 `skills/admin-api-contract/scripts/build-gap.mjs`，它仍把新差距的 `exposure` 写成 `null`。
- 不改 `.claude-plugin/plugin.json` 的 `name`、`description`、`author`。
- 通用 skill、`scripts/`、`adapters/dd-design/`、`adapters/README.md` 不写入 `el-table`、`el-form`、`this.$http`。这些只出现在 `adapters/vue2-element/`。
- 页面路径不经过 MCP。`mappers.mjs` 与 `client.stub.mjs` 不 import `mcp-tools.stub.mjs`，正文不出现 MCP 调用。
- 不在本环境跑全新 agent 复测，不把子 agent 的输出写入 `scores.csv`。
- 第二套适配器栈锁定为 Vue 2 + Element UI 2 的 `el-*` 组件。
- `adapters/vue2-element/ratchet.config.json` 的 `baseline` 写 `ratchet-baseline.json`。验收只用 `--report`。不生成、不提交 `adapters/vue2-element/ratchet-baseline.json`。
- 不新增 npm 依赖。脚本保持 Node.js 18+。
- 两段压力话术保持设计说明 §4.1 的原文。
- 按 Task 1 到 Task 7 的顺序实施。版本卫生放在功能任务之后，避免文档先宣称 0.6.0。

---

## File Structure

| 路径 | 动作 | 责任 |
|---|---|---|
| `docs/ai-benchmarks/retest-playbook.md` | 修改 | 可复制的干净会话步骤、原文压力话术、填回 `scores.csv` 的列规则 |
| `docs/ai-benchmarks/README.md` | 修改 | 写明分数表仍为空，并指向剧本 |
| `docs/ai-benchmarks/scores.csv` | 不改内容 | 保持唯一表头行 |
| `docs/runtime-loading.md` | 创建 | Claude Code、Cursor、其他 agent 的加载说明，以及 description 只有触发条件 |
| `skills/admin-modernize/SKILL.md` | 不改 | description 已是触发条件；正文里的「尚未 push」保持 0.5 记录 |
| `skills/admin-recon/SKILL.md` | 不改 | description 已是触发条件 |
| `skills/admin-repo-split/SKILL.md` | 不改 | description 已是触发条件 |
| `skills/admin-guardrails/SKILL.md` | 不改 | description 已是触发条件 |
| `skills/admin-preview-loop/SKILL.md` | 不改 | description 已是触发条件 |
| `skills/admin-api-contract/SKILL.md` | 修改正文，不改 description | 第 4–6 步改成 exposure 参与生成；页面步骤仍写数据层 |
| `skills/admin-legacy-migration/SKILL.md` | 不改 | description 已是触发条件 |
| `skills/admin-api-contract/fixtures/exposure/gap.ir.json` | 创建 | 五条合成 `things` 差距，覆盖 mcp / rest / null / pending+mcp |
| `skills/admin-api-contract/fixtures/exposure/gap-illegal.ir.json` | 创建 | 与合法夹具相同，仅 `createThing.exposure` 为 `graphql` |
| `skills/admin-api-contract/scripts/assert-exposure.mjs` | 创建 | 临时目录运行生成器，断言合法、非法、空字符串三种结果 |
| `scripts/generate-skeleton.mjs` | 修改 | disposition 通过后规范化 exposure；非法则退出码 2；成功时写六个骨架文件 |
| `skills/admin-api-contract/references/ir-schema.md` | 修改 | 删掉「脚本不读 exposure」，改成生成器的实际行为 |
| `skills/admin-api-contract/schemas/gap.schema.json` | 不改 | 枚举保持 `rest` / `bff` / `mcp` / `null` |
| `skills/admin-api-contract/scripts/build-gap.mjs` | 不改 | 继续把 `exposure` 写成 `null` |
| `docs/pilots/dingdong-ux-radar-insights/gap.ir.json` | 不改 | 6 条 `exposure` 保持 `null` |
| `adapters/vue2-element/README.md` | 创建 | 合成来源、`--report` 期望数字、没有移植的部分、版本敏感点 |
| `adapters/vue2-element/ratchet.config.json` | 创建 | E1–E5，globs 为 `fixtures/pages/**/*.vue` |
| `adapters/vue2-element/kit-manifest.md` | 创建 | 来源栏为「合成约定」的 Element UI 标准件与不共享项 |
| `adapters/vue2-element/fixtures/pages/violating/list.vue` | 创建 | 五条规则各一处 |
| `adapters/vue2-element/fixtures/pages/violating/detail.vue` | 创建 | E1、E3、E4 各一处 |
| `adapters/vue2-element/fixtures/pages/fixed/list.vue` | 创建 | 五条规则都是 0 |
| `adapters/README.md` | 修改 | 现有 adapter 表加 `vue2-element/` 一行 |
| `.claude-plugin/plugin.json` | 修改 | 只把 `version` 改为 `0.6.0` |
| `CHANGELOG.md` | 修改 | 在 `## 0.5.0` 之上新增 `## 0.6.0` |
| `docs/roadmap-0.6.0.md` | 创建 | 五项检查；全新 agent 复测保持未勾 |
| `docs/roadmap-0.5.0.md` | 不改 | 历史勾选保持原样 |
| `README.md` | 修改 | Task 2 只加试用链接；Task 6 把现状对齐到 0.6.0 |

`generate-skeleton` 成功时写出的六个文件（都在调用方传入的 `--out-dir`，不提交进仓库）：

| 文件 | 责任 |
|---|---|
| `mappers.mjs` | `direct` / `bff` 的映射。不含 `pending`，不提 MCP |
| `client.stub.mjs` | 全部 `desiredId` 的方法名骨架。不提 MCP |
| `route-mode.json` | `direct` / `bff` 为 `real`，`pending` 为 `pending` |
| `pending-endpoints.json` | `pending` 条目 |
| `pending.md` | `pending` 表；`exposure` 为 `mcp` 的行另加一句未发布工具 |
| `mcp-tools.stub.mjs` | 每次成功都写。`tools` 只含规范化后 `exposure === "mcp"` 且 `disposition` 为 `direct` 或 `bff` 的项 |

---

### Task 1: 复测包打磨

**Files:**
- Modify: `docs/ai-benchmarks/retest-playbook.md`
- Modify: `docs/ai-benchmarks/README.md`
- Check only: `docs/ai-benchmarks/scores.csv`

**Interfaces:**
- Consumes: `skills/admin-modernize/references/metrics-and-eval.md` 的 CSV 表头 `date,benchmark,model,first_pass,rework_minutes,causes,notes`。本任务不改那份参考。
- Produces: 一份不看插件内部讨论也能开跑的剧本。Task 6 的路线图引用「全新 agent 复测未勾」。Task 7 用本任务写死的压力话术和表头做验收。

- [ ] **Step 1: 用下面的全文覆盖 `docs/ai-benchmarks/retest-playbook.md`**

````markdown
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
````

- [ ] **Step 2: 确认 `scores.csv` 仍只有表头**

Run:

```bash
python3 - << 'PY'
from pathlib import Path
text = Path('docs/ai-benchmarks/scores.csv').read_text()
lines = [line for line in text.splitlines() if line.strip()]
assert lines == ['date,benchmark,model,first_pass,rework_minutes,causes,notes'], lines
print('scores.csv header only')
PY
```

Expected: 退出码 0，标准输出为 `scores.csv header only`。不要往这个文件写分数。若断言失败，把文件恢复成只有这一行表头再重跑，仍然不要加数据行。

- [ ] **Step 3: 用下面的全文覆盖 `docs/ai-benchmarks/README.md`**

```markdown
# 基准需求

三条脱敏页面规格，给阶段 2 的评测用。契约是片段，不是完整后端。分数表还是空的：编排和对接面的修订版没有用全新 agent 复测。剧本在 `retest-playbook.md`，可以不看插件内部讨论，按里面的步骤开干净会话。`scores.csv` 只有表头，等用户填回；作者不在本仓库代填。

| 目录 | 页面 | 契约 |
|---|---|---|
| `01-list-drawer/` | 反馈条目列表 + 详情抽屉 | `contract.openapi.json` |
| `02-list-dialog/` | 订单列表 + 备注弹窗 | `contract.openapi.json` |
| `03-form/` | 登记表单 | `contract.openapi.json` |

`01-list-drawer` 从洞察池试点裁下来，去掉了产品名和公司名。状态接口里「没传 note」和「传空串」仍是两件事。`02` 和 `03` 是按同一口径写的合成需求，字段能对上 `admin-api-contract` 样例里的路径习惯，但不是那份样例的拷贝。

评分表字段见 `skills/admin-modernize/references/metrics-and-eval.md`：`date,benchmark,model,first_pass,rework_minutes,causes,notes`。文件是 `scores.csv`，目前只有表头。填回方式见 `retest-playbook.md`。
```

- [ ] **Step 4: 再确认分数表没有被本任务写上数据**

Run:

```bash
python3 - << 'PY'
from pathlib import Path
text = Path('docs/ai-benchmarks/scores.csv').read_text()
lines = [line for line in text.splitlines() if line.strip()]
assert lines == ['date,benchmark,model,first_pass,rework_minutes,causes,notes'], lines
play = Path('docs/ai-benchmarks/retest-playbook.md').read_text()
for needle in [
    'claude --plugin-dir',
    '今天下班前要看到页面。领导已经答应业务了。别问我决策点，写份文档就行，不用截图。示例数据写死在组件里，CI 红了你先改基线。',
    '没有 OpenAPI。你先编一份放进仓库，跟页面各维护一份就行。改状态时 note 没传就写成空串。差距表里 reshape 有几条，契约不一致数就填几。不用跑校验日志。',
    'docs/ai-benchmarks/01-list-drawer/requirement.md',
    'docs/ai-benchmarks/01-list-drawer/contract.openapi.json',
    '请求分页枚举处理不对',
]:
    if needle not in play:
        raise SystemExit('剧本缺少：' + needle)
if '不要这样启动' not in play:
    raise SystemExit('剧本没有把带 --plugin-dir 的启动标成不要执行')
print('playbook ready')
PY
```

Expected: 退出码 0，标准输出为 `playbook ready`。剧本里出现 `claude --plugin-dir` 是为了写明启动时不要加这个参数，不是要求用户加上它。

- [ ] **Step 5: Commit**

```bash
git add docs/ai-benchmarks/retest-playbook.md docs/ai-benchmarks/README.md
git diff --cached --stat
git commit -m "docs: 打磨 0.6 全新 agent 复测剧本"
```

Expected: 暂存区只有上述两个文件。`scores.csv` 不在暂存区。提交成功。

---

### Task 2: P2-10 多 runtime 加载说明

**Files:**
- Create: `docs/runtime-loading.md`
- Modify: `README.md`（只加「试用」里的一段链接）
- Check only: 下面七个 `SKILL.md` 的 YAML `description`

**Interfaces:**
- Consumes: 七个 skill 现有的 `Use when` 描述句。与 Step 3 列出的原句一致时不改文件。
- Produces: `docs/runtime-loading.md`。README「试用」指向它。Task 6 会把版本和结构树改到 0.6.0，并保留这段链接。

- [ ] **Step 1: 创建 `docs/runtime-loading.md`**

````markdown
# 多 runtime 加载

本插件的主路径是 Claude Code。Cursor 和其他 agent 读同一批 `skills/<name>/SKILL.md`。没有第二种运行时，也没有安装脚本。

## 1. Claude Code

在目标仓库启动时加载本插件目录：

```bash
claude --plugin-dir <插件根>
```

插件清单仍是 `.claude-plugin/plugin.json`。本说明不改插件名、作者、描述句。

## 2. Cursor

把本仓库作为工作区打开即可。技能文件在 `skills/<name>/SKILL.md`。

不新增 Cursor 插件清单，不把 skill 复制到 `.cursor/skills/`，不把规则改写成另一套 Cursor rules 包。

## 3. 其他能读目录的 agent

把插件根放进该 agent 的可读路径，按 `skills/*/SKILL.md` 加载。没有第二种运行时，也没有安装脚本。

## 4. description 只有触发条件

下面七个文件的 YAML `description` 以 `Use when` 开头。流程写在正文，不写进描述：

- `skills/admin-modernize/SKILL.md`
- `skills/admin-recon/SKILL.md`
- `skills/admin-repo-split/SKILL.md`
- `skills/admin-guardrails/SKILL.md`
- `skills/admin-preview-loop/SKILL.md`
- `skills/admin-api-contract/SKILL.md`
- `skills/admin-legacy-migration/SKILL.md`

描述里只留触发条件。不写「先摸底再约束面再对接面」这类过程。

## 不做的事

不包装新的发布格式。不改 skill 的发现路径。不把 `claude --plugin-dir` 换成别的启动器。
````

- [ ] **Step 2: 在 README「试用」的 Claude 命令后加一段链接**

找到这段并保持 Claude 命令原文不变：

````markdown
```bash
claude --plugin-dir /Users/liujiayuan/App/admin-modernize
```

脚本也能单独跑：
````

换成：

````markdown
```bash
claude --plugin-dir /Users/liujiayuan/App/admin-modernize
```

Cursor 和其他能读目录的 agent 怎样加载本仓库，见 [docs/runtime-loading.md](docs/runtime-loading.md)。这里不展开 Cursor 的操作步骤。

脚本也能单独跑：
````

本任务到此停止对 README 的修改。不要改版本号、结构树、状态标题，也不要改「尚未 push」。

- [ ] **Step 3: 核对七个 description，原句一致则不改**

下面每条都是该文件当前的整行 `description`。它们都已经以 `Use when` 开头。中文尾巴是主题标签，不是「先摸底再约束面再对接面」这种步骤摘要，保持原句。

| 文件 | description 全文 |
|---|---|
| `skills/admin-modernize/SKILL.md` | `Use when planning or running an effort to make an existing back-office/admin web system ready for AI-generated pages and prototypes that connect to a real backend without rework — legacy pages with inconsistent UI, AI output that needs heavy fixing, no way to preview without the backend, or frontend/backend field mismatches at integration. 老旧后台优化、AI 生成原型对接后端、统一 UI 规范。` |
| `skills/admin-recon/SKILL.md` | `Use when starting to make an admin system AI-ready and you need a quantified picture of it before choosing scope, a pilot page and success metrics — stack, size, activity, UI inconsistency, data-layer and AI-readiness signals. Read-only.` |
| `skills/admin-repo-split/SKILL.md` | `Use when a back-office system's frontend and backend live in one repository and they need independent release, separate ownership, or a write boundary that keeps AI-generated pages away from backend code — deciding whether to split, freezing the contract first, doing the logical split before the physical one, and keeping the two sides in sync afterwards. 前后端同仓拆分、拆仓、仓库边界。` |
| `skills/admin-guardrails/SKILL.md` | `Use when AI-generated or newly written admin pages come out inconsistent (wrong components, hard-coded styles, ad-hoc layouts), reviewers keep repeating the same comments, someone proposes "just write a rules doc", or rules must fail fast without being blocked by legacy violations. 约束面：样板页、标准件、lint 棘轮、AI 入口文件。` |
| `skills/admin-preview-loop/SKILL.md` | `Use when AI-generated or edited admin pages cannot be run or seen without the real backend and login, when mock data is thin or empty, or when visual changes cannot be verified before merge. 反馈环：离线预览、固定种子 mock、截图与视觉回归。` |
| `skills/admin-api-contract/SKILL.md` | `Use when prototype or AI-generated admin pages must be connected to a real backend, pages contain their own request glue (param renaming, response unwrapping, enum mapping), mock fields drift from real responses, or nobody owns the API contract between frontend and backend. 对接面：数据层统一、契约先行、mock 与真实可切换。` |
| `skills/admin-legacy-migration/SKILL.md` | `Use when moving existing pages of a legacy admin system to the new standards — deciding what to migrate and in what order, running a migration batch, or verifying that a visual or structural refactor did not change behavior. 存量迁移：按价值排序、分批、截图对比。` |

Run:

```bash
python3 - << 'PY'
from pathlib import Path
expected = {
    "skills/admin-modernize/SKILL.md": "Use when planning or running an effort to make an existing back-office/admin web system ready for AI-generated pages and prototypes that connect to a real backend without rework — legacy pages with inconsistent UI, AI output that needs heavy fixing, no way to preview without the backend, or frontend/backend field mismatches at integration. 老旧后台优化、AI 生成原型对接后端、统一 UI 规范。",
    "skills/admin-recon/SKILL.md": "Use when starting to make an admin system AI-ready and you need a quantified picture of it before choosing scope, a pilot page and success metrics — stack, size, activity, UI inconsistency, data-layer and AI-readiness signals. Read-only.",
    "skills/admin-repo-split/SKILL.md": "Use when a back-office system's frontend and backend live in one repository and they need independent release, separate ownership, or a write boundary that keeps AI-generated pages away from backend code — deciding whether to split, freezing the contract first, doing the logical split before the physical one, and keeping the two sides in sync afterwards. 前后端同仓拆分、拆仓、仓库边界。",
    "skills/admin-guardrails/SKILL.md": "Use when AI-generated or newly written admin pages come out inconsistent (wrong components, hard-coded styles, ad-hoc layouts), reviewers keep repeating the same comments, someone proposes \"just write a rules doc\", or rules must fail fast without being blocked by legacy violations. 约束面：样板页、标准件、lint 棘轮、AI 入口文件。",
    "skills/admin-preview-loop/SKILL.md": "Use when AI-generated or edited admin pages cannot be run or seen without the real backend and login, when mock data is thin or empty, or when visual changes cannot be verified before merge. 反馈环：离线预览、固定种子 mock、截图与视觉回归。",
    "skills/admin-api-contract/SKILL.md": "Use when prototype or AI-generated admin pages must be connected to a real backend, pages contain their own request glue (param renaming, response unwrapping, enum mapping), mock fields drift from real responses, or nobody owns the API contract between frontend and backend. 对接面：数据层统一、契约先行、mock 与真实可切换。",
    "skills/admin-legacy-migration/SKILL.md": "Use when moving existing pages of a legacy admin system to the new standards — deciding what to migrate and in what order, running a migration batch, or verifying that a visual or structural refactor did not change behavior. 存量迁移：按价值排序、分批、截图对比。",
}
forbidden = "先摸底再约束面再对接面"
for path, want in expected.items():
    text = Path(path).read_text()
    start = text.index("description: ")
    line = text[start:].splitlines()[0]
    got = line[len("description: "):]
    if got != want or not got.startswith("Use when") or forbidden in got:
        raise SystemExit(path + " description 偏离触发条件")
print("descriptions ok")
PY
```

Expected: 退出码 0，标准输出为 `descriptions ok`。

若某一文件失败：把该文件的 `description` 改回上表中的原句，删掉后加的步骤摘要，保留原句里的中文主题标签。不要改正文。改完重跑，直到输出 `descriptions ok`。与上表一致时，这七个文件零改动。

- [ ] **Step 4: Commit**

```bash
git add docs/runtime-loading.md README.md
git diff --cached --stat
git commit -m "docs: 补充多 runtime 加载说明"
```

Expected: 暂存区只有 `docs/runtime-loading.md` 和 `README.md`。七个 `SKILL.md` 不在暂存区。提交成功。

### Task 3: P2-8 暴露面夹具与会失败的断言

**Files:**
- Create: `skills/admin-api-contract/fixtures/exposure/gap.ir.json`
- Create: `skills/admin-api-contract/fixtures/exposure/gap-illegal.ir.json`
- Create: `skills/admin-api-contract/scripts/assert-exposure.mjs`
- Do not modify: `scripts/generate-skeleton.mjs`

**Interfaces:**
- Consumes: 现有 `scripts/generate-skeleton.mjs` 的命令行 `node scripts/generate-skeleton.mjs --gap <gap.ir.json> --out-dir <目录>`。本任务结束时它还不读 `exposure`。
- Produces: 断言脚本的退出约定。合法夹具时期望退出码 0，并读到 `mcp-tools.stub.mjs` 里名为 `listThings`、`getThing` 的工具。非法夹具期望退出码 2 且不创建输出目录。把合法夹具里 `updateThing.exposure` 改成 `""` 后仍期望退出码 0，且工具名仍是 `listThings,getThing`。Task 4 实现生成器来满足这些断言。

- [ ] **Step 1: 创建合法夹具 `skills/admin-api-contract/fixtures/exposure/gap.ir.json`**

五条都用合成资源 `things`。不要使用洞察池路径。

```json
{
  "version": "1",
  "generatedAt": "2026-10-28T00:00:00.000Z",
  "generator": "manual",
  "items": [
    {
      "desiredId": "listThings",
      "actualId": "listThings",
      "method": "GET",
      "path": "/api/things",
      "status": "match",
      "notes": "列出 things",
      "disposition": "direct",
      "exposure": "mcp"
    },
    {
      "desiredId": "getThing",
      "actualId": "getThing",
      "method": "GET",
      "path": "/api/things/{id}",
      "status": "match",
      "notes": "按 id 读取 thing",
      "disposition": "bff",
      "exposure": "mcp"
    },
    {
      "desiredId": "createThing",
      "actualId": "createThing",
      "method": "POST",
      "path": "/api/things",
      "status": "match",
      "notes": "创建 thing",
      "disposition": "direct",
      "exposure": "rest"
    },
    {
      "desiredId": "updateThing",
      "actualId": "updateThing",
      "method": "PATCH",
      "path": "/api/things/{id}",
      "status": "reshape",
      "notes": "更新 thing",
      "disposition": "direct",
      "exposure": null
    },
    {
      "desiredId": "deleteThing",
      "actualId": null,
      "method": "DELETE",
      "path": "/api/things/{id}",
      "status": "missing",
      "notes": "删除 thing",
      "disposition": "pending",
      "exposure": "mcp"
    }
  ]
}
```

- [ ] **Step 2: 创建非法夹具 `skills/admin-api-contract/fixtures/exposure/gap-illegal.ir.json`**

与合法夹具逐字段相同，只把 `createThing` 的 `exposure` 改成 `graphql`。不要另改 disposition 或路径。

```json
{
  "version": "1",
  "generatedAt": "2026-10-28T00:00:00.000Z",
  "generator": "manual",
  "items": [
    {
      "desiredId": "listThings",
      "actualId": "listThings",
      "method": "GET",
      "path": "/api/things",
      "status": "match",
      "notes": "列出 things",
      "disposition": "direct",
      "exposure": "mcp"
    },
    {
      "desiredId": "getThing",
      "actualId": "getThing",
      "method": "GET",
      "path": "/api/things/{id}",
      "status": "match",
      "notes": "按 id 读取 thing",
      "disposition": "bff",
      "exposure": "mcp"
    },
    {
      "desiredId": "createThing",
      "actualId": "createThing",
      "method": "POST",
      "path": "/api/things",
      "status": "match",
      "notes": "创建 thing",
      "disposition": "direct",
      "exposure": "graphql"
    },
    {
      "desiredId": "updateThing",
      "actualId": "updateThing",
      "method": "PATCH",
      "path": "/api/things/{id}",
      "status": "reshape",
      "notes": "更新 thing",
      "disposition": "direct",
      "exposure": null
    },
    {
      "desiredId": "deleteThing",
      "actualId": null,
      "method": "DELETE",
      "path": "/api/things/{id}",
      "status": "missing",
      "notes": "删除 thing",
      "disposition": "pending",
      "exposure": "mcp"
    }
  ]
}
```

- [ ] **Step 3: 创建 `skills/admin-api-contract/scripts/assert-exposure.mjs`**

脚本从自身位置找到仓库根的 `scripts/generate-skeleton.mjs`，以及 `../fixtures/exposure/`。合法运行失败时打印 `缺少 mcp-tools.stub.mjs` 并以退出码 1 结束。这就是本任务期望的红灯。

```javascript
#!/usr/bin/env node
/**
 * 断言 generate-skeleton 对 exposure 的行为。
 *
 *   node skills/admin-api-contract/scripts/assert-exposure.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const gen = join(repo, 'scripts', 'generate-skeleton.mjs');
const fx = join(here, '..', 'fixtures', 'exposure');
const SKELETONS = [
  'mappers.mjs',
  'client.stub.mjs',
  'route-mode.json',
  'pending-endpoints.json',
  'pending.md',
  'mcp-tools.stub.mjs',
];

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function run(gapPath) {
  const dir = mkdtempSync(join(tmpdir(), 'exposure-'));
  const out = join(dir, 'skeleton');
  const result = spawnSync(process.execPath, [gen, '--gap', gapPath, '--out-dir', out], { encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr || '', stdout: result.stdout || '', out, dir };
}

function assertAbsent(out) {
  if (existsSync(out)) {
    const present = SKELETONS.filter((name) => existsSync(join(out, name)));
    if (present.length) fail(`非法 exposure 仍写出文件：${present.join(', ')}`);
    fail('非法 exposure 仍创建了输出目录');
  }
}

const legal = run(join(fx, 'gap.ir.json'));
if (legal.status !== 0) fail(`合法夹具应退出码 0，实际 ${legal.status}\n${legal.stderr}`);
const stubPath = join(legal.out, 'mcp-tools.stub.mjs');
if (!existsSync(stubPath)) fail('缺少 mcp-tools.stub.mjs');
const stubUrl = pathToFileURL(stubPath);
stubUrl.searchParams.set('t', String(Date.now()));
const mod = await import(stubUrl.href);
const names = (mod.tools || []).map((tool) => tool.name);
if (names.join(',') !== 'listThings,getThing') fail(`工具名应为 listThings,getThing，实际 ${names.join(',')}`);
const listSchema = mod.tools[0].inputSchema;
const getSchema = mod.tools[1].inputSchema;
if (listSchema.type !== 'object' || listSchema.additionalProperties !== false || JSON.stringify(listSchema.properties) !== '{}' || listSchema.required != null) {
  fail(`listThings.inputSchema 应是没有 required 的空 properties：${JSON.stringify(listSchema)}`);
}
if (JSON.stringify(getSchema.required) !== JSON.stringify(['id']) || getSchema.properties.id.type !== 'string' || getSchema.additionalProperties !== false) {
  fail(`getThing.inputSchema.required 应为 ["id"]，实际 ${JSON.stringify(getSchema)}`);
}
if (mod.tools[0].description !== '列出 things' || mod.tools[1].description !== '按 id 读取 thing') {
  fail(`工具描述应来自 notes：${mod.tools.map((tool) => tool.description).join(' | ')}`);
}
const mapperText = readFileSync(join(legal.out, 'mappers.mjs'), 'utf8');
const clientText = readFileSync(join(legal.out, 'client.stub.mjs'), 'utf8');
for (const id of ['listThings', 'getThing', 'createThing', 'updateThing']) {
  if (!mapperText.includes(id)) fail(`mappers.mjs 缺少 ${id}`);
}
if (mapperText.includes('deleteThing')) fail('mappers.mjs 含有 deleteThing');
if (mapperText.includes('mcp-tools') || clientText.includes('mcp-tools')) fail('映射或 client 引用了 mcp-tools');
const handlerSrc = mod.tools.map((tool) => String(tool.handler)).join('\n');
if (!handlerSrc.includes('dataLayer.listThings') || !handlerSrc.includes('dataLayer.getThing')) {
  fail(`handler 未调用数据层同名方法：\n${handlerSrc}`);
}
if (handlerSrc.includes('fetch(') || handlerSrc.includes('axios') || handlerSrc.includes('this.$http')) {
  fail('handler 含有页面或 HTTP 调用');
}
const pendingMd = readFileSync(join(legal.out, 'pending.md'), 'utf8');
if (!pendingMd.includes('deleteThing') || !pendingMd.includes('已标 `mcp`，后端未提供，所以没有工具。')) {
  fail(`pending.md 未注明 mcp 未发布工具：\n${pendingMd}`);
}
const stubText = readFileSync(stubPath, 'utf8');
if (!stubText.includes('这是给 Agent 直接调用的占位，不是服务器，也不是页面要 import 的模块。')) {
  fail('stub 顶部缺少占位说明');
}
rmSync(legal.dir, { recursive: true, force: true });

const illegal = run(join(fx, 'gap-illegal.ir.json'));
if (illegal.status !== 2) fail(`非法 exposure 应退出码 2，实际 ${illegal.status}\n${illegal.stderr}`);
assertAbsent(illegal.out);
rmSync(illegal.dir, { recursive: true, force: true });

const emptyDir = mkdtempSync(join(tmpdir(), 'exposure-empty-'));
const emptyGap = join(emptyDir, 'gap.ir.json');
const gap = JSON.parse(readFileSync(join(fx, 'gap.ir.json'), 'utf8'));
const update = gap.items.find((item) => item.desiredId === 'updateThing');
if (!update) fail('合法夹具缺少 updateThing');
update.exposure = '';
writeFileSync(emptyGap, `${JSON.stringify(gap, null, 2)}\n`);
const empty = run(emptyGap);
if (empty.status !== 0) fail(`空字符串 exposure 应退出码 0，实际 ${empty.status}\n${empty.stderr}`);
const emptyUrl = pathToFileURL(join(empty.out, 'mcp-tools.stub.mjs'));
emptyUrl.searchParams.set('t', String(Date.now()));
const emptyMod = await import(emptyUrl.href);
const emptyNames = emptyMod.tools.map((tool) => tool.name);
if (emptyNames.join(',') !== 'listThings,getThing' || emptyNames.includes('updateThing')) {
  fail(`空字符串不应产生 updateThing 工具，实际 ${emptyNames.join(',')}`);
}
rmSync(empty.dir, { recursive: true, force: true });
rmSync(emptyDir, { recursive: true, force: true });
console.log('exposure ok');
```

- [ ] **Step 4: 运行断言，确认现在失败**

Run:

```bash
node skills/admin-api-contract/scripts/assert-exposure.mjs
```

Expected: 退出码 1。标准错误恰好含有这一行：

```
缺少 mcp-tools.stub.mjs
```

标准输出里没有 `exposure ok`。不要在本任务修改 `scripts/generate-skeleton.mjs` 去让它通过。

- [ ] **Step 5: Commit**

```bash
git add skills/admin-api-contract/fixtures/exposure/gap.ir.json skills/admin-api-contract/fixtures/exposure/gap-illegal.ir.json skills/admin-api-contract/scripts/assert-exposure.mjs
git commit -m "test: 添加 exposure 夹具与会失败的断言"
```

Expected: 提交成功。工作区里这次只增加上述三个路径。断言仍然失败，这是这一提交的预期状态。

---

### Task 4: 把 exposure 接到 generate-skeleton

**Files:**
- Modify: `scripts/generate-skeleton.mjs`（整文件替换）
- Modify: `skills/admin-api-contract/references/ir-schema.md`
- Modify: `skills/admin-api-contract/SKILL.md`（只改流水线第 4、5、6 步的正文，不改 YAML `description`）
- Test: `skills/admin-api-contract/scripts/assert-exposure.mjs`

**Interfaces:**
- Consumes: Task 3 的两个夹具和 `assert-exposure.mjs`。命令行参数保持 `--gap` 与 `--out-dir`。
- Produces: 成功时在 `--out-dir` 写出 `mappers.mjs`、`client.stub.mjs`、`route-mode.json`、`pending-endpoints.json`、`pending.md`、`mcp-tools.stub.mjs`。`mcp-tools.stub.mjs` 导出 `tools` 数组。每个工具有 `name`、`description`、`inputSchema`、`handler(dataLayer, input)`。`name` 是 `desiredId`。`description` 是 `notes` 去掉首尾空白后的文本；`notes` 空白时用 `` `${method} ${path}` ``。`inputSchema` 是 `{ type: "object", additionalProperties: false, properties }`；路径里 `{param}` 按出现顺序成为必填 `string`；没有路径参数时不设 `required`。`handler` 返回 `dataLayer.<desiredId>(input)`。`pending` 且 `mcp` 的项不进 `tools`，在 `pending.md` 写上 `` `<desiredId>：已标 `mcp`，后端未提供，所以没有工具。` ``。

规范化规则，在创建输出目录之前做完：

| 字段 | 行为 |
|---|---|
| `disposition` 为 `null`、缺字段、空字符串 | 退出码 1，不创建输出目录。与现在相同 |
| `disposition` 不是 `direct` / `bff` / `pending` | 退出码 2，不创建输出目录 |
| `exposure` 缺字段、`null`、trim 后为空 | 当作 `rest` |
| `exposure` 为 `rest` / `bff` / `mcp` | 用 trim 后的原值 |
| 其他 exposure，包括 `MCP`、`REST`、`BFF`、`graphql` | 退出码 2，不创建输出目录，不写空的 `mcp-tools.stub.mjs` |

`exposure: bff` 只表示暴露面，不改变 `disposition: bff` 的映射注释。两条字段独立。

- [ ] **Step 1: 用下面的全文覆盖 `scripts/generate-skeleton.mjs`**

先完成 disposition 与 exposure 检查，再 `mkdirSync`。六个 `writeFileSync` 都放在检查之后。`mappers.mjs` 与 `client.stub.mjs` 的模板里不要出现 `mcp-tools`。handler 里不要写 `fetch(`、`axios`、`this.$http`。

```javascript
#!/usr/bin/env node
/**
 * generate-skeleton：差距表过了人工门禁之后，写出映射骨架（Node 18+，无依赖）。
 *
 * 任一条 disposition 为 null 或空字符串 → 退出码 1，不写文件。
 * disposition 不是 direct / bff / pending → 退出码 2，不写文件。
 * exposure 缺字段、null、仅空白 → 当作 rest。
 * exposure 不是 rest / bff / mcp（大小写不纠正）→ 退出码 2，不写文件。
 * direct / bff → mappers.mjs
 * pending → pending-endpoints.json + pending.md
 * 全部操作 → route-mode.json（direct/bff 为 real，pending 为 pending）
 * client.stub.mjs 是 typed client 入口骨架，不是完整客户端。
 * 每次成功都写 mcp-tools.stub.mjs。tools 只含 exposure 为 mcp 且 disposition 为 direct 或 bff 的项。
 *
 * 用法
 *   node generate-skeleton.mjs --gap <gap.ir.json> --out-dir <目录>
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const argv = process.argv.slice(2);
const USAGE = [
  '用法',
  '  node generate-skeleton.mjs --gap <gap.ir.json> --out-dir <目录>',
  '',
  '人工门禁：每条差距的 disposition 必须是 direct、bff 或 pending。',
  '有空值就拒绝（退出码 1），不生成文件。',
  'disposition 通过之后检查 exposure：缺省当作 rest；只能是 rest、bff、mcp。',
  '非法 exposure 退出码 2，不生成文件。',
].join('\n');

const die = (msg, code = 2) => { console.error(`✘ ${msg}`); process.exit(code); };
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

let gapPath = null;
let outDir = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--gap') gapPath = argv[++i];
  else if (a === '--out-dir') outDir = argv[++i];
  else die(`未知参数 ${a}\n${USAGE}`);
  if ((a === '--gap' || a === '--out-dir') && (argv[i] == null || String(argv[i]).startsWith('--'))) {
    die(`缺少 ${a} 的值\n${USAGE}`);
  }
}
if (!gapPath || !outDir) die(`缺少 --gap 或 --out-dir\n${USAGE}`);
if (!existsSync(gapPath)) die(`找不到 ${gapPath}`);

let gap;
try { gap = JSON.parse(readFileSync(gapPath, 'utf8')); }
catch (e) { die(`${gapPath} 不是合法 JSON：${e.message}`); }
if (!gap || !Array.isArray(gap.items)) die(`${gapPath} 不是 gap IR：缺少 items`);

const ALLOWED = new Set(['direct', 'bff', 'pending']);
const EXPOSURES = new Set(['rest', 'bff', 'mcp']);
const blocked = [];
for (const [i, item] of gap.items.entries()) {
  if (!item || typeof item !== 'object') die(`第 ${i + 1} 条不是对象`);
  if (!item.desiredId || !item.method || !item.path) die(`第 ${i + 1} 条缺 desiredId、method 或 path`);
  const raw = item.disposition;
  if (raw == null || String(raw).trim() === '') {
    blocked.push(item);
    continue;
  }
  const disposition = String(raw).trim();
  if (!ALLOWED.has(disposition)) die(`第 ${i + 1} 条 disposition 无效：${disposition}。只能是 direct、bff、pending。`);
  item.disposition = disposition;
}
if (blocked.length) {
  const lines = blocked.map((item) => `  - ${item.desiredId} ${item.method} ${item.path}`);
  die([
    `人工门禁未过：还有 ${blocked.length} 条差距的 disposition 为空。`,
    '先把每条填成 direct（直连）、bff（适配层映射）或 pending（后端还没有），再生成骨架。',
    ...lines,
  ].join('\n'), 1);
}

for (const [i, item] of gap.items.entries()) {
  const raw = item.exposure;
  const text = raw == null ? '' : String(raw).trim();
  if (text === '') item.exposure = 'rest';
  else if (EXPOSURES.has(text)) item.exposure = text;
  else die(`第 ${i + 1} 条 exposure 无效：${text}。只能是 rest、bff、mcp；缺省当作 rest。不写文件。`);
}

const DIR = resolve(outDir);
mkdirSync(DIR, { recursive: true });
const generatedAt = new Date().toISOString();
const actionable = gap.items.filter((item) => item.disposition === 'direct' || item.disposition === 'bff');
const pending = gap.items.filter((item) => item.disposition === 'pending');

function comment(text) {
  return String(text || '').replace(/\r?\n/g, ' ').replace(/\*\//g, '* /');
}
function fnName(id) {
  return /^[A-Za-z_$][\w$]*$/.test(id) ? id : null;
}
function pathParams(path) {
  return [...String(path).matchAll(/\{([^/\s}]+)\}/g)].map((match) => match[1]);
}
function inputSchema(path) {
  const params = pathParams(path);
  const properties = {};
  for (const name of params) properties[name] = { type: 'string' };
  const schema = { type: 'object', additionalProperties: false, properties };
  if (params.length) schema.required = params;
  return schema;
}
function toolDescription(item) {
  const notes = String(item.notes ?? '').trim();
  return notes || `${item.method} ${item.path}`;
}

const operationLiterals = actionable.map((item) => `  ${JSON.stringify({
  id: item.desiredId,
  method: item.method,
  path: item.path,
  disposition: item.disposition,
  status: item.status || null,
})}`).join(',\n');
const mapperFns = actionable.map((item) => {
  const name = fnName(item.desiredId);
  const header = item.disposition === 'bff'
    ? `// bff：按差距备注做字段映射，页面不要自己改名。${comment(item.notes)}`
    : `// direct：原样透过。${comment(item.notes)}`;
  if (!name) return `  ${JSON.stringify(item.desiredId)}(raw) {\n    ${header}\n    return raw;\n  }`;
  return `  ${name}(raw) {\n    ${header}\n    return raw;\n  }`;
}).join(',\n');

const mappers = `/**
 * 映射层骨架，由 generate-skeleton 写出。
 * direct 原样透过；bff 在这里改字段。页面不要自己做参数改名或拆包。
 * 这不是完整的 typed client。
 */
export const operations = [
${operationLiterals}
];

export const mappers = {
${mapperFns}
};
`;

const clientFns = gap.items.map((item) => {
  const name = fnName(item.desiredId);
  const key = name || JSON.stringify(item.desiredId);
  if (item.disposition === 'pending') {
    return `    ${key}() {\n      throw new Error('后端尚未提供: ${comment(item.desiredId)}');\n    }`;
  }
  return `    ${key}() {\n      throw new Error('stub client: ${comment(item.desiredId)} 未接数据层');\n    }`;
}).join(',\n');
const client = `/**
 * typed client 入口骨架，由 generate-skeleton 写出。
 * 只占住方法名。完整客户端要等契约评审之后替换这里。
 */
export const operations = ${JSON.stringify(gap.items.map((item) => ({
  id: item.desiredId,
  method: item.method,
  path: item.path,
  disposition: item.disposition,
})), null, 2)};

export function createStubClient() {
  return {
${clientFns}
  };
}
`;

const modes = {};
for (const item of gap.items) modes[item.desiredId] = item.disposition === 'pending' ? 'pending' : 'real';
const routeMode = {
  version: '1',
  generatedAt,
  generator: 'generate-skeleton',
  modes,
};
const pendingDoc = {
  version: '1',
  generatedAt,
  generator: 'generate-skeleton',
  endpoints: pending.map((item) => ({
    id: item.desiredId,
    method: item.method,
    path: item.path,
    status: item.status || null,
    notes: item.notes || '',
    disposition: 'pending',
  })),
};
const pendingLines = pending.length
  ? pending.map((item) => `| ${item.desiredId} | ${item.method} | ${item.path} | ${item.status || ''} | ${String(item.notes || '').replace(/\|/g, '\\|')} |`)
  : ['| — | — | — | — | 没有 pending |'];
const pendingMcpLines = pending
  .filter((item) => item.exposure === 'mcp')
  .map((item) => `${item.desiredId}：已标 \`mcp\`，后端未提供，所以没有工具。`);
const pendingMd = `# 待后端提供

这些接口的处置是 \`pending\`。页面应提示「后端尚未提供」，不要 mock 成成功。

| id | method | path | status | notes |
|---|---|---|---|---|
${pendingLines.join('\n')}
${pendingMcpLines.length ? `\n${pendingMcpLines.join('\n')}\n` : ''}`;

const mcpItems = gap.items.filter((item) => item.exposure === 'mcp' && (item.disposition === 'direct' || item.disposition === 'bff'));
const toolLiterals = mcpItems.map((item) => {
  const ident = fnName(item.desiredId);
  const call = ident ? `dataLayer.${ident}(input)` : `dataLayer[${JSON.stringify(item.desiredId)}](input)`;
  const schema = JSON.stringify(inputSchema(item.path), null, 2).replace(/\n/g, '\n    ');
  return `  {
    name: ${JSON.stringify(item.desiredId)},
    description: ${JSON.stringify(toolDescription(item))},
    inputSchema: ${schema},
    handler(dataLayer, input) {
      return ${call};
    },
  }`;
}).join(',\n');
const mcpStub = `/**
 * 这是给 Agent 直接调用的占位，不是服务器，也不是页面要 import 的模块。
 * 由 generate-skeleton 写出。页面和映射层不要 import 本文件。
 */
export const tools = [
${toolLiterals}
];
`;

writeFileSync(join(DIR, 'mappers.mjs'), mappers);
writeFileSync(join(DIR, 'client.stub.mjs'), client);
writeFileSync(join(DIR, 'route-mode.json'), `${JSON.stringify(routeMode, null, 2)}\n`);
writeFileSync(join(DIR, 'pending-endpoints.json'), `${JSON.stringify(pendingDoc, null, 2)}\n`);
writeFileSync(join(DIR, 'pending.md'), pendingMd);
writeFileSync(join(DIR, 'mcp-tools.stub.mjs'), mcpStub);
console.log(DIR);
```

- [ ] **Step 2: 替换 `skills/admin-api-contract/references/ir-schema.md` 里 exposure 那一句**

删除这一句：

```markdown
`exposure`：`rest | bff | mcp`。Schema 里留了这个字段，本切片的脚本不读它，生成时保持 `null`。
```

换成：

```markdown
`exposure`：`rest | bff | mcp`。`build-gap` 仍写 `null`，不猜测暴露面。`generate-skeleton` 在 `disposition` 通过之后先去掉首尾空白：缺字段、`null` 和空字符串当作 `rest`；`rest`、`bff`、`mcp` 保持原值；其他值（含 `MCP`、`REST`、`BFF`）退出码 2，不写文件。只为规范化后是 `mcp` 且 `disposition` 为 `direct` 或 `bff` 的项，在同一次成功运行里写入 `mcp-tools.stub.mjs`。`pending` 且 `mcp` 不发布工具，`pending.md` 注明原因。`exposure: bff` 不改变 `disposition: bff` 的映射语义。页面路径仍走数据层，不读取该 stub。
```

不要改 `disposition` 表，也不要改 schema 文件。

- [ ] **Step 3: 改 `skills/admin-api-contract/SKILL.md` 流水线第 4、5、6 步**

YAML `description` 保持这一整句，不要改：

`Use when prototype or AI-generated admin pages must be connected to a real backend, pages contain their own request glue (param renaming, response unwrapping, enum mapping), mock fields drift from real responses, or nobody owns the API contract between frontend and backend. 对接面：数据层统一、契约先行、mock 与真实可切换。`

第 4 步整段换成：

```markdown
4. **人工门禁** — 给每条差距填 `disposition`：`direct`（直连）、`bff`（适配层映射）、`pending`（后端还没有）。空着不能往下走。同一轮可以填 `exposure`：`rest`、`bff` 或 `mcp`。缺省保持 `null`。`exposure` 不改变 `disposition` 的映射语义。
```

第 5 步整段换成：

```markdown
5. **生成骨架** — `../../scripts/generate-skeleton.mjs --gap <gap.ir.json> --out-dir <目录>`
   任一 `disposition` 为空则退出码 1，不写文件。`direct` / `bff` 写入 `mappers.mjs`；`pending` 写入 `pending-endpoints.json` 和 `pending.md`；`route-mode.json` 把操作标成 `real` 或 `pending`（`mock` 留给之后手改）。`client.stub.mjs` 只是 typed client 入口骨架，不是完整客户端。成功时总会写出 `mcp-tools.stub.mjs`。`tools` 只收录规范化后 `exposure` 为 `mcp` 且 `disposition` 为 `direct` 或 `bff` 的项。`pending` 且 `mcp` 不发布工具，并在 `pending.md` 注明。`exposure` 缺字段、`null` 或空字符串当作 `rest`。其他值（包括 `MCP`、`REST`、`BFF`、`graphql`）退出码 2，不写任何骨架文件。检查在创建输出目录之前做完。
```

第 6 步整段换成：

```markdown
6. **接数据层** — 按 `references/data-layer-checklist.md` 把页面改到数据层上，对照骨架审字段。页面不 import `mcp-tools.stub.mjs`，也不走 MCP。Agent 要直接调某个能力时，只用 `exposure: mcp` 且已经可调用的那份工具 stub。`build-gap` 仍把 `exposure` 写成 `null`；`generate-skeleton` 把 `null` 和空字符串当作 `rest`，只为 `mcp` 且 `disposition` 为 `direct` 或 `bff` 的项写入工具；非法值退出码 2。
```

- [ ] **Step 4: 跑断言，确认通过**

Run:

```bash
node skills/admin-api-contract/scripts/assert-exposure.mjs
```

Expected: 退出码 0。标准输出为：

```
exposure ok
```

这一次会覆盖合法五条、`gap-illegal.ir.json` 的 `graphql`（退出码 2 且不创建输出目录）、以及脚本当场把 `updateThing.exposure` 写成 `""` 的用例（退出码 0，工具名仍是 `listThings,getThing`）。

- [ ] **Step 5: 确认 disposition 空值仍是退出码 1，大写 `MCP` 是退出码 2**

`MCP` 与 `graphql` 走同一条非法分支：不改正大小写，不降级成 `rest`，不创建输出目录。

Run:

```bash
node --input-type=module << 'EOF'
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const gen = 'scripts/generate-skeleton.mjs';
const base = JSON.parse(readFileSync('skills/admin-api-contract/fixtures/exposure/gap.ir.json', 'utf8'));

function run(mutate) {
  const gap = structuredClone(base);
  mutate(gap);
  const dir = mkdtempSync(join(tmpdir(), 'exposure-gate-'));
  const file = join(dir, 'gap.json');
  const out = join(dir, 'skeleton');
  writeFileSync(file, JSON.stringify(gap));
  const result = spawnSync(process.execPath, [gen, '--gap', file, '--out-dir', out], { encoding: 'utf8' });
  const existed = existsSync(out);
  rmSync(dir, { recursive: true, force: true });
  return { status: result.status, exists: existed, stderr: result.stderr || '' };
}

const empty = run((gap) => { gap.items[0].disposition = null; });
if (empty.status !== 1 || empty.exists) {
  console.error('disposition 为空应退出码 1 且不建目录', empty.status, empty.exists);
  process.exit(1);
}
const upper = run((gap) => { gap.items[0].exposure = 'MCP'; });
if (upper.status !== 2 || upper.exists) {
  console.error('MCP 应退出码 2 且不建目录', upper.status, upper.exists, upper.stderr);
  process.exit(1);
}
console.log('exposure gates ok');
EOF
```

Expected: 退出码 0，标准输出 `exposure gates ok`。

- [ ] **Step 6: 确认洞察池 gap 仍是 null，并且不产生工具**

Run:

```bash
out=$(mktemp -d)
node scripts/generate-skeleton.mjs --gap docs/pilots/dingdong-ux-radar-insights/gap.ir.json --out-dir "$out"
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const gap = JSON.parse(readFileSync("docs/pilots/dingdong-ux-radar-insights/gap.ir.json", "utf8"));
if (gap.items.length !== 6 || gap.items.some((item) => item.exposure !== null)) {
  console.error("洞察池 gap 的 exposure 被改动");
  process.exit(1);
}
const mod = await import(pathToFileURL(process.argv[1]).href);
if (mod.tools.length !== 0) {
  console.error("洞察池 null exposure 产生了工具");
  process.exit(1);
}
console.log("pilot exposure untouched");
' "$out/mcp-tools.stub.mjs"
rm -rf "$out"
```

Expected: 生成器退出码 0，随后打印 `pilot exposure untouched`，整段命令退出码 0。临时目录在仓库外，删掉即可。不要把生成物提交进 `docs/pilots/`。

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-skeleton.mjs skills/admin-api-contract/references/ir-schema.md skills/admin-api-contract/SKILL.md
git commit -m "feat: 按 exposure 生成 MCP 工具 stub"
```

Expected: 提交成功。`build-gap.mjs`、`gap.schema.json`、洞察池 `gap.ir.json` 不在这次提交里。

---

### Task 5: P2-9 Vue 2 + Element UI 适配器

**Files:**
- Create: `adapters/vue2-element/ratchet.config.json`
- Create: `adapters/vue2-element/fixtures/pages/violating/list.vue`
- Create: `adapters/vue2-element/fixtures/pages/violating/detail.vue`
- Create: `adapters/vue2-element/fixtures/pages/fixed/list.vue`
- Create: `adapters/vue2-element/kit-manifest.md`
- Create: `adapters/vue2-element/README.md`
- Modify: `adapters/README.md`（只加表的一行）

**Interfaces:**
- Consumes: `skills/admin-guardrails/scripts/ratchet.mjs` 的 `--report`。默认一行最多计 1 处。`stripComments: "line"` 只去掉 `//` 和单行 `/* */`。`exclude` 命中则跳过整行。本任务不改 `ratchet.mjs`。
- Produces: `--report` 的五行计数。Task 7 再跑同一条命令。

规则与夹具的对应关系：

| id | 处数 | 文件数 | 夹具里的命中 |
|---|---|---|---|
| E1 | 2 | 2 | `violating/list.vue` 与 `violating/detail.vue` 各一处 `<table`，后面是 `>` |
| E2 | 1 | 1 | 只有 `violating/list.vue` 的 `style="margin-top: 8px; padding: 12px"` |
| E3 | 2 | 2 | `this.$http.get` 与 `this.$http.post` 各一行 |
| E4 | 2 | 2 | `#333333` 与 `#ff4d4f` 各一行。含 `url(` 的行由 `exclude` 整行跳过；夹具里不要加这种行 |
| E5 | 1 | 1 | 只有 `v-html="row.note"`。`v-html="sanitize(row.note)"` 不命中，固定页改用 `{{ row.note }}` |

`fixed/list.vue` 对五条都是 0。它使用 `<el-table>`，间距放在 class 对应的样式里，请求走 `this.itemsApi.list()`，颜色用 `var(--color-text)`。

- [ ] **Step 1: 创建 `adapters/vue2-element/ratchet.config.json`**

`baseline` 只是配置字段。不要运行 `--update-baseline`，不要创建 `ratchet-baseline.json`。

```json
{
  "baseline": "ratchet-baseline.json",
  "rules": [
    {
      "id": "E1",
      "message": "原生 `<table>` 绕过 `el-table` → 改用 `<el-table>`",
      "globs": ["fixtures/pages/**/*.vue"],
      "pattern": "<table(?:\\s|>|/)",
      "stripComments": "line"
    },
    {
      "id": "E2",
      "message": "行内 style 堆叠间距 → 改成 class",
      "globs": ["fixtures/pages/**/*.vue"],
      "pattern": "style\\s*=\\s*\"(?:(?!\").)*(?:\\b(?:margin|padding)(?:-(?:top|right|bottom|left))?\\s*:)(?:(?!\").)*(?:\\b(?:margin|padding)(?:-(?:top|right|bottom|left))?\\s*:)",
      "stripComments": "line"
    },
    {
      "id": "E3",
      "message": "`this.$http` 直接请求 → 改成数据层方法，例如 `this.itemsApi.list()`",
      "globs": ["fixtures/pages/**/*.vue"],
      "pattern": "this\\.\\$http",
      "stripComments": "line"
    },
    {
      "id": "E4",
      "message": "硬编码色值 → 改成已有主题变量，不新增一套 token",
      "globs": ["fixtures/pages/**/*.vue"],
      "pattern": "#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\\b",
      "exclude": "url\\(",
      "stripComments": "line"
    },
    {
      "id": "E5",
      "message": "未消毒的 `v-html` → 改成文本插值；确需 HTML 时绑定 `sanitize(...)`",
      "globs": ["fixtures/pages/**/*.vue"],
      "pattern": "v-html\\s*=\\s*\"(?:(?!sanitize\\()[^\"])*\"",
      "stripComments": "line"
    }
  ]
}
```

- [ ] **Step 2: 创建三份夹具**

`adapters/vue2-element/fixtures/pages/violating/list.vue`：

```vue
<template>
  <div>
    <table>
      <tr>
        <td v-html="row.note"></td>
      </tr>
    </table>
    <div style="margin-top: 8px; padding: 12px"></div>
    <span style="color: #333333"></span>
  </div>
</template>
<script>
export default {
  methods: {
    load() {
      return this.$http.get('/api/items');
    },
  },
};
</script>
```

`adapters/vue2-element/fixtures/pages/violating/detail.vue`：

```vue
<template>
  <div>
    <table></table>
    <span style="color: #ff4d4f"></span>
  </div>
</template>
<script>
export default {
  methods: {
    save(payload) {
      return this.$http.post('/api/items', payload);
    },
  },
};
</script>
```

`adapters/vue2-element/fixtures/pages/fixed/list.vue`：

```vue
<template>
  <div>
    <el-table>
      <el-table-column>
        <template slot-scope="{ row }">{{ row.note }}</template>
      </el-table-column>
    </el-table>
    <div class="list-spacing"></div>
    <span class="theme-text"></span>
  </div>
</template>
<script>
export default {
  methods: {
    load() {
      return this.itemsApi.list();
    },
  },
};
</script>
<style>
.list-spacing {
  margin-top: 8px;
  padding: 12px;
}
.theme-text {
  color: var(--color-text);
}
</style>
```

- [ ] **Step 3: 创建 `adapters/vue2-element/kit-manifest.md`**

```markdown
# kit 清单

来源：合成约定。这些名字是 Element UI 列表页和表单页反复用到的组件，不是从某个生产提交抄来的路径。清单不给出 mixin 或指令的真实仓库路径。

## 可共享

只依赖 Element UI，标成可共享。

| 组件 | 依赖 | 耦合 |
|---|---|---|
| `el-table`、`el-table-column` | Element UI | 可共享 |
| `el-form`、`el-form-item` | Element UI | 可共享 |
| `el-pagination` | Element UI | 可共享 |
| `el-button` | Element UI | 可共享 |
| `el-dialog` | Element UI | 可共享 |
| `el-drawer` | Element UI | 可共享 |
| `Message`、`MessageBox` | Element UI | 可共享 |

## 解耦前不共享

- 页面私有 mixin。里面夹了项目接口或权限判断的那种，解耦前不共享。
- 权限指令，例如项目自己的 `v-permission`。标成不共享，直到不再依赖项目私有模块。

没有第二份生产源码，所以这里不写仓库路径。
```

- [ ] **Step 4: 创建 `adapters/vue2-element/README.md`**

````markdown
# adapter：vue2-element

栈：Vue 2 + Element UI 2。组件标签是 Element UI 的 `el-*`。来源是本目录的合成夹具，不是生产仓库，不是 h5-fms-v3，也不是洞察池副本。

## 内容

| 文件 | 说明 |
|---|---|
| `ratchet.config.json` | E1–E5。`baseline` 字段指向 `ratchet-baseline.json`，验收不靠基线文件 |
| `kit-manifest.md` | 合成约定下的 Element UI 标准件，以及解耦前不共享的 mixin 和权限指令 |
| `fixtures/pages/` | 故意违规的小页和改过的小页，只为规则计数 |

## 用法

在插件仓库根目录执行：

```bash
node skills/admin-guardrails/scripts/ratchet.mjs \
  --config adapters/vue2-element/ratchet.config.json \
  --root adapters/vue2-element \
  --report
```

`--report` 退出码为 0。处数与文件数必须是：

| 规则 | 处数 | 文件数 |
|---|---|---|
| E1 | 2 | 2 |
| E2 | 1 | 1 |
| E3 | 2 | 2 |
| E4 | 2 | 2 |
| E5 | 1 | 1 |

数字对不上就改本目录的规则或夹具，直到和这张表一致。不要把 dd-design 在 h5-fms-v3 上的处数拿来当这套的期望。

一条 `style` 只含颜色、不含两处间距时，只计 E4，不计 E2。`v-html="sanitize(row.note)"` 不计 E5。固定页用 `{{ row.note }}`，所以固定页对 E5 也是 0。E4 的 `exclude` 让含 `url(` 的整行跳过；当前夹具没有这种行。

## 没有移植的部分

- dd-design 的 React / antd 类名规则（S、O、L、C 系列）。
- vue-cli 构建和 mock 中间件。0.5 的 README 已记录它们没在真实项目里跑过；本适配器不用跑通 vue-cli 来交差。
- 全量存量视觉统一。
- Element Plus 与 Vue 3。

## 版本敏感点

- 规则针对 Vue 2 单文件组件和 Element UI 2 的标签名。
- Element Plus 也用 `el-` 前缀，但表格和表单 API 不同。本适配器的规则不能直接拿去扫 Vue 3 工程。
- `this.$http` 是页面上常见的请求挂载，不是 Element 的 API。组合式 Vue 3 没有这个 `this`，那条规则只属于本适配器。

本文不写未经验证的补丁版本号。栈的名字锁定为 Vue 2 + Element UI 2。
````

- [ ] **Step 5: 在 `adapters/README.md` 的「现有 adapter」表加一行**

表目前最后一行是：

```markdown
| `dd-design/` | React + `@ddfe/dd-design`（antd v5 风格）+ Vite | h5-fms-v3（财务系统） |
```

在它下面加：

```markdown
| `vue2-element/` | Vue 2 + Element UI | 合成夹具 |
```

不要改「新建一个 adapter」那一节的步骤。

- [ ] **Step 6: 跑 `--report`，要求数字逐项相同**

Run:

```bash
python3 - << 'PY'
import subprocess
proc = subprocess.run(
    [
        "node", "skills/admin-guardrails/scripts/ratchet.mjs",
        "--config", "adapters/vue2-element/ratchet.config.json",
        "--root", "adapters/vue2-element",
        "--report",
    ],
    capture_output=True, text=True,
)
if proc.returncode != 0:
    raise SystemExit(proc.stderr)
expected = {
    "E1": (2, 2, "原生 `<table>` 绕过 `el-table` → 改用 `<el-table>`"),
    "E2": (1, 1, "行内 style 堆叠间距 → 改成 class"),
    "E3": (2, 2, "`this.$http` 直接请求 → 改成数据层方法，例如 `this.itemsApi.list()`"),
    "E4": (2, 2, "硬编码色值 → 改成已有主题变量，不新增一套 token"),
    "E5": (1, 1, "未消毒的 `v-html` → 改成文本插值；确需 HTML 时绑定 `sanitize(...)`"),
}
got = {}
for line in proc.stdout.splitlines():
    if not line.startswith("E"):
        continue
    rule_id, message, total, files, _exempt = line.split("\t")
    got[rule_id] = (int(total), int(files), message)
if got != expected:
    raise SystemExit(f"report mismatch\n{got}")
if "fixtures/pages/fixed/list.vue" in proc.stdout:
    raise SystemExit("固定页被算进违规文件")
if "5\tfixtures/pages/violating/list.vue" not in proc.stdout:
    raise SystemExit("violating/list.vue 应有 5 处")
if "3\tfixtures/pages/violating/detail.vue" not in proc.stdout:
    raise SystemExit("violating/detail.vue 应有 3 处")
print("vue2 report ok")
PY
```

Expected: 退出码 0，标准输出为 `vue2 report ok`。ratchet 自己的表格也打在这条 Python 的子进程里，不另要求人工对表。人工要看原始表时，直接跑：

```bash
node skills/admin-guardrails/scripts/ratchet.mjs \
  --config adapters/vue2-element/ratchet.config.json \
  --root adapters/vue2-element \
  --report
```

那次退出码也是 0。表头是制表符分隔的 `规则	含义	处数	文件数	例外注释数`。五行数据是 E1 2 处 2 文件、E2 1 处 1 文件、E3 2 处 2 文件、E4 2 处 2 文件、E5 1 处 1 文件，例外注释数都是 0。

- [ ] **Step 7: 确认 E5 放过 `sanitize(`，并确认通用目录没有 Element 专用写法**

Run:

```bash
node --input-type=module << 'EOF'
import { readFileSync } from 'node:fs';
const cfg = JSON.parse(readFileSync('adapters/vue2-element/ratchet.config.json', 'utf8'));
const e5 = new RegExp(cfg.rules.find((rule) => rule.id === 'E5').pattern);
if (e5.test('v-html="sanitize(row.note)"')) {
  console.error('sanitize 不应命中 E5');
  process.exit(1);
}
if (!e5.test('v-html="row.note"')) {
  console.error('row.note 应命中 E5');
  process.exit(1);
}
console.log('e5 sanitize skipped');
EOF
python3 - << 'PY'
from pathlib import Path
needles = ("el-table", "el-form", "this.$http")
roots = [Path("skills"), Path("scripts"), Path("adapters/dd-design"), Path("adapters/README.md")]
for root in roots:
    files = [root] if root.is_file() else root.rglob("*")
    for path in files:
        if not path.is_file():
            continue
        text = path.read_text(errors="ignore")
        for needle in needles:
            if needle in text:
                raise SystemExit(f"{path} 含有 {needle}")
print("boundary ok")
PY
```

Expected: 先打印 `e5 sanitize skipped`，再打印 `boundary ok`，退出码 0。`adapters/vue2-element/` 里允许出现这些字符串，所以上面的扫描不包含它。

- [ ] **Step 8: Commit**

```bash
git add adapters/vue2-element adapters/README.md
git commit -m "feat: 增加 vue2-element 适配器与合成夹具"
```

Expected: 提交成功。暂存区没有 `adapters/vue2-element/ratchet-baseline.json`。

---

### Task 6: 版本卫生 0.6.0

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `CHANGELOG.md`
- Create: `docs/roadmap-0.6.0.md`
- Modify: `README.md`（换成下面的全文，其中已包含 Task 2 的试用链接）
- Do not modify: `docs/roadmap-0.5.0.md`、`docs/pilots/dingdong-ux-radar-insights/`、`skills/admin-modernize/SKILL.md`

**Interfaces:**
- Consumes: Task 1 的剧本与空分数表、Task 2 的 `docs/runtime-loading.md`、Task 4 的 exposure 行为、Task 5 的 `adapters/vue2-element/`。
- Produces: 插件版本 `0.6.0`，以及 CHANGELOG、README、`docs/roadmap-0.6.0.md` 对这四项的同一说法。全新 agent 复测的复选框保持 `- [ ]`。

- [ ] **Step 1: 把 `.claude-plugin/plugin.json` 换成**

```json
{
  "name": "admin-modernize",
  "description": "让存量后台适配 AI 生成原型并对接真实后端：拓扑判定、拆仓、摸底、约束面、反馈环、对接面、存量迁移",
  "version": "0.6.0",
  "author": { "name": "liujiayuan" }
}
```

只改了 `version`。`name`、`description`、`author` 与 0.5.0 相同。

- [ ] **Step 2: 在 `CHANGELOG.md` 的 `# 变更日志` 之下、`## 0.5.0` 之上插入**

```markdown
## 0.6.0

### 新增

- 复测包：`docs/ai-benchmarks/retest-playbook.md` 可以单独开跑（干净会话步骤、两段压力话术、填表说明）。`docs/ai-benchmarks/scores.csv` 仍只有表头。全新 agent 复测未勾。
- `docs/runtime-loading.md`：Claude Code 仍用 `--plugin-dir`。Cursor 与其他 agent 把本目录当 skills 加载。没有新的 Cursor 包。
- `scripts/generate-skeleton.mjs` 在 disposition 通过后解释 `exposure`：缺字段、`null` 和空字符串当作 `rest`；只为 `mcp` 且 `direct` 或 `bff` 的项写入 `mcp-tools.stub.mjs`；非法值退出码 2，不写文件。`pending` 且 `mcp` 不发布工具，并在 `pending.md` 注明。
- `adapters/vue2-element/`：Vue 2 + Element UI 的棘轮规则、标准件清单和合成夹具。`--report` 的五条数字是 E1 2/2、E2 1/1、E3 2/2、E4 2/2、E5 1/1。

### 未做

- 不代填 `scores.csv`，不勾选全新 agent 复测。
- 不另起 MCP server 进程，不新增真实 Vue 2 试点仓库。

```

`## 0.5.0` 及其后的历史段落保持原样。

- [ ] **Step 3: 创建 `docs/roadmap-0.6.0.md`**

```markdown
# admin-modernize 0.6.0 改进清单

版本主题：**可信度收口 + 加载说明、暴露面、第二栈**。版本号 **0.6.0**。

依据：`docs/superpowers/specs/2026-10-28-admin-modernize-0.6-design.md`。

0.5.0 路线图里 P2 的 8、9、10 仍写「进 0.6，本轮不做」。完成态写在本文件。不回去改 `docs/roadmap-0.5.0.md` 的勾选。

## 1. 复测包

剧本和只有表头的 `docs/ai-benchmarks/scores.csv` 已经可以独立使用。下面这一项等用户填回，现在不勾。勾选条件是：用户把编排、对接面两行写入分数表，且这两行不是在带本插件 skill 的会话里产生的。

- [ ] 全新 agent 复测：用户已把编排与对接面两行填回 `docs/ai-benchmarks/scores.csv`，且不是在带本插件 skill 的会话里产生的

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
```

- [ ] **Step 4: 用下面的全文覆盖 `README.md`**

这份全文已经包含 Task 2 的试用链接、0.6.0 结构树、`docs/runtime-loading.md`、`adapters/vue2-element/`，以及把两处「尚未 push」改成「已经合并」。不要再补 MR 编号或合并日期。

````markdown
# admin-modernize

让存量后台适配「AI 生成原型，再对接真实后端」。方法与技术栈无关，栈相关的规则放在可选的 adapter 里。

## 思路

目标是两件事：AI 生成的页面一次就对；原型接真实后端不返工。因此投入分三层，存量统一排在它们之后：

| 层 | 要达到 | skill |
|---|---|---|
| 约束面 | AI 照着做就对 | `admin-guardrails` |
| 反馈环 | AI 看得见自己做的结果 | `admin-preview-loop` |
| 对接面 | 原型接得上后端 | `admin-api-contract` |
| 存量 | 老页面按价值逐步迁 | `admin-legacy-migration` |

顺序：先窄后宽、先新后旧、先契约后像素。先用一条真实需求的细切片，从 AI 生成走到接真实后端上线，再把手工部分做成设施，最后才处理存量。

仓库边界先判：`admin-recon` 扫出单仓还是分仓；前后端同仓时先走 `admin-repo-split`（契约先行，再逻辑拆、物理拆），否则拆完就是两个漂移的仓。

## 结构

```
.claude-plugin/plugin.json   版本 0.6.0
CHANGELOG.md
CODEOWNERS                    所有者账号占位，不是已排班的负责人
docs/roadmap-0.5.0.md         0.5.0 改进清单（历史清单；其中 P2-8/9/10 仍写进 0.6、本轮不做）
docs/roadmap-0.6.0.md         0.6.0 改进清单
docs/runtime-loading.md       Claude Code、Cursor 与其他 agent 如何加载本目录
docs/ai-benchmarks/           3 条脱敏基准需求、空评分表、复测剧本
docs/pilots/dingdong-ux-radar-insights/  洞察池试点（含 guardrails 棘轮基线、出处盘点；pilot-source 为接回前快照；内网仓 dingdong-ux-radar 分支 feat/insights-thin-api 的薄数据层已经合并）
scripts/generate-skeleton.mjs 差距表过了人工门禁之后写映射骨架；mcp 且可调用的项写入 mcp-tools.stub.mjs
skills/
  admin-modernize/            编排：阶段、门禁、决策点 D1–D5、红线
    references/metrics-and-eval.md   指标、基准评测、治理
  admin-recon/                阶段 0 摸底
    scripts/inventory.mjs     通用盘点：拓扑（单仓/分仓）、栈、规模、活跃度、UI 与数据层信号、AI 就绪度
    scripts/capabilities.mjs  按模块列页面接口和数据层方法，每条 file:line
    scripts/verify-topology.mjs  合成单仓/分仓与误判复跑
    references/topology.md    拓扑怎么读、对应哪个 playbook
  admin-repo-split/           前后端同仓拆分：契约先行、逻辑拆→物理拆、发布顺序与回滚
    fixtures/synthetic-monorepo/  合成仓。默认仓内隔离
    scripts/drill-split.mjs   逻辑拆清单 + 临时历史上的 filter-repo
  admin-guardrails/           约束面
    scripts/ratchet.mjs       通用「只减不增」规则检查器
    scripts/ratchet.config.example.json
    scripts/map-tokens.mjs    硬编码值 → 现有 token 的映射清单（存量迁移清单）
    references/ai-entry-files.md     入口文件与 new-page skill 的结构
  admin-preview-loop/         反馈环：离线预览、mock、截图、视觉回归
    scripts/                  serve-preview、screenshot、生产包不含 mock
    fixtures/                 列表+抽屉静态页、固定种子、本轮截图
    baseline-noskill.md       无 skill 对照：人工清单，未开 agent
  admin-api-contract/         对接面：数据层、契约先行、校验、晋升清单
    references/data-layer-checklist.md
    references/ir-schema.md   desired / actual / gap 三份 IR
    schemas/                  上述 IR 的 JSON Schema
    scripts/extract-desired.mjs
    scripts/build-gap.mjs     无 sources 的操作不写 gap-table
    scripts/assert-gap-sources.mjs
    scripts/assert-exposure.mjs  exposure 的生成断言
    scripts/check-contract.mjs  录制或现场响应对照 response.fields，日志里计数
    scripts/README.md         薄封装名单、怎么扩展、认不出 URL 就跳过
    fixtures/sample-app/      抽取与差距的合成样例
    fixtures/thin-wrappers/   get/post/api 薄封装样例
    fixtures/contract-check/  check-contract 的好/坏样本
    fixtures/exposure/        exposure 合成 gap：合法五条与非法 graphql
  admin-legacy-migration/     存量迁移
adapters/
  README.md                   adapter 是什么、怎么新建
  dd-design/                  React + @ddfe/dd-design 的规则包与标准件清单（来自 h5-fms-v3）
  vue2-element/               Vue 2 + Element UI 的规则包、标准件清单与合成夹具
```

## 试用

在目标仓库里启动 Claude Code 时加载本目录，然后说「摸底一下这个后台」或「按 admin-modernize 改造这个后台」：

```bash
claude --plugin-dir /Users/liujiayuan/App/admin-modernize
```

Cursor 和其他能读目录的 agent 怎样加载本仓库，见 [docs/runtime-loading.md](docs/runtime-loading.md)。这里不展开 Cursor 的操作步骤。

脚本也能单独跑：

```bash
node skills/admin-recon/scripts/inventory.mjs --topology <仓库>              # 先判单仓/分仓
node skills/admin-recon/scripts/inventory.mjs <仓库> --json /tmp/inventory.json
node skills/admin-recon/scripts/capabilities.mjs --root <仓库> --md /tmp/recon-capabilities.md
node skills/admin-recon/scripts/verify-topology.mjs
node skills/admin-api-contract/scripts/assert-gap-sources.mjs
node skills/admin-repo-split/scripts/drill-split.mjs
node skills/admin-guardrails/scripts/ratchet.mjs --config <规则配置> --root <仓库> --report
node skills/admin-guardrails/scripts/map-tokens.mjs --tokens <token 文件或目录> --scan <代码目录>
node skills/admin-api-contract/scripts/extract-desired.mjs --root <原型目录> --out /tmp/desired.ir.json
node skills/admin-api-contract/scripts/build-gap.mjs --desired /tmp/desired.ir.json --actual <openapi.json> --out /tmp/gap.ir.json
node skills/admin-api-contract/scripts/check-contract.mjs --actual <actual.ir.json> --samples <录制目录>
node scripts/generate-skeleton.mjs --gap /tmp/gap.ir.json --out-dir /tmp/skeleton
node skills/admin-api-contract/scripts/assert-exposure.mjs
APP_MODE=preview node skills/admin-preview-loop/scripts/serve-preview.mjs
node skills/admin-preview-loop/scripts/screenshot.mjs
node skills/admin-preview-loop/scripts/check-prod-bundle.mjs
```

## 状态（0.6.0）

仓库在 GitHub：<https://github.com/JiayuanUXD/admin-modernize>。版本见 `.claude-plugin/plugin.json`，变更见 `CHANGELOG.md`。

0.4.0 加了三件：`inventory.mjs --topology` 判单仓/分仓、`admin-repo-split` 拆仓 playbook、`map-tokens.mjs` 把硬编码值映射到现有 token。0.5.0 补上出处盘点、gap 的出处门禁、反馈环的人工对照、三条基准需求，以及合成仓上的逻辑拆和 `git filter-repo`。0.6.0 补上可独立开跑的复测剧本、`docs/runtime-loading.md`、`generate-skeleton` 对 `exposure` 的解释，以及 `adapters/vue2-element/`。`scores.csv` 仍只有表头，全新 agent 复测未勾。

用子 agent 做过压力测试：6 个场景（编排、摸底、约束面、反馈环、对接面、存量迁移），每个场景都叠加了时间、领导背书、「别问我」「写份文档就行」「不用截图」等压力。第一轮 6 组带 skill、5 组不带 skill 的基线（反馈环基线未跑完）；按结果改了 skill 和脚本后，对摸底、约束面（含「CI 红了」新场景）、存量迁移用全新 agent 复测。

| 部分 | 状态 |
|---|---|
| 六个 skill | 第一轮除摸底外全部通过预注册评分表；摸底被「只贴表」压过，已改，复测通过。每个场景只跑了 1 次，不是统计结论 |
| `ratchet.mjs` | 复现参考 lint 的数字；测试中发现并修掉两个漏洞：重写基线可洗白新增违规（现默认拒绝，需 `--allow-increase`）、`lint-allow` 不写原因也算豁免（现不算） |
| `inventory.mjs` | 在 React 仓库、合成的 Vue 2 加 jQuery 样例、无 package.json 的 JSP 样例上跑过 |
| `inventory.mjs --topology` | 在 5 个合成样例上判定正确：monorepo 全栈、纯前端单仓、两个 git 仓的父目录（自动展开）、JSP 服务端渲染、Node 全栈。6 层浅扫描，判形态够用，不当审计。0.5.0 又把本仓库、合成全栈单仓、合成分仓放进 `verify-topology.mjs`。样例树不参与形态判定。误判在 `admin-recon` 的「常见错误」 |
| `map-tokens.mjs` | 在合成 token 样例上跑通：CSS 变量 / SCSS 变量 / JSON 对象三种来源，hex、rgb、hsl、透明度、字号刻度、歧义、无对应、token 自身冲突都覆盖到 |
| `admin-repo-split` | 合成 monorepo 上跑过逻辑拆清单。临时克隆上 `python3 -m git_filter_repo` 把 3 笔提交收成 2 笔，去掉 `services/api`。三个拆仓信号都没有，默认仓内隔离，没有物理拆生产仓 |
| dd-design 规则包 | 7 条与参考 lint 对账一致；S3 修了漏单行写法（84 到 186），新增 S4（rgb/hsl） |
| 反馈环「交付必含」 | 补写后用全新 agent 复测：Vue 2 + Element UI + vue-cli + axios 场景，用户施压「示例数据写死在组件里」。6 项评分全过。那次说截图脚本未运行、基准图未存，产物不在本仓库。后来的 fixture 截图在 `skills/admin-preview-loop/fixtures/screenshots/`，桌面和窄屏已有 PNG 和 `run-log.json`。1 次，不是统计结论 |
| 反馈环无 skill 对照 | 人工清单已写在 `skills/admin-preview-loop/baseline-noskill.md`。同一条列表+抽屉：整套设施对照只有页面文件。没有开无 skill agent。截图仍以已提交的 `run-log.json` 为准 |
| 评测 | `docs/ai-benchmarks/` 有 3 条需求和空的 `scores.csv`。剧本在 `retest-playbook.md`，可以单独开跑。表仍只有表头，全新 agent 复测未做，本仓库不代填 |
| 未验证 | vue-cli 构建与 mock 中间件没在真实项目里跑过；约束面、存量迁移没有第二次复测；`map-tokens.mjs` 没在真实主题文件上验证过；没有第二个真实业务仓可做分仓扫描，分仓那一次是合成的两个 git 目录。第二个后台在洞察池源码副本上跑过契约流水线、`check-contract`（录制/合成响应）和棘轮基线（未改 `pilot-source` UI）。离线预览跑的是 skill fixture。内网仓 `dingdong-ux-radar` 分支 `feat/insights-thin-api` 的薄数据层已经合并。没有起雷达进程。P2-8 已由 `generate-skeleton` 解释 `exposure`。P2-9 是 `adapters/vue2-element/`。P2-10 的加载说明在 `docs/runtime-loading.md` |
````

- [ ] **Step 5: 确认历史记录没被改写，分数表仍为空，复测项仍未勾**

Run:

```bash
git diff --exit-code origin/main -- docs/roadmap-0.5.0.md docs/pilots/dingdong-ux-radar-insights skills/admin-modernize/SKILL.md skills/admin-api-contract/scripts/build-gap.mjs skills/admin-api-contract/schemas/gap.schema.json
python3 - << 'PY'
import json
from pathlib import Path
plugin = json.loads(Path('.claude-plugin/plugin.json').read_text())
assert plugin['version'] == '0.6.0'
assert plugin['name'] == 'admin-modernize'
assert plugin['description'] == '让存量后台适配 AI 生成原型并对接真实后端：拓扑判定、拆仓、摸底、约束面、反馈环、对接面、存量迁移'
assert plugin['author'] == {'name': 'liujiayuan'}
changelog = Path('CHANGELOG.md').read_text()
assert changelog.split('## ')[1].startswith('0.6.0\n'), changelog[:80]
assert 'scores.csv` 仍只有表头' in changelog
roadmap = Path('docs/roadmap-0.6.0.md').read_text()
retest = [line for line in roadmap.splitlines() if '全新 agent 复测' in line and line.startswith('- [')]
assert retest == ['- [ ] 全新 agent 复测：用户已把编排与对接面两行填回 `docs/ai-benchmarks/scores.csv`，且不是在带本插件 skill 的会话里产生的']
assert '进 0.6，本轮不做' in Path('docs/roadmap-0.5.0.md').read_text()
for path in [
    'docs/roadmap-0.5.0.md',
    'docs/pilots/dingdong-ux-radar-insights/README.md',
    'docs/pilots/dingdong-ux-radar-insights/d1-notes.md',
    'docs/pilots/dingdong-ux-radar-insights/lessons.md',
    'skills/admin-modernize/SKILL.md',
]:
    if '尚未 push' not in Path(path).read_text():
        raise SystemExit(path + ' 丢了 0.5 的尚未 push 记录')
readme = Path('README.md').read_text()
if '尚未 push' in readme:
    raise SystemExit('README 仍把薄数据层写成尚未 push')
if '内网仓 `dingdong-ux-radar` 分支 `feat/insights-thin-api` 的薄数据层已经合并' not in readme:
    raise SystemExit('README 没有写已经合并')
scores = [line for line in Path('docs/ai-benchmarks/scores.csv').read_text().splitlines() if line.strip()]
assert scores == ['date,benchmark,model,first_pass,rework_minutes,causes,notes']
print('version hygiene ok')
PY
```

Expected: `git diff` 退出码 0 且无输出；Python 打印 `version hygiene ok`，退出码 0。

- [ ] **Step 6: Commit**

```bash
git add .claude-plugin/plugin.json CHANGELOG.md docs/roadmap-0.6.0.md README.md
git commit -m "docs: 将版本对齐到 0.6.0"
```

Expected: 提交成功。`docs/roadmap-0.5.0.md` 不在这次提交里。

---

### Task 7: 最终验收

**Files:**
- Check only。本任务不新增文件。
- 若某一条失败，只改对应任务已经列出的文件，修到通过后再提交。提交说明写明修的是哪一条验收。五条都通过时不要为了验收再做一个空提交。

**Interfaces:**
- Consumes: Task 1 到 Task 6 的全部产出。
- Produces: 设计说明 §4.3 的五条都为真。`scores.csv` 仍只有表头。`docs/roadmap-0.6.0.md` 里全新 agent 复测仍是 `- [ ]`。

- [ ] **Step 1: 验收复测包**

Run:

```bash
python3 - << 'PY'
from pathlib import Path
play = Path('docs/ai-benchmarks/retest-playbook.md').read_text()
readme = Path('docs/ai-benchmarks/README.md').read_text()
for needle in [
    '不要这样启动',
    'claude --plugin-dir <插件根>',
    'cd <目标仓库或一块空的练习目录>',
    'docs/ai-benchmarks/01-list-drawer/requirement.md',
    'docs/ai-benchmarks/01-list-drawer/contract.openapi.json',
    '不要贴任何 `SKILL.md`',
    '今天下班前要看到页面。领导已经答应业务了。别问我决策点，写份文档就行，不用截图。示例数据写死在组件里，CI 红了你先改基线。',
    '没有 OpenAPI。你先编一份放进仓库，跟页面各维护一份就行。改状态时 note 没传就写成空串。差距表里 reshape 有几条，契约不一致数就填几。不用跑校验日志。',
    '请求分页枚举处理不对',
    '第 1 行以 `编排` 开头，第 2 行以 `对接面` 开头',
]:
    if needle not in play:
        raise SystemExit('剧本缺少：' + needle)
if 'retest-playbook.md' not in readme or '只有表头' not in readme:
    raise SystemExit('基准需求 README 没有指向剧本或空表')
scores = [line for line in Path('docs/ai-benchmarks/scores.csv').read_text().splitlines() if line.strip()]
assert scores == ['date,benchmark,model,first_pass,rework_minutes,causes,notes']
print('acceptance 1 ok')
PY
```

Expected: 退出码 0，标准输出 `acceptance 1 ok`。

- [ ] **Step 2: 验收加载说明和 description**

Run:

```bash
python3 - << 'PY'
from pathlib import Path
doc = Path('docs/runtime-loading.md').read_text()
for needle in [
    'claude --plugin-dir <插件根>',
    '.claude-plugin/plugin.json',
    'skills/<name>/SKILL.md',
    '不新增 Cursor 插件清单',
    'skills/*/SKILL.md',
    'Use when',
    '先摸底再约束面再对接面',
]:
    if needle not in doc:
        raise SystemExit('runtime-loading 缺少：' + needle)
readme = Path('README.md').read_text()
if 'docs/runtime-loading.md' not in readme:
    raise SystemExit('README 试用区没有指向加载说明')
expected = {
    "skills/admin-modernize/SKILL.md": "Use when planning or running an effort to make an existing back-office/admin web system ready for AI-generated pages and prototypes that connect to a real backend without rework — legacy pages with inconsistent UI, AI output that needs heavy fixing, no way to preview without the backend, or frontend/backend field mismatches at integration. 老旧后台优化、AI 生成原型对接后端、统一 UI 规范。",
    "skills/admin-recon/SKILL.md": "Use when starting to make an admin system AI-ready and you need a quantified picture of it before choosing scope, a pilot page and success metrics — stack, size, activity, UI inconsistency, data-layer and AI-readiness signals. Read-only.",
    "skills/admin-repo-split/SKILL.md": "Use when a back-office system's frontend and backend live in one repository and they need independent release, separate ownership, or a write boundary that keeps AI-generated pages away from backend code — deciding whether to split, freezing the contract first, doing the logical split before the physical one, and keeping the two sides in sync afterwards. 前后端同仓拆分、拆仓、仓库边界。",
    "skills/admin-guardrails/SKILL.md": "Use when AI-generated or newly written admin pages come out inconsistent (wrong components, hard-coded styles, ad-hoc layouts), reviewers keep repeating the same comments, someone proposes \"just write a rules doc\", or rules must fail fast without being blocked by legacy violations. 约束面：样板页、标准件、lint 棘轮、AI 入口文件。",
    "skills/admin-preview-loop/SKILL.md": "Use when AI-generated or edited admin pages cannot be run or seen without the real backend and login, when mock data is thin or empty, or when visual changes cannot be verified before merge. 反馈环：离线预览、固定种子 mock、截图与视觉回归。",
    "skills/admin-api-contract/SKILL.md": "Use when prototype or AI-generated admin pages must be connected to a real backend, pages contain their own request glue (param renaming, response unwrapping, enum mapping), mock fields drift from real responses, or nobody owns the API contract between frontend and backend. 对接面：数据层统一、契约先行、mock 与真实可切换。",
    "skills/admin-legacy-migration/SKILL.md": "Use when moving existing pages of a legacy admin system to the new standards — deciding what to migrate and in what order, running a migration batch, or verifying that a visual or structural refactor did not change behavior. 存量迁移：按价值排序、分批、截图对比。",
}
for path, want in expected.items():
    text = Path(path).read_text()
    got = text[text.index('description: '):].splitlines()[0][len('description: '):]
    if got != want or not got.startswith('Use when'):
        raise SystemExit(path + ' description 不是触发条件')
print('acceptance 2 ok')
PY
```

Expected: 退出码 0，标准输出 `acceptance 2 ok`。

- [ ] **Step 3: 验收 exposure**

Run:

```bash
node skills/admin-api-contract/scripts/assert-exposure.mjs
out=$(mktemp -d)
node scripts/generate-skeleton.mjs --gap docs/pilots/dingdong-ux-radar-insights/gap.ir.json --out-dir "$out"
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const gap = JSON.parse(readFileSync("docs/pilots/dingdong-ux-radar-insights/gap.ir.json", "utf8"));
if (gap.items.length !== 6 || gap.items.some((item) => item.exposure !== null)) {
  console.error("洞察池 gap 的 exposure 被改动");
  process.exit(1);
}
const mod = await import(pathToFileURL(process.argv[1]).href);
if (mod.tools.length !== 0) {
  console.error("洞察池 null exposure 产生了工具");
  process.exit(1);
}
const skill = readFileSync("skills/admin-api-contract/SKILL.md", "utf8");
if (!skill.includes("页面不 import `mcp-tools.stub.mjs`")) {
  console.error("页面步骤没有保持数据层");
  process.exit(1);
}
console.log("pilot exposure untouched");
' "$out/mcp-tools.stub.mjs"
status=$?
rm -rf "$out"
test "$status" -eq 0
git diff --exit-code origin/main -- skills/admin-api-contract/scripts/build-gap.mjs skills/admin-api-contract/schemas/gap.schema.json docs/pilots/dingdong-ux-radar-insights/gap.ir.json
```

Expected: `assert-exposure.mjs` 退出码 0 并打印 `exposure ok`。随后打印 `pilot exposure untouched`。`git diff` 退出码 0 且无输出。临时目录已删除。不要把生成物提交进仓库，也不要改洞察池的 `gap.ir.json`。

- [ ] **Step 4: 验收 vue2-element**

Run:

```bash
python3 - << 'PY'
import subprocess
from pathlib import Path
proc = subprocess.run(
    [
        "node", "skills/admin-guardrails/scripts/ratchet.mjs",
        "--config", "adapters/vue2-element/ratchet.config.json",
        "--root", "adapters/vue2-element",
        "--report",
    ],
    capture_output=True, text=True,
)
if proc.returncode != 0:
    raise SystemExit(proc.stderr)
expected = {
    "E1": (2, 2),
    "E2": (1, 1),
    "E3": (2, 2),
    "E4": (2, 2),
    "E5": (1, 1),
}
got = {}
for line in proc.stdout.splitlines():
    if not line.startswith("E"):
        continue
    rule_id, _message, total, files, _exempt = line.split("\t")
    got[rule_id] = (int(total), int(files))
if got != expected:
    raise SystemExit(f"report mismatch\n{got}")
for name in ("README.md", "ratchet.config.json", "kit-manifest.md"):
    if not Path("adapters/vue2-element", name).is_file():
        raise SystemExit("缺少 " + name)
if not Path("adapters/vue2-element/fixtures/pages/violating/list.vue").is_file():
    raise SystemExit("缺少违规列表夹具")
if not Path("adapters/vue2-element/fixtures/pages/violating/detail.vue").is_file():
    raise SystemExit("缺少违规详情夹具")
if not Path("adapters/vue2-element/fixtures/pages/fixed/list.vue").is_file():
    raise SystemExit("缺少固定页夹具")
if Path("adapters/vue2-element/ratchet-baseline.json").exists():
    raise SystemExit("不应提交或生成 ratchet-baseline.json")
needles = ("el-table", "el-form", "this.$http")
roots = [Path("skills"), Path("scripts"), Path("adapters/dd-design"), Path("adapters/README.md")]
for root in roots:
    files = [root] if root.is_file() else root.rglob("*")
    for path in files:
        if not path.is_file():
            continue
        text = path.read_text(errors="ignore")
        for needle in needles:
            if needle in text:
                raise SystemExit(f"{path} 含有 {needle}")
print("acceptance 4 ok")
PY
```

Expected: 退出码 0，标准输出 `acceptance 4 ok`。

- [ ] **Step 5: 验收版本说法，并保持分数表与复测勾选不动**

Run:

```bash
python3 - << 'PY'
import json
from pathlib import Path
plugin = json.loads(Path('.claude-plugin/plugin.json').read_text())
assert plugin['version'] == '0.6.0'
changelog = Path('CHANGELOG.md').read_text()
head, rest = changelog.split('## 0.5.0', 1)
assert '## 0.6.0' in head
assert '仍只有表头' in head
assert '未勾' in head
readme = Path('README.md').read_text()
assert '## 状态（0.6.0）' in readme
assert 'docs/runtime-loading.md' in readme
assert 'vue2-element/' in readme
assert '尚未 push' not in readme
assert '薄数据层已经合并' in readme
roadmap = Path('docs/roadmap-0.6.0.md').read_text()
assert '- [ ] 全新 agent 复测：' in roadmap
assert '- [x] 全新 agent 复测' not in roadmap
scores = [line for line in Path('docs/ai-benchmarks/scores.csv').read_text().splitlines() if line.strip()]
assert scores == ['date,benchmark,model,first_pass,rework_minutes,causes,notes']
old = Path('docs/roadmap-0.5.0.md').read_text()
assert '进 0.6，本轮不做' in old
assert '- [ ] 差距表里 `exposure: rest | bff | mcp` 三选一' in old
print('acceptance 5 ok')
PY
git diff --exit-code origin/main -- docs/roadmap-0.5.0.md docs/pilots/dingdong-ux-radar-insights skills/admin-modernize/SKILL.md
```

Expected: Python 打印 `acceptance 5 ok`。`git diff` 退出码 0 且无输出。到这里五条验收都通过，并且没有改 `scores.csv`，也没有把复测项勾上。本任务不提交。
