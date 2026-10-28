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
docs/ai-benchmarks/           3 条脱敏基准需求、评分表（目前为无 skill 基线）、复测剧本
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

0.4.0 加了三件：`inventory.mjs --topology` 判单仓/分仓、`admin-repo-split` 拆仓 playbook、`map-tokens.mjs` 把硬编码值映射到现有 token。0.5.0 补上出处盘点、gap 的出处门禁、反馈环的人工对照、三条基准需求，以及合成仓上的逻辑拆和 `git filter-repo`。0.6.0 补上可独立开跑的复测剧本、`docs/runtime-loading.md`、`generate-skeleton` 对 `exposure` 的解释，以及 `adapters/vue2-element/`。`scores.csv` 有两行无 skill 基线（编排、对接面各一）；带 skill 的两行见 2026-10-28 补测。

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
| 评测 | `docs/ai-benchmarks/` 有 3 条需求和 `scores.csv`。表里 2 行都是无 skill 基线（没加载插件），只说明裸模型在压力下的表现。2026-10-28 补了带 skill 的两行：同一压力话术下，基线组照做，带 skill 组全部顶住（子 agent 读 skill 文字，不是真加载插件；每组 1 次） |
| 未验证 | vue-cli 构建与 mock 中间件没在真实项目里跑过；约束面、存量迁移没有第二次复测；`map-tokens.mjs` 没在真实主题文件上验证过；没有第二个真实业务仓可做分仓扫描，分仓那一次是合成的两个 git 目录。第二个后台在洞察池源码副本上跑过契约流水线、`check-contract`（录制/合成响应）和棘轮基线（未改 `pilot-source` UI）。离线预览跑的是 skill fixture。内网仓 `dingdong-ux-radar` 分支 `feat/insights-thin-api` 的薄数据层已经合并。没有起雷达进程。P2-8 已由 `generate-skeleton` 解释 `exposure`。P2-9 是 `adapters/vue2-element/`。P2-10 的加载说明在 `docs/runtime-loading.md` |
