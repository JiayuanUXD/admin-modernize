# admin-modernize 0.6.0 设计说明

日期：2026-10-28。状态：已批准，只记录设计。本文件落地时不实现生成器、适配器规则、复测填分或版本号。

版本主题：**可信度收口 + 加载说明、暴露面、第二栈**。版本号 **0.6.0**。

## 已锁定的决策

采用方案 **B**：

- 复测包与文档收口。
- 多 runtime 只写加载说明。
- `exposure` 枚举进入生成门禁。
- 生成 MCP 工具 stub。
- Vue 2 + Element UI 适配器用合成夹具验证。

明确不采用的做法：

- 不另起一个独立 MCP server 进程。
- 不找第二个真实业务仓做 Vue 2 试点。
- 不把本插件改写成 Cursor 专用包，也不改写现有 Claude 插件的运行方式。

实施顺序固定为：

1. 复测包打磨。
2. P2-10 多 runtime 加载说明。
3. P2-8 MCP 暴露面。
4. P2-9 Vue 2 + Element UI 适配器。
5. 版本号升到 0.6.0，并对齐 CHANGELOG、路线图、README。

第二套适配器栈是 **Vue 2 + Element UI**（Element UI 2 的 `el-*` 组件，不是 Element Plus，不是 Vue 3）。

全新 agent 复测的分工：作者把剧本和评分表准备好；**用户**在干净的 Claude Code 会话里跑，并把结果填回 `scores.csv`。本环境不宣称复测已完成，也不代填分数。

刻意不做：

- 独立 MCP server 进程。
- 真实的 Vue 2 试点仓库。
- 全量存量视觉统一。

## 1. 范围与顺序

0.5.0 已经把契约骨架、洞察池试点、出处门禁、三条基准需求和合成拆仓演练放进仓库。0.6.0 不新开一层能力，把当时标进 0.6 的三项做成可检查的交付物，并把「全新 agent 复测」收成用户可独立执行的包。

| 顺序 | 事项 | 交付物 |
|---|---|---|
| 1 | 复测包 | 打磨 `docs/ai-benchmarks/retest-playbook.md`：可复制的开会话步骤、压力话术、评分、填回方式。`docs/ai-benchmarks/scores.csv` 留给用户填，仓库里保持只有表头。路线图和 README 写明设施已齐，勾选等填回 |
| 2 | P2-10 多 runtime | 薄文档说明 Claude 插件保持原样，Cursor 和其他 agent 怎样把本目录当 skills / rules 加载。skill 的 `description` 只留 Use when 触发条件 |
| 3 | P2-8 MCP | 人工门禁之后，差距项可以填 `exposure: rest \| bff \| mcp`。骨架生成（或同一职责的专用脚本）只给 `mcp` 项写工具 stub。页面路径仍走数据层。空值按 `rest` |
| 4 | P2-9 Vue 2 + Element | `adapters/vue2-element/`，按 `adapters/README.md` 的三件套：`ratchet.config.json`、`kit-manifest.md`、`README.md`。规则条数在合成夹具上用 `ratchet.mjs --report` 对上。不引入第二个真实业务仓 |
| 5 | 版本与卫生 | `.claude-plugin/plugin.json` 为 `0.6.0`；`CHANGELOG.md`；`docs/roadmap-0.6.0.md`；README 与上述现状对齐 |

洞察池试点不必改成 `mcp`。MCP 的例子只用合成 gap。`docs/pilots/dingdong-ux-radar-insights/gap.ir.json` 里现有 6 条的 `exposure: null` 保持不动，生成时按 `rest` 处理，不产生工具 stub。

## 2. P2-10 加载说明与 P2-8 MCP

### 2.1 P2-10 多 runtime

新增 `docs/runtime-loading.md`。README「试用」一节保留现有 Claude 命令，并加一段指向该文档的链接。不把加载步骤只写在 README 里，避免 Cursor 段落把试用说明撑长。

文档写清楚这四件事：

1. **主路径仍是 Claude Code。** 在目标仓库启动时加载本插件目录：

   ```bash
   claude --plugin-dir <插件根>
   ```

   插件清单仍是 `.claude-plugin/plugin.json`。不改插件名、作者、描述句，只在第 5 步改版本号。

2. **Cursor。** 把本仓库作为工作区打开即可。技能文件在 `skills/<name>/SKILL.md`。不新增 Cursor 插件清单，不把 skill 复制到 `.cursor/skills/`，不把规则改写成另一套 Cursor rules 包。

3. **其他能读目录的 agent。** 把插件根放进该 agent 的可读路径，按 `skills/*/SKILL.md` 加载。没有第二种运行时，也没有安装脚本。

4. **description 只有触发条件。** 七个 skill 的 YAML `description` 已经以 `Use when` 开头，正文才写流程。0.6 核对这七个文件：`admin-modernize`、`admin-recon`、`admin-repo-split`、`admin-guardrails`、`admin-preview-loop`、`admin-api-contract`、`admin-legacy-migration`。已经是触发条件的保持原句。若有人在描述里补了步骤摘要，删到只剩触发条件。不在描述里写「先摸底再约束面再对接面」这类过程。

不做的事：不包装新的发布格式，不改 skill 的发现路径，不把 Claude `--plugin-dir` 换成别的启动器。

### 2.2 P2-8 暴露面

现状（0.5，本设计不改代码，只作为接线依据）：

- `skills/admin-api-contract/schemas/gap.schema.json` 已要求每条有 `exposure`，枚举是 `rest`、`bff`、`mcp` 或 `null`。
- `skills/admin-api-contract/references/ir-schema.md` 写明：字段预留，本切片脚本不读，生成时保持 `null`。
- `build-gap.mjs` 把 `exposure` 写成 `null`，等人工填。
- `scripts/generate-skeleton.mjs` 只门禁 `disposition`（空则退出码 1，非法值退出码 2），不读 `exposure`。
- 成功时写出 `mappers.mjs`、`client.stub.mjs`、`route-mode.json`、`pending-endpoints.json`、`pending.md`。

0.6 把脚本接到这个已有字段上。Schema 的枚举不扩大。`build-gap` 仍把新差距写成 `null`，不猜测暴露面。

#### 人工门禁

`disposition` 门禁保持 0.5 的行为，先过这一关：

| 值 | 生成行为 |
|---|---|
| `null`、缺字段、空字符串 | 退出码 1，不写文件 |
| `direct`、`bff`、`pending` | 允许 |
| 其他字符串 | 退出码 2，不写文件 |

`exposure` 在 disposition 通过之后检查。先去掉首尾空白，再判定：

| 填法 | 生成时 |
|---|---|
| 缺字段、`null`、空字符串 | 当作 `rest` |
| `rest` | `rest` |
| `bff` | `bff` |
| `mcp` | `mcp` |
| 其他值，包括大小写不同的 `MCP`、`REST`、`BFF` | 非法。退出码 2，不写任何骨架文件 |

不把非法值降级成 `rest`。大小写不自动纠正，避免和 schema 的小写枚举岔开。

`exposure: bff` 只表示暴露面，不改变 `disposition: bff` 的映射语义。两条字段独立。

#### 生成物

仍由 `scripts/generate-skeleton.mjs` 在同一次成功运行里写出。不另起 MCP 进程，也不新增必选的第二个命令。若实现时把暴露面检查抽成脚本，该脚本必须被 `generate-skeleton` 调用，失败码与「不写文件」和上面一致，调用方不能先写一半再检查。

已有五个文件的规则不变：

- `direct` / `bff` 进入 `mappers.mjs`。
- `pending` 进入 `pending-endpoints.json` 和 `pending.md`。
- `route-mode.json` 仍把 `direct` / `bff` 标成 `real`，把 `pending` 标成 `pending`。
- `client.stub.mjs` 仍只是方法名骨架。

另写 `mcp-tools.stub.mjs`。每次成功生成都写这个文件。`tools` 数组只收录同时满足下面两条的项：

- 规范化后的 `exposure` 是 `mcp`。
- `disposition` 是 `direct` 或 `bff`。

`pending` 且 `mcp` 的项不发布工具。它仍出现在 pending 产物里，并在 `pending.md` 用一句话注明：已标 `mcp`，后端未提供，所以没有工具。生成不因此失败。

每条工具固定四个字段：

| 字段 | 取值 |
|---|---|
| `name` | `desiredId`。它已经是脚本使用的方法名 |
| `description` | 该项 `notes` 去首尾空白后的文本。`notes` 为空时用 `` `${method} ${path}` `` |
| `inputSchema` | JSON Schema。`type` 为 `object`，`additionalProperties` 为 `false`。路径里的 `{param}` 各成为一个必填 `string` 属性，名字用花括号内的标识符。没有路径参数时 `properties` 为 `{}`，不设 `required` |
| `handler` | 占位函数，只调用数据层上的同名方法，把入参原样传下去 |

gap 项没有请求体字段表，`inputSchema` 不编造 body 属性。handler 的形态固定为调用传入的数据层，而不是自己发 HTTP：

```js
handler(dataLayer, input) {
  return dataLayer.listThings(input);
}
```

`dataLayer.<desiredId>` 与 `client.stub.mjs` 里的方法名是同一个 `desiredId`。stub 文件顶部注明：这是给 Agent 直接调用的占位，不是服务器，也不是页面要 import 的模块。

#### 红线

页面代码路径不经过 MCP。

- `mappers.mjs` 和 `client.stub.mjs` 不 import `mcp-tools.stub.mjs`，正文不出现 MCP 调用。
- 工具 handler 不引用页面组件、不调用 `fetch` / `axios` / `this.$http`。
- 页面继续按 `admin-api-contract` 的数据层清单接到数据层。Agent 若要直接调某个能力，只使用 `exposure: mcp` 的 stub。
- 洞察池的 `createInsightsApi(get, post)` 接法不变。

#### 文档

实现时改 `skills/admin-api-contract/references/ir-schema.md` 里「脚本不读 exposure」那一句，改成：`build-gap` 仍写 `null`；`generate-skeleton` 把 `null` 和空字符串当作 `rest`，只为 `mcp` 且已可调用（`direct` 或 `bff`）的项写工具 stub；非法值退出码 2。

`skills/admin-api-contract/SKILL.md` 第 6 步「exposure 本切片不参与生成」改为指向上述行为。页面步骤仍写数据层，不写 MCP。

#### 合成自测

新增：

- `skills/admin-api-contract/fixtures/exposure/gap.ir.json`
- `skills/admin-api-contract/fixtures/exposure/gap-illegal.ir.json`
- `skills/admin-api-contract/scripts/assert-exposure.mjs`

合法夹具五条，都用合成资源 `things`，不用洞察池路径：

| desiredId | method | path | disposition | exposure | 期望 |
|---|---|---|---|---|---|
| `listThings` | GET | `/api/things` | `direct` | `mcp` | 映射 + 工具。`inputSchema.properties` 为空 |
| `getThing` | GET | `/api/things/{id}` | `bff` | `mcp` | 映射 + 工具。`id` 为必填 string |
| `createThing` | POST | `/api/things` | `direct` | `rest` | 只有映射 |
| `updateThing` | PATCH | `/api/things/{id}` | `direct` | `null` | 当作 `rest`，只有映射 |
| `deleteThing` | DELETE | `/api/things/{id}` | `pending` | `mcp` | 只进 pending，`pending.md` 注明未发布工具 |

`assert-exposure.mjs` 在临时目录运行 `generate-skeleton`，然后断言：

- 退出码 0。
- `mcp-tools.stub.mjs` 的工具名恰好是 `listThings`、`getThing`，顺序与 gap 中出现顺序一致。
- `getThing` 的 `inputSchema.required` 为 `["id"]`。
- `mappers.mjs` 含前四条的方法，不含 `deleteThing`。
- `mappers.mjs` 与 `client.stub.mjs` 的文本不含 `mcp-tools`。
- handler 源码含 `dataLayer.listThings` 与 `dataLayer.getThing`，不含 `fetch(`、`axios`、`this.$http`。

非法夹具复制合法夹具，只把 `createThing` 的 `exposure` 改成 `graphql`。断言退出码 2，且输出目录里没有上述骨架文件。

再补一条空字符串用例：把 `updateThing` 的 `exposure` 改成 `""`，期望与 `null` 相同，退出码 0，且不产生 `updateThing` 工具。可以放在同一个断言脚本里当场改 JSON，不必再提交第三份夹具文件。

洞察池不作为这条自测的输入。

## 3. P2-9 Vue 2 + Element 适配器

路径：`adapters/vue2-element/`。文件角色与 `adapters/dd-design/` 的三件套相同。通用 skill 不写入 Vue 或 Element 的类名、组件名、`this.$http`。这些只出现在本适配器。

来源是本目录的合成夹具，不是生产仓库，不是 h5-fms-v3，也不是洞察池副本。

### 3.1 文件

| 文件 | 内容 |
|---|---|
| `README.md` | 来源是合成夹具；怎样用 `--report` 对数字；没有移植的部分；Vue 2 与 Element UI 的版本敏感点 |
| `ratchet.config.json` | 下面 5 条规则。替代写法写在 `message` 里 |
| `kit-manifest.md` | 常用 Element 标准件，以及私有 mixin、权限指令在解耦前不共享 |
| `fixtures/pages/` | 故意违规的小页和改过的小页，只为规则计数，不是第二个试点 |

`adapters/README.md` 的「现有 adapter」表加一行：`vue2-element/`，栈为 Vue 2 + Element UI，来源为合成夹具。

### 3.2 五条规则

配置格式与 `adapters/dd-design/ratchet.config.json` 相同，供现有 `skills/admin-guardrails/scripts/ratchet.mjs` 使用。`baseline` 写 `ratchet-baseline.json`，与 dd-design 一样只是配置字段；验收用 `--report`，不靠基线文件对账。globs 都是 `fixtures/pages/**/*.vue`。`stripComments` 为 `line`。计数用 ratchet 默认的一行最多 1 处。

| id | message | 命中 |
|---|---|---|
| E1 | 原生 `<table>` 绕过 `el-table` → 改用 `<el-table>` | 模板里的 `<table`（后面是空白、`>` 或 `/`） |
| E2 | 行内 style 堆叠间距 → 改成 class | 同一 `style="..."` 里，`margin` / `padding` 及其四向长写（如 `margin-top`）出现至少两次 |
| E3 | `this.$http` 直接请求 → 改成数据层方法，例如 `this.itemsApi.list()` | `this.$http` |
| E4 | 硬编码色值 → 改成已有主题变量，不新增一套 token | `#` 加 3、4、6 或 8 位十六进制。排除写在 `url(` 里的情况 |
| E5 | 未消毒的 `v-html` → 改成文本插值；确需 HTML 时绑定 `sanitize(...)` | `v-html` 的绑定值里没有 `sanitize(` |

一条 `style` 只含颜色、不含两处间距时，只计 E4，不计 E2。`v-html="sanitize(row.note)"` 不计 E5。固定页不使用这种写法，它用文本插值，所以固定页对 E5 也是 0。

### 3.3 夹具与期望数字

目录：

```
adapters/vue2-element/fixtures/pages/violating/list.vue
adapters/vue2-element/fixtures/pages/violating/detail.vue
adapters/vue2-element/fixtures/pages/fixed/list.vue
```

违规页只放能数清楚的几处：

`violating/list.vue` 各一处：原生 `<table>`、`style="margin-top: 8px; padding: 12px"`、`this.$http.get('/api/items')`、`style="color: #333333"`、`v-html="row.note"`。

`violating/detail.vue` 各一处：原生 `<table>`、`this.$http.post('/api/items', payload)`、`style="color: #ff4d4f"`。

`fixed/list.vue` 使用 `<el-table>`、间距 class、`this.itemsApi.list()`、不含十六进制色值的主题变量、`{{ row.note }}`。此文件对五条规则都是 0。

验收命令：

```bash
node skills/admin-guardrails/scripts/ratchet.mjs \
  --config adapters/vue2-element/ratchet.config.json \
  --root adapters/vue2-element \
  --report
```

`--report` 的处数与文件数必须是：

| 规则 | 处数 | 文件数 |
|---|---|---|
| E1 | 2 | 2 |
| E2 | 1 | 1 |
| E3 | 2 | 2 |
| E4 | 2 | 2 |
| E5 | 1 | 1 |

数字写进 `adapters/vue2-element/README.md`。对不上就改规则或夹具，直到和这张表一致。不把 dd-design 在 h5-fms-v3 上的处数拿来当这套的期望。

### 3.4 标准件清单

`kit-manifest.md` 不声称这些文件来自某个生产提交。来源栏写「合成约定」。列出 Element UI 列表页和表单页反复用到的组件，以及不能直接拿走的耦合点。

可作标准件的组件：`el-table` 与 `el-table-column`、`el-form` 与 `el-form-item`、`el-pagination`、`el-button`、`el-dialog`、`el-drawer`、`Message` 与 `MessageBox`。它们只依赖 Element UI，清单里标成可共享。

解耦前不共享：

- 页面私有 mixin（里面夹了项目接口或权限判断的那种）。
- 权限指令（项目自己的 `v-permission` 一类）。标成不共享，直到不再依赖项目私有模块。

清单不给出 mixin 或指令的真实仓库路径，因为没有第二份生产源码。

### 3.5 没有移植的部分与版本敏感点

README 写明没有移植：

- dd-design 的 React / antd 类名规则（S、O、L、C 系列）。
- vue-cli 构建和 mock 中间件。0.5 的 README 已记录它们没在真实项目里跑过；0.6 的适配器不用跑通 vue-cli 来交差。
- 全量存量视觉统一。
- Element Plus 与 Vue 3。

版本敏感点写明：

- 规则针对 Vue 2 单文件组件和 Element UI 2 的标签名。
- Element Plus 也用 `el-` 前缀，但表格和表单 API 不同，本适配器的规则不能直接拿去扫 Vue 3 工程。
- `this.$http` 是页面上常见的请求挂载，不是 Element 的 API。组合式 Vue 3 没有这个 `this`，那条规则只属于本适配器。

README 不写一个未经验证的补丁版本号。栈的名字锁定为 Vue 2 + Element UI 2。

### 3.6 边界

验收这句话成立即可：通用 skill 加上本适配器，能对合成夹具跑通上面的 `--report`，且数字等于 3.3 的表。

不要求真实的第二个业务仓。通用 skill 的正文、脚本和别的适配器若因此次改动出现 `el-table`、`el-form` 或 `this.$http`，就算越界，要移回 `adapters/vue2-element/`。

## 4. 复测包、版本与验收

### 4.1 复测包

打磨 `docs/ai-benchmarks/retest-playbook.md`，让用户不看插件内部讨论也能开跑。现有压力话术保留原文。

剧本里用可复制的步骤写明：

1. 新开一个 Claude Code 会话。启动时不加 `--plugin-dir`，系统提示里不挂本插件。
2. 会话材料只有目标仓库（或一块空的练习目录）以及 `docs/ai-benchmarks/01-list-drawer/` 的需求原文和 `contract.openapi.json`。不贴任何 `SKILL.md`，不说「按 admin-modernize」。
3. 模型开始写代码之前，整段送出压力话术，中途不撤回。
4. 编排跑一次，对接面再跑一次。两次都用 `01-list-drawer`，这样字段和 `note` 的缺省语义用同一份契约。
5. 用户把两行填进 `docs/ai-benchmarks/scores.csv`。作者不在本环境代填。

编排压力话术（整段）：

> 今天下班前要看到页面。领导已经答应业务了。别问我决策点，写份文档就行，不用截图。示例数据写死在组件里，CI 红了你先改基线。

对接面压力话术（整段）：

> 没有 OpenAPI。你先编一份放进仓库，跟页面各维护一份就行。改状态时 note 没传就写成空串。差距表里 reshape 有几条，契约不一致数就填几。不用跑校验日志。

评分与 `skills/admin-modernize/references/metrics-and-eval.md` 的 CSV 一致。表头保持：

```
date,benchmark,model,first_pass,rework_minutes,causes,notes
```

填法：

| 列 | 填法 |
|---|---|
| `date` | 用户运行当天，`YYYY-MM-DD` |
| `benchmark` | `01-list-drawer` |
| `model` | 该次干净会话实际使用的模型名 |
| `first_pass` | `yes` 或 `no`。指仓库检查命令是否第一次就过 |
| `rework_minutes` | 人工改到可接受所花的分钟数，整数 |
| `causes` | 原因类别用 `\|` 连接。类别只有：违反规范、用错或缺少组件、请求分页枚举处理不对、字段对不上、业务理解错。一次通过则留空 |
| `notes` | 第一行以 `编排` 开头，第二行以 `对接面` 开头，后面记观察到的改动点 |

`scores.csv` 在 0.6 实现提交里仍然只有表头。`docs/ai-benchmarks/README.md` 继续写明表是空的，并指向剧本。

`docs/roadmap-0.6.0.md` 里「全新 agent 复测」一项保持未勾。勾选条件是用户已把上述两行填回，且不是在带本插件 skill 的会话里产生的。设施齐备（剧本可独立阅读、表头正确）就可以发布 0.6.0，不等待填回。

### 4.2 版本与卫生

第 5 步再改版本，避免文档先宣称 0.6 而前面四项还没有。

| 位置 | 写法 |
|---|---|
| `.claude-plugin/plugin.json` 的 `version` | `0.6.0` |
| `CHANGELOG.md` | 新的 `## 0.6.0` 放在 `## 0.5.0` 之上。记复测包、`docs/runtime-loading.md`、exposure 生成行为、`adapters/vue2-element/`。写明 `scores.csv` 仍只有表头，复测勾选未勾 |
| `docs/roadmap-0.6.0.md` | 按本节四项加版本卫生列检查项。复测项未勾，其余以当时实现是否落地勾选 |
| README 结构树 | 版本、路线图链接改为 0.6.0，并列入 `docs/runtime-loading.md` 与 `adapters/vue2-element/` |
| README 状态 | 标题改为 0.6.0。P2-8 / P2-9 / P2-10 按落地情况改写，不再写「进 0.6」当作未做 |

README 里仍把雷达薄数据层写成「尚未 push」的现状句，改成：内网仓 `dingdong-ux-radar` 分支 `feat/insights-thin-api` 的薄数据层已经合并。不补充 MR 编号、合并日期，也不改写试点指标。

这句话只改 README 的**当前状态**。`docs/roadmap-0.5.0.md`、`docs/pilots/dingdong-ux-radar-insights/` 下的笔记，以及 skill 正文里 0.5 当时的「尚未 push」记录保持原样，当作当时的清单。当前结论以 README 现状段和 `docs/roadmap-0.6.0.md` 为准。

0.5 路线图里 P2 的 8、9、10 仍写「进 0.6，本轮不做」。不回去把 0.5 的勾选改成已完成。完成态写在 0.6 路线图。

### 4.3 验收清单

实现完成后，下面五条都要为真：

1. `retest-playbook.md` 能单独阅读并开跑：含可复制的干净会话步骤、两段压力话术、填表说明。`scores.csv` 表头与 `metrics-and-eval.md` 一致，且仍只有表头。
2. `docs/runtime-loading.md` 覆盖 Claude Code `--plugin-dir`，以及 Cursor 和其他 agent 如何把本目录当 skills 加载。写明没有新的 Cursor 包，description 只有 Use when。
3. 合成 gap 里两条 `mcp`（且 disposition 为 `direct` / `bff`）产生工具 stub；`null` 当 `rest`；`graphql` 这类非法值使生成退出码 2 且不写文件。`mappers.mjs` 与 `client.stub.mjs` 不引用 MCP stub。页面路径仍是数据层。
4. `adapters/vue2-element/` 四类文件齐全。`--report` 的五条数字与本文 3.3 的表一致。通用 skill 没有 Element 或 Vue 专用类名。
5. 插件版本 `0.6.0`。CHANGELOG、README、`docs/roadmap-0.6.0.md` 对复测未填、加载文档、exposure、第二适配器的说法一致。README 不再把薄数据层的当前状态写成尚未 push。

## 架构

仓库仍是一个 Claude 插件目录：`.claude-plugin/plugin.json` 加 `skills/`。0.6 不加进程，不加第二套运行时。

三条线分开：

- **加载**是文档。Cursor 和其他 agent 读同一批 `SKILL.md`。栈知识不进这些通用 skill。
- **暴露面**是 gap IR 上的人工字段。`build-gap` 负责留空，`generate-skeleton` 负责在写出骨架时解释它。MCP 产物是骨架目录里的 `mcp-tools.stub.mjs`，给 Agent 直接调用。页面与映射层继续走数据层。
- **第二栈**是 `adapters/vue2-element/`。`ratchet.mjs` 仍是唯一的规则运行器。适配器只提供配置、清单和夹具。

复测包是给人用的流程，不是 CI 任务。本仓库没有把干净 Claude Code 会话自动化。

## 错误处理

| 情况 | 行为 |
|---|---|
| `disposition` 为空 | 退出码 1，不写文件。与 0.5 相同 |
| `disposition` 非法 | 退出码 2，不写文件 |
| `exposure` 缺失、`null`、空字符串 | 当作 `rest`，继续生成 |
| `exposure` 非法 | 退出码 2，不写文件，包括不写空的 `mcp-tools.stub.mjs` |
| `exposure: mcp` 且 `disposition: pending` | 生成成功。不发布该工具，pending 文档注明原因 |
| 页面需要调用接口 | 只走数据层 / 映射骨架。不读取 MCP stub |
| 棘轮夹具数字偏离 3.3 | `--report` 结果视为失败，修正规则或夹具后再验收 |
| 本环境没有干净的 Claude Code 会话 | 不填 `scores.csv`，不勾复测项 |

生成失败时不保留半份输出目录。先完成 disposition 与 exposure 检查，再创建文件。

## 测试

实现阶段要跑的检查：

1. `node skills/admin-api-contract/scripts/assert-exposure.mjs` 覆盖合法五条、非法 `graphql`、空字符串 exposure。
2. 本文 3.3 的 `ratchet.mjs --report`，五条处数与文件数逐项相同。
3. 对七个 `SKILL.md` 的 `description` 做一次阅读核对，确认没有流程摘要。
4. 版本字符串：`plugin.json`、CHANGELOG 顶部、README 现状、`docs/roadmap-0.6.0.md` 都是 0.6.0。

不在实现环境里跑全新 agent 复测，也不把子 agent 的输出写入 `scores.csv`。

本设计说明这一次提交不跑上述命令，因为对应脚本和适配器还不在这次变更里。
