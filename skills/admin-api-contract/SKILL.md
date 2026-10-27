---
name: admin-api-contract
description: Use when prototype or AI-generated admin pages must be connected to a real backend, pages contain their own request glue (param renaming, response unwrapping, enum mapping), mock fields drift from real responses, or nobody owns the API contract between frontend and backend. 对接面：数据层统一、契约先行、mock 与真实可切换。
---

# admin-api-contract：让原型接得上后端

原型接后端的返工，大头在数据层和契约，不在样式：字段名对不上、分页约定不同、枚举是数字、错误码各页各处理。每个页面各写一份胶水，AI 生成的页面只会再多写几份。

## 数据层统一在一处

清单见 `references/data-layer-checklist.md`。原则：

- 页面只看到干净的领域模型。后端的不一致（字段命名、分页、外壳、枚举）在适配层抹平。
- 页面里不出现参数改名、响应拆包、枚举映射、URL 拼接。新页面只通过数据层调用。
- 后端约定混乱时，一边在适配层兜住，一边给后端一份接口规范（分页、外壳、错误码、枚举、金额与日期格式）。
- 口头约定里缺的语义（枚举各值的含义、成功码、字段含义）不猜。适配层留占位（如显示「状态码 N」），列入待确认，不要编一份文案当事实。
- 页面表单字段名与契约字段名不一致时，在适配层映射，并把不一致清单写进确认。后端不认的参数会静默失效，联调时要逐个试。

## 契约先行（D4 选方向）

- **后端先行**：OpenAPI / proto / GraphQL schema → 生成类型与客户端 → 生成 mock。
- **原型先行**：AI 先写契约文件（OpenAPI YAML 或类型文件）。后端评审的是这份文件，不是 UI。达成一致后它成为唯一来源。

不管哪种：页面只引用契约产物；契约只有一个来源，另一份由它生成，不手工维护两份。可执行步骤见下面的「流水线」。编排上的默认方向在 `admin-modernize` 的 D4：仓库里没有既有 OpenAPI / proto 时，原型先行。

## 流水线（期望 → 差距 → 骨架）

契约先落到中间表示（IR），再生成骨架。三份文档的形状、出处要求和人工门禁见 `references/ir-schema.md`。JSON Schema 在 `schemas/`（`desired.schema.json`、`actual.schema.json`、`gap.schema.json`）。

下面的脚本路径相对本 skill 目录。样例和大致条数在 `fixtures/sample-app/README.md`。

1. **抽期望** — `scripts/extract-desired.mjs --root <原型目录> [--out desired.ir.json]`
   扫描 axios / fetch / `$.ajax`，以及薄封装 `get` / `post` / `api`（默认名单和怎么扩展见 `scripts/README.md`）。字面量 URL 的置信度是 `medium`，模板或拼接是 `low`。认不出 URL 的调用跳过，不编接口。没有出处的接口不会写进去。允许不全，人工补。
2. **拿实际** — 后端 OpenAPI JSON，或已经整理好的 actual IR。没有 OpenAPI、但路由和实现已经写在代码里时，不要另编一份 OpenAPI：按代码写 actual IR，每条带 `sources`（`file` + `lineStart`）。本切片不解析 YAML；OpenAPI 用 JSON（样例是 `fixtures/sample-app/actual.openapi.json`）。真实切片见 `docs/pilots/dingdong-ux-radar-insights/`。
3. **比差距** — `scripts/build-gap.mjs --desired <desired.ir.json> --actual <openapi.json|actual.ir.json> [--out gap.ir.json]`
   按方法 + 规范化路径对齐。`match` 是响应字段集合相同，`reshape` 是路径相同但字段不同，`missing` 是期望有而实际没有。`disposition` 先空着。实际多出来的接口不进这张表。
4. **人工门禁** — 给每条差距填 `disposition`：`direct`（直连）、`bff`（适配层映射）、`pending`（后端还没有）。空着不能往下走。
5. **生成骨架** — `../../scripts/generate-skeleton.mjs --gap <gap.ir.json> --out-dir <目录>`
   任一 `disposition` 为空则退出码 1，不写文件。`direct` / `bff` 写入 `mappers.mjs`；`pending` 写入 `pending-endpoints.json` 和 `pending.md`；`route-mode.json` 把操作标成 `real` 或 `pending`（`mock` 留给之后手改）。`client.stub.mjs` 只是 typed client 入口骨架，不是完整客户端。
6. **接数据层** — 按 `references/data-layer-checklist.md` 把页面改到数据层上，对照骨架审字段。`exposure`（`rest` / `bff` / `mcp`）本切片不参与生成。
7. **切真接口后跑校验** — `scripts/check-contract.mjs --actual <actual.ir.json> [--desired <desired.ir.json>] --samples <录制目录> [--base http://127.0.0.1:端口]`
   对照 `response.fields` 的顶层键。同一方法 + 路径在 actual 和 desired 里都有时，整条用 actual。缺字段打 `CONTRACT_MISMATCH`，多余字段打 `CONTRACT_WARNING`（warning 不计 mismatch）。`--base` 拉失败打 `CONTRACT_ERROR`，脚本不崩，这次失败不进 mismatch。
   最后一行是 `CONTRACT_SUMMARY mismatch_count=N warning_count=M checked=K error_count=E`。`mismatch_count>0` 或有 error 时退出码 1。样例在 `fixtures/contract-check/`。
   **不一致数只读 `mismatch_count`。** gap 里的 `reshape` 只说明期望侧没抽出字段、实际侧有顶层键，不是 D1 的不一致数。

## mock 由契约生成并检查覆盖

- mock 由契约生成：枚举全覆盖，边界值（空、超长、负数、0、大额、null）补充。
- 检查：页面引用的接口 ⊆ 契约 ⊆ mock。写成检查脚本，进检查命令。
- 状态矩阵与固定种子见 `admin-preview-loop`。

## 开发态响应校验

数据层在非生产环境用契约校验每个响应（zod、ajv 等），不一致时报错并指出字段。切到真接口那一刻，字段差异立刻暴露，而不是上线后。关键接口在 CI 里对测试环境跑契约测试。

本仓库能直接跑的计数器是 `scripts/check-contract.mjs`（流水线第 7 步）。不一致数读它的 `CONTRACT_SUMMARY`，不要把 `build-gap` 的 reshape 条数当成这个数。

校验尤其要抓外壳变化：新外壳没有旧的 `success` 字段时，照字面改字段名的页面会静默变成空表，没有任何报错。

## mock、真实、未就绪按接口切换

一张配置表：接口 → `mock | real | pending`，环境变量给默认值。允许混合，后端做好一个接一个，切换不改页面代码。

`pending` 表示后端还没提供：页面给出明确的「后端尚未提供」提示，不要 mock 成成功，否则会让人以为已经联通。

## 原型晋升清单

原型进生产前（D2 里定谁执行）：

- [ ] 契约已评审，后端确认
- [ ] 权限点已声明
- [ ] 国际化文案
- [ ] 空、加载、错误态齐全
- [ ] 移除 mock 依赖，生产包不含 mock
- [ ] 埋点、日志按约定
- [ ] 基本无障碍项（焦点、键盘、对比度）
- [ ] 检查命令通过，截图已确认

原型生成者不直接合入生产路由，晋升由工程师执行。

## 最小版与完整版

| 阶段 1 最小版 | 阶段 2 完整版 |
|---|---|
| 试点页的接口有契约文件；数据层封装一份；mock 与真实可切 | 全量清单落地；mock 由契约生成；开发态校验；CI 契约测试；晋升清单进 PR 模板 |

## 常见错误

- 类型和 mock 各手写一份，必然漂移。
- 页面直接拼 URL。
- 页面里写死数字枚举。
- 忽略分页、排序、筛选参数的约定，每页自己决定。
- 金额用浮点数。财务类系统传字符串小数或最小单位整数，展示层再格式化。
- 日期时区不约定，跨时区展示错一天。
- 只扫 axios / fetch。页面若是 `get(url)` / `post(url, body)` / `api('GET', url)`，内部 `fetch(path)` 的 path 是变量，会抽到 0 条。先对上薄封装名单，再判断页面有没有调接口。
- 没有 OpenAPI 就手写第二份 OpenAPI，和代码各维护一份。后端已经写在路由和实现里时，用 actual IR，出处指到文件和行。叮咚体验雷达洞察池这一例见 `docs/pilots/dingdong-ux-radar-insights/`。
- 把 `set_status` 的 `note` 缺省当成空串。缺省是不动原来的备注，传空串才是清空。抽取只能看见有的调用点传了 `note`，看不见这层差别，不要在适配层补一个空备注。

## 红线

| 念头 | 现实 |
|---|---|
| 包装层内部是 `fetch(变量)`，按那个变量编一条接口 | 认不出 URL 就跳过。不编 |
| 没 OpenAPI 就凭记忆补实际能力 | 每条要有 `file:line`。没有出处的能力不进差距表 |
| 改状态时把没传的 `note` 写成 `""` | 缺省不等于清空。`set_status` 里 `None` 是不动备注 |
| 把 gap 的 reshape 条数当成 D1 契约不一致数 | 不一致数只认 `check-contract` 的 `CONTRACT_SUMMARY mismatch_count`。reshape 是抽取缺口，不是校验日志 |
