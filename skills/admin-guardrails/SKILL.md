---
name: admin-guardrails
description: Use when AI-generated or newly written admin pages come out inconsistent (wrong components, hard-coded styles, ad-hoc layouts), reviewers keep repeating the same comments, someone proposes "just write a rules doc", or rules must fail fast without being blocked by legacy violations. 约束面：样板页、标准件、lint 棘轮、AI 入口文件。
---

# admin-guardrails：让 AI 照着做就对

约束靠样板页、类型和机器检查，不靠文字。AI 会读文档，但在「先让页面跑起来」的压力下会协商掉文字规则；样板页和失败的检查它绕不过。

## 红线

| 念头 | 现实 |
|---|---|
| 写份 RULES.md 就行，AI 读了会遵守 | 文档拦不住。文档可以写，同时必须有检查；存量用基线冻结，CI 不会因此挂 |
| 存量几百处，先全修了再上规则 | 先冻结后清理。基线记存量，新增为零 |
| 检查失败了，重写基线就能过 | 基线只许降。修代码，不要重写基线 |
| 加个 `lint-allow` 先过掉 | 没有原因不算豁免 |
| 替代写法还没有，规则先写「禁止，先问用户」 | AI 会卡住或绕开，见下「替代写法还不存在时」 |

## 样板页与模板

- 留 3–5 个人工打磨过的样板，覆盖：列表加抽屉、列表加弹窗、详情、表单、主从表。
- 入口文件里列出它们，写明「只参考这些」；存量里其余页面标为带历史写法，不要照抄。
- 样板和页面模板必须能原样复制并通过检查，先验证一遍。模板、示例、README 里如果在教禁止写法，AI 会照抄：规则上线前先改掉。
- 改标准时同步改样板，样板过期比没有样板更糟。

## 窄 API

让错误写法写不出来：

- 档位枚举代替自由数值（浮层尺寸 md/lg/xl，而不是任意宽度）。
- 配置驱动代替拼 DOM：列表页 = 搜索项 schema、列定义、操作、接口。AI 填配置比拼结构稳定得多，接后端时配置也直接说明用了哪些接口。
- 提取标准件的时机：同一写法在样板里出现 3 次以上，或评测里 AI 反复做错。不预先抽象。

## token 映射：从「有 token」到「用 token」

有 token 和组件库，不等于约束生效。先用脚本把硬编码值映射到**现有** token，产出存量迁移清单（不新建 token、不重命名）：

```bash
node <本 skill 目录>/scripts/map-tokens.mjs --tokens <token 来源文件或目录> --scan <代码目录> [--json <文件>]
```

- 输出三类：可直接替换、近似（抽样确认后再改）、需人定（歧义 / 无对应 / 字号不在刻度 / 透明度不同）。
- 「需人定」是标准问题，不是迁移问题：先定 token（D3），再迁移。
- token 自身冲突（同一值多个名字、同一个名字多个值）先清掉，否则映射结果没有意义。
- 只看颜色和字号；间距这类自由 px 噪声太大，不自动映射。
- 确认后的映射表可以直接变成 ratchet 规则和 codemod 的输入。

## 机检加棘轮

1. 从 `map-tokens` 的映射表和 `admin-recon` 的违规信号里，挑「有明确替代写法」的规则：硬编码色值改用 token、行内 style 改用 class、手写浮层改用标准浮层、页面里直接发请求改走数据层。色值规则要同时覆盖 hex、`rgb()` / `hsl()`、颜色名，只查 hex 会被绕过。
2. 写进规则配置（格式见 `scripts/ratchet.config.example.json`；有栈 adapter 就从 `adapters/<栈>/ratchet.config.json` 起步），先看数：

```bash
node <本 skill 目录>/scripts/ratchet.mjs --config <配置> --root <仓库> --report
```

3. 把 `ratchet.mjs`、配置、基线拷进目标仓库（如 `scripts/`）并入库，CI 不依赖本插件。记存量基线，接进检查命令：

```bash
node scripts/ratchet.mjs --config scripts/ratchet.config.json --update-baseline   # 写基线
node scripts/ratchet.mjs --config scripts/ratchet.config.json                    # 检查
```

4. 规则：
   - 新增违规失败；违规减少也失败，要求收紧基线。
   - `--update-baseline` 默认拒绝增加。新增规则、接入新目录这类确需放宽的，加 `--allow-increase`，提交说明里写原因。检查失败时修代码，不要重写基线。
   - 例外写 `lint-allow: <标签> <原因>`，没有原因不算豁免。JSX 子节点里写 `{/* lint-allow: 标签 原因 */}`，写 `//` 会被渲染成页面文字。`--report` 会列出例外注释数，定期看。
5. 报错文案要指向「该用什么」，不只是「不能这样」。
6. 正则做不到的（跨行、要看语法）用 ESLint / stylelint 的 AST 规则。较新版本的 ESLint 自带 bulk suppressions，可做同样的棘轮。

ratchet 是逐行正则，近似检查，会有误报漏报，不要用它判断需要语法理解的规则。

## 替代写法还不存在时

规则需要说「该用什么」。标准件还没有时：

- 规则照开。新增写法加 `lint-allow: <标签> 待<标准件>` 过渡，并写进交付说明；以后 `grep` 这个原因就是迁移清单。
- 标准件由负责人定，不要让页面作者各自包一层。
- 把「标准件还没有」本身列为待确认项。

## 一条命令

把 lint、ratchet、类型检查（以及 `admin-api-contract` 的契约检查）合成一条检查命令，本地、CI、AI 自检、可选的 pre-commit 跑同一条。已有 lint 带 `--max-warnings 0` 时，ratchet 单独成一条命令再合并，不要把存量违规塞进已有 lint。

## 入口文件与 new-page skill

结构和内容见 `references/ai-entry-files.md`。入口文件要短：规则在 lint 里，文件只放地图和命令。new-page skill 放在目标仓库里，因为路径、样板页和命令都是该仓库的。

## 最小版与完整版

| | 阶段 1 最小版 | 阶段 2 完整版 |
|---|---|---|
| 样板页 | 3 个 | 5 个，覆盖全部页面类型 |
| 标准件 | 5–8 个，样板页用到的 | 按评测里 AI 的错误补 |
| 规则 | 2–3 条棘轮规则 | 覆盖 recon 里的主要违规，加 AST 规则 |
| 入口文件 | 有，含命令和样板页 | 加禁止清单与完成定义，new-page skill |

## 常见错误

- 规则只写在文档里，没有对应的检查。
- 基线只增不减，或检查对「减少」不报错，存量永远清不掉。
- 报错没有替代写法，AI 只能绕。
- 一次抽太多标准件，没人用，样板和现实脱节。
- 入口文件越写越长，AI 开始跳读。
