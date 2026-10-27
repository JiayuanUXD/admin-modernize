---
name: admin-recon
description: Use when starting to make an admin system AI-ready and you need a quantified picture of it before choosing scope, a pilot page and success metrics — stack, size, activity, UI inconsistency, data-layer and AI-readiness signals. Read-only.
---

# admin-recon：只读摸底

阶段 0 的工具。只读，不改目标仓库。数字是静态扫描的近似值，用来定范围和指标基线，不是审计结论。

## 步骤

1. 先判拓扑（单仓 / 分仓 / 服务端渲染 / 微前端）。它决定隔离机制放在哪一层，也决定要不要先拆仓：

```bash
node <本 skill 目录>/scripts/inventory.mjs --topology <仓库>
```

分仓时传多个路径，或直接传含多个 git 仓的父目录（会自动展开）。形态怎么读、对应哪个 playbook，见 `references/topology.md`。合成单仓、分仓和几条误判的复跑命令是 `scripts/verify-topology.mjs`。

可选。按模块列出页面已经在调的接口，以及数据层方法，每条都是 `file:line`：

```bash
node <本 skill 目录>/scripts/capabilities.mjs --root <仓库> --md /tmp/recon-capabilities.md
```

页面接口只来自 `extract-desired`。认不出 URL 的调用不编成一条。数据层方法只列 `services` / `pipeline` / `controllers` 里不以 `_` 开头的具名函数，不从路由分支反推。没有 `sources` 的接口不能进 gap-table，`build-gap` 会直接拒绝，见 `admin-api-contract`。

2. 通用盘点（任何栈，Node 18+，无依赖）：

```bash
node <本 skill 目录>/scripts/inventory.mjs <仓库> --json <仓库之外的路径>/inventory.json
```

3. 有对应栈的 adapter 时，加一步规则级存量（规则包在插件根目录 `adapters/<栈>/ratchet.config.json`，插件根 = 本 skill 目录往上两级）：

```bash
node <插件根>/skills/admin-guardrails/scripts/ratchet.mjs --config <规则包> --root <仓库> --report
```

4. 向用户要扫不出来的信息：页面访问量排名、业务重要度、近期要做的需求清单、后端现状（有无 OpenAPI / Swagger、有无测试环境、有无接口约定文档）、谁会生成原型。
5. 选试点（见下），起草 D1 的指标现值，交给用户确认。

## 选试点

必须是真实将要做的需求，不是演示页。优先满足：

- 中等复杂度：列表加表单，或抽屉，或详情，三选一至两项；
- 接口 3–8 个，且后端测试环境能访问；
- 不在最关键的资金、合规路径上；
- 有人当天能回答业务问题。

## 怎么读结果

| 信号 | 意味着 | 去哪个 skill |
|---|---|---|
| 单仓且前后端同仓（`monorepo-fullstack` / `single-fullstack`） | 写入面重叠，AI 改页面会顺手碰到后端；需要边界 | `admin-repo-split` |
| 分仓，但契约产物缺失 | 联调靠猜，拆不拆都在漂移 | `admin-api-contract` |
| 服务端模板 ≥ 10 且无前端组件 | 页面不在前端工程里，规则扫不到 | `admin-legacy-migration` |
| 色值种类、字号种类多；行内 style、`!important` 多 | AI 会模仿出发散的写法；约束面薄 | `admin-guardrails` |
| 没有 lint 配置、没有 AI 入口文件、没有公共组件目录 | 约束面几乎为零 | `admin-guardrails` |
| 没有 mock 目录或库、没有 e2e / 截图工具 | AI 看不见结果 | `admin-preview-loop` |
| 请求封装类文件多且散在页面目录里；页面直接发请求的占比高 | 没有统一数据层，每页各写胶水 | `admin-api-contract` |
| api 类 TS 文件没有类型声明、`any` 多；无契约产物 | 契约不明，联调靠猜 | `admin-api-contract` |
| 近 90 天改动集中的目录 | 迁移要与在做的需求错开 | `admin-legacy-migration` |
| 有服务端渲染模板、jQuery | 部分页面不在前端工程里；需路由级替换 | `admin-legacy-migration` |

## 交给用户

先给三行结论，每行不超过 40 字，再附表：

1. 拓扑与规模：单仓还是分仓、前后端是否同仓、页面数、代码量、近 90 天热点。
2. 三层现状：约束面、反馈环、对接面各缺什么，引用具体数字。
3. D1、D2 草案：试点候选的标准、指标现值、谁生成原型；没有数据的写「待用户给」。

用户说「别解读，直接贴表」时，三行结论仍然保留，表照给。三行不是解读，是读表的前提：原始数字会误导，例如请求调用数为 0，其实是自研请求库没被扫到。

访问量和业务重要度扫不出来，必须单列为待确认项。用代码量这类代理值代替时，标明「代理，可能与真实相反」，确认前不据此选试点。

## 常见误读

- 拓扑扫描只看 6 层以内的文件名和几个依赖，够判形态，不代替读代码；置信度低时不要据此选方案。
- 单前端仓不等于系统只有前端：另一端可能在别的仓。只给一个路径时报告会提示补扫。
- 色值数是全仓统计，含主题层；看「集中在」的文件判断是治理对象还是主题文件。
- 「页面估计」按目录约定推断，路由配置条目是另一种口径，两者不一致很常见。
- 请求调用数只认 axios、fetch、`$.ajax`、XHR 和常见 hook；自研请求库会被低估，要看「请求封装类文件」和页面里引入 HTTP 库的占比。
- 点开头的目录和疑似第三方目录不计入统计，数量在「规模」一行。

## 常见错误

下面是 `scripts/verify-topology.mjs` 在本仓库里跑出来的结果。改了判定规则，就要改脚本里的断言和这一节。

| 扫描对象 | 形态 | 怎么理解 |
|---|---|---|
| 本插件仓库根 | `unknown`，置信度低 | 这是一个 git 单仓。`unknown` 是信号不够，结果不是 `multi-repo` |
| `docs/pilots/dingdong-ux-radar-insights/pilot-source` | `unknown`，置信度低 | `ui/app.js` 不是 tsx/jsx/vue。两份 Python 不到 5 个，不算后端。这页仍然是前端页面 |
| `fixtures/topology/single-fullstack` | `single-fullstack`，置信度高 | 根 `package.json` 同时有 react 和 express。没有 pom / go.mod，拆仓难度写成「同仓同构建体系（Node 全栈）」 |
| `fixtures/topology/server-dirname` | `single-frontend`，置信度中 | 目录名叫 `server` 不是后端证据 |
| `fixtures/topology/java-under-fixtures` | `single-frontend` | `fixtures/` 里的 5 个 `.java` 不参与形态判定。真后端若放在名为 fixtures 的目录里会漏 |
| `fixtures/topology/split`，子目录没有各自的 `.git` | `monorepo-frontend` | 不会判成 `multi-repo`。证据里的子包可以标成后端，根上没有后端依赖时 form 也不会变成 fullstack |
| 同上，但父目录自己有 `.git` | `monorepo-frontend` | 子目录里的 `.git` 不会展开。父目录是仓时，子目录按子模块理解 |
| 同上，只有子目录各自 `git init`，父目录不是仓 | `web` 为 `single-frontend`，`api` 为 `single-backend`，置信度都是中 | 这是分仓展开的那一次 |

```bash
node skills/admin-recon/scripts/verify-topology.mjs
```
