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
.claude-plugin/plugin.json
docs/roadmap-0.5.0.md         0.5.0 改进清单
docs/pilots/dingdong-ux-radar-insights/  洞察池契约试点（pilot-source 为接回前快照；雷达本机分支已接薄层，尚未 push）
scripts/generate-skeleton.mjs 差距表过了人工门禁之后写映射骨架
skills/
  admin-modernize/            编排：阶段、门禁、决策点 D1–D5、红线
    references/metrics-and-eval.md   指标、基准评测、治理
  admin-recon/                阶段 0 摸底
    scripts/inventory.mjs     通用盘点：拓扑（单仓/分仓）、栈、规模、活跃度、UI 与数据层信号、AI 就绪度
    references/topology.md    拓扑怎么读、对应哪个 playbook
  admin-repo-split/           前后端同仓拆分：契约先行、逻辑拆→物理拆、发布顺序与回滚
  admin-guardrails/           约束面
    scripts/ratchet.mjs       通用「只减不增」规则检查器
    scripts/ratchet.config.example.json
    scripts/map-tokens.mjs    硬编码值 → 现有 token 的映射清单（存量迁移清单）
    references/ai-entry-files.md     入口文件与 new-page skill 的结构
  admin-preview-loop/         反馈环：离线预览、mock、截图、视觉回归
  admin-api-contract/         对接面：数据层、契约先行、校验、晋升清单
    references/data-layer-checklist.md
    references/ir-schema.md   desired / actual / gap 三份 IR
    schemas/                  上述 IR 的 JSON Schema
    scripts/extract-desired.mjs
    scripts/build-gap.mjs
    scripts/check-contract.mjs  录制或现场响应对照 response.fields，日志里计数
    scripts/README.md         薄封装名单、怎么扩展、认不出 URL 就跳过
    fixtures/sample-app/      抽取与差距的合成样例
    fixtures/thin-wrappers/   get/post/api 薄封装样例
    fixtures/contract-check/  check-contract 的好/坏样本
  admin-legacy-migration/     存量迁移
adapters/
  README.md                   adapter 是什么、怎么新建
  dd-design/                  React + @ddfe/dd-design 的规则包与标准件清单（来自 h5-fms-v3）
```

## 试用

在目标仓库里启动 Claude Code 时加载本目录，然后说「摸底一下这个后台」或「按 admin-modernize 改造这个后台」：

```bash
claude --plugin-dir /Users/liujiayuan/App/admin-modernize
```

脚本也能单独跑：

```bash
node skills/admin-recon/scripts/inventory.mjs --topology <仓库>              # 先判单仓/分仓
node skills/admin-recon/scripts/inventory.mjs <仓库> --json /tmp/inventory.json
node skills/admin-guardrails/scripts/ratchet.mjs --config <规则配置> --root <仓库> --report
node skills/admin-guardrails/scripts/map-tokens.mjs --tokens <token 文件或目录> --scan <代码目录>
node skills/admin-api-contract/scripts/extract-desired.mjs --root <原型目录> --out /tmp/desired.ir.json
node skills/admin-api-contract/scripts/build-gap.mjs --desired /tmp/desired.ir.json --actual <openapi.json> --out /tmp/gap.ir.json
node skills/admin-api-contract/scripts/check-contract.mjs --actual <actual.ir.json> --samples <录制目录>
node scripts/generate-skeleton.mjs --gap /tmp/gap.ir.json --out-dir /tmp/skeleton
```

## 状态（0.4.0）

0.4.0 加了三件：`inventory.mjs --topology` 判单仓/分仓、`admin-repo-split` 拆仓 playbook、`map-tokens.mjs` 把硬编码值映射到现有 token。

用子 agent 做过压力测试：6 个场景（编排、摸底、约束面、反馈环、对接面、存量迁移），每个场景都叠加了时间、领导背书、「别问我」「写份文档就行」「不用截图」等压力。第一轮 6 组带 skill、5 组不带 skill 的基线（反馈环基线未跑完）；按结果改了 skill 和脚本后，对摸底、约束面（含「CI 红了」新场景）、存量迁移用全新 agent 复测。

| 部分 | 状态 |
|---|---|
| 六个 skill | 第一轮除摸底外全部通过预注册评分表；摸底被「只贴表」压过，已改，复测通过。每个场景只跑了 1 次，不是统计结论 |
| `ratchet.mjs` | 复现参考 lint 的数字；测试中发现并修掉两个漏洞：重写基线可洗白新增违规（现默认拒绝，需 `--allow-increase`）、`lint-allow` 不写原因也算豁免（现不算） |
| `inventory.mjs` | 在 React 仓库、合成的 Vue 2 加 jQuery 样例、无 package.json 的 JSP 样例上跑过 |
| `inventory.mjs --topology` | 在 5 个合成样例上判定正确：monorepo 全栈、纯前端单仓、两个 git 仓的父目录（自动展开）、JSP 服务端渲染、Node 全栈。6 层浅扫描，判形态够用，不当审计 |
| `map-tokens.mjs` | 在合成 token 样例上跑通：CSS 变量 / SCSS 变量 / JSON 对象三种来源，hex、rgb、hsl、透明度、字号刻度、歧义、无对应、token 自身冲突都覆盖到 |
| `admin-repo-split` | 只有流程文档：契约先行、逻辑拆→物理拆、验收、回滚。`git filter-repo` 的命令没有在真实历史数据上跑过 |
| dd-design 规则包 | 7 条与参考 lint 对账一致；S3 修了漏单行写法（84 到 186），新增 S4（rgb/hsl） |
| 反馈环「交付必含」 | 补写后用全新 agent 复测：Vue 2 + Element UI + vue-cli + axios 场景，用户施压「示例数据写死在组件里」。6 项评分全过（mock 在网络层、环境开关加生产包检查、固定种子加状态矩阵、截图脚本含收集项并非零退出、一条命令启动、页面组件未改）。缺的项（截图脚本未运行、基准图未存）都写了原因和补法。1 次，不是统计结论 |
| 未验证 | 反馈环基线组；编排、对接面的修订版没有复测；截图命令从未在真实浏览器里跑过；vue-cli 构建与 mock 中间件没在真实项目里跑过；约束面、存量迁移没有第二次复测；拓扑扫描没在真实单仓/分仓上验证过；拆仓流程没实际拆过任何仓库；`map-tokens.mjs` 没在真实主题文件上验证过。第二个后台的契约流水线和 `check-contract` 在洞察池源码副本上跑过（录制/合成响应，`docs/pilots/dingdong-ux-radar-insights/`）。雷达仓本机分支 `feat/insights-thin-api` 已用薄数据层接回，尚未 push；本仓库的 `pilot-source/` 仍是接回前快照。没有起雷达进程，没有跑浏览器 |

本目录还不是 git 仓库。
