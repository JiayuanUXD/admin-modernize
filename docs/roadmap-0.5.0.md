# admin-modernize 0.5.0 改进清单

版本主题：**对接面可生成 + 一个真实试点闭环**。不扩新层，把现有 skill 补成「跑完能交东西」。

依据：当前仓库 0.4.0 状态（对接面偏流程、真实第二后台未闭环、评测多为单次），以及与 legacy2mcp / OpenAPI 对接实践的差距分析。

---

## P0（不做这三项，0.5 不算成立）

### 1. `admin-api-contract`：补「差距 → 生成物」流水线

现状偏流程文档；缺可重复执行的中间产物与生成步骤。

IR、抽取 / 差距脚本、人工门禁、骨架生成和响应校验（`check-contract.mjs`）已经落地。typed client 仍是骨架（`client.stub.mjs`），不是完整生成的类型化客户端。不一致数从校验日志的 `CONTRACT_SUMMARY` 读取，不从 gap 的 reshape 条数读取。

- [x] 定义 IR（JSON）：`desired-openapi`、`actual-capabilities`（带 `file:line`）、`gap-table`（match / reshape / missing）
- [x] 增加脚本：从页面调用点 / 数据层 / mock 抽「期望契约」草稿（允许不全，人工补）
- [x] 增加脚本或 skill 步骤：对照后端 OpenAPI / 代码，产出差距表
- [x] 人工门禁：勾选每条缺口的处置（直连 / BFF 映射 / pending）
- [x] 生成最小产物：映射层骨架 + typed client 入口 + `mock|real|pending` 配置表（typed client 为骨架，不是完整客户端）
- [x] 验收：试点页切真接口时，契约不一致数可从校验日志计数（对齐 D1）。洞察池 `samples/` 的汇总是 `mismatch_count=0`，`samples-bad/` 是 `mismatch_count=1`。见 `docs/pilots/dingdong-ux-radar-insights/d1-notes.md`

### 2. 编排 skill：默认 D4 = 原型先行（可覆盖）

主场景是 AI 高保真原型对接老后台。

- [x] `admin-modernize` 写明：无既有 OpenAPI 时默认「原型先行契约」
- [x] 有成熟 OpenAPI 时走「后端先行」，决策卡只问一次
- [x] 红线补一条：禁止 UI 与契约双源手写维护

### 3. 真实试点闭环（一个后台、一条需求）

README 已承认第二后台未跑过——这是最大风险。试点目录：`docs/pilots/dingdong-ux-radar-insights/`（叮咚买菜 · 小红书体验雷达，洞察池列表 + 抽屉）。

- [x] 选 1 个真实需求（列表+表单/抽屉，接口 3–8 个）— 洞察池列表 + 详情抽屉，6 个接口
- [ ] 阶段 0→1 全跑通：摸底 → 最小约束面 → 离线预览 → 接测试环境 → 上线或可合并
  - [x] 已直连后台的「接测试环境」（整段 0→1 只半勾到这里）：本插件仓未改雷达 UI。`check-contract` 对着洞察池 6 条录制/合成响应跑通；`--base` 留给已经起来的本地或测试服务，连不上记 `CONTRACT_ERROR`，不计入不一致数。`pilot-source/` 不是可启动的完整服务，本项不起雷达进程。
  - [ ] 最小约束面、离线预览。清单在试点 README，指向 `admin-guardrails` 和 `admin-preview-loop`。本次不跑浏览器。
  - [x] 上线或可合并。可合并材料是内网仓 `dingdong-ux-radar` 分支 `feat/insights-thin-api` 的薄数据层，加上本目录契约与骨架。`ui/insights-api.js` 的 `createInsightsApi(get, post)` 方法名对齐 `skeleton/client.stub.mjs`；`ui/app.js` 只改 facets / list / detail / claim / status / note；`ui/index.html` 先加载 `insights-api.js`。用户本机已提交。尚未 push，内网 GitLab MR 由用户决定何时开。未把会 throw 的 ESM stub 原样上线；disposition 仍是 `direct`，行为与接回前一致。`pilot-source/` 仍是接回前快照，与该分支有意不一致。最小约束面和离线预览仍未做，所以整段 0→1 不勾。
- [x] 记 D1 四项指标的现值和试点后值 — 见该目录 `d1-notes.md`。契约不一致数从 `CONTRACT_SUMMARY mismatch_count` 计数；6 条 gap `reshape` 不是这个数
- [x] 把踩坑写回对应 skill 的「常见错误 / 红线」（改设施，不改那一页）— `admin-api-contract`：包装层抽取、无 OpenAPI 时用 actual IR、`set_status` 的 note 缺省语义

---

## P1（显著提升可复用与可信度）

### 4. `admin-recon`：能力盘点带出处（吸收 legacy2mcp 长处）

- [ ] 可选模式：按模块列出「页面已用接口 / 数据层方法」，每条附源码位置
- [ ] 禁止无出处的「推测 API」进入 gap-table
- [ ] 拓扑扫描在真实单仓/分仓各验 1 次，修正误判说明

### 5. `admin-preview-loop`：截图命令真跑

- [ ] 在真实浏览器跑通截图命令（桌面+窄屏）
- [ ] CI 冒烟：未 mock 请求 → 非零退出
- [ ] 补「反馈环」无 skill 基线组（README 欠账），至少 1 轮对照

### 6. 评测与评分表落地

- [ ] 建 `docs/ai-benchmarks/`：3 条脱敏基准需求 + 契约片段
- [ ] CSV 评分表按 `metrics-and-eval.md` 字段落盘
- [ ] 编排 / 对接面修订版各复测 ≥1 次全新 agent（压力话术保留）

### 7. `admin-repo-split`：从文档到可演练

- [ ] 用合成 monorepo 演练「逻辑拆」验收清单（不必真物理拆生产仓）
- [ ] `filter-repo` 命令在合成历史上跑通，结果写进 skill
- [ ] 明确：无发布节奏/所有权压力时，默认仓内隔离，不进物理拆

---

## P2（增强项，可进 0.6）

### 8. 可选 MCP/Agent 暴露面

- [ ] 差距表里 `exposure: rest | bff | mcp` 三选一
- [ ] 仅对「Agent 要直接调」的能力生成 MCP tool 包装；页面路径仍走数据层

### 9. Adapter 扩一个非 dd-design 栈

- [ ] 选 Vue2+Element 或团队第二常见栈，按 `adapters/README` 建第二 adapter
- [ ] 验证「通用 skill + adapter」边界是否干净

### 10. 多 runtime 包装

- [ ] 保持 Claude plugin；加薄层说明：Cursor / 其他 agent 如何加载本插件目录
- [ ] description 保持「Use when…」触发条件，不在 description 里摘要流程

### 11. 仓库卫生

- [ ] README「本目录还不是 git 仓库」与 GitHub 现状对齐
- [ ] 版本号、变更日志、CODEOWNERS（标准件/规则包负责人）

---

## 建议排期（约 2–3 周量级）

| 周 | 做完 |
|---|---|
| 第 1 周 | P0-1 IR+差距表+门禁；P0-2 D4 默认；开真实试点摸底 |
| 第 2 周 | P0-1 生成物；P0-3 试点接到测试环境；P1-5 截图真跑 |
| 第 3 周 | P0-3 指标回写；P1-4/6 评测与出处；P1-7 合成拆仓演练 |

## 刻意不做（0.5 范围外）

- 全量存量视觉统一
- 无 API 老界面的 Workflow 录制
- 一次物理拆真实生产仓
- 为「好看」而新建第二套设计 token
