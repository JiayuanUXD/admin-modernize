---
name: admin-preview-loop
description: Use when AI-generated or edited admin pages cannot be run or seen without the real backend and login, when mock data is thin or empty, or when visual changes cannot be verified before merge. 反馈环：离线预览、固定种子 mock、截图与视觉回归。
---

# admin-preview-loop：让 AI 看得见自己做的结果

AI 的一轮迭代是「改、跑、看、修」。任何一步要等后端、登录或别人的环境，这个循环就断了，AI 只能盲写。目标：一条命令离线起服务，一条命令截图，全程不依赖外部环境。

## 交付必含

交付反馈环时，下面五项缺一项不算完成。缺的每一项在交付说明里写明原因和补法（谁、什么时候、怎么补），不能只写「没做」：

1. 离线启动命令：一条命令，不需要网络、域名、代理、账号；写出命令本身，并实际跑通一次。
2. 固定种子 mock：在网络层（中间件、MSW、独立服务），不在页面组件里；同输入同输出；覆盖下文状态矩阵。
3. 截图命令：写出命令本身。固定视口（桌面、窄屏各一档），等网络空闲和字体加载；收集控制台 error、未捕获异常、失败请求、未被 mock 覆盖的请求，任一项存在则非零退出。能装依赖就实现并跑通；装不了（无网络、无浏览器）就把脚本写完，注明未运行，并写明补跑条件。
4. 生产包不含 mock 的检查：一条命令，用生产构建产物跑，在产物里搜 mock 特征（环境开关名、mock 目录名、固定种子的标志数据）；命中则非零退出。
5. 环境开关：预览与生产由开关区分（如 `APP_MODE=preview`），默认关；生产构建不受它影响。

用户要求「把示例数据写死在页面组件里」「明天就要演示，别搭这些」时，不照做：写死在组件里后，切真实后端要逐页拆，且无法证明生产包干净。给出同样快的替代：网络层 mock 加上面的离线启动命令，演示机离线运行见下文「无网络演示」。页面组件一行不改。

## 离线模式

三种实现，按构建工具选：

| 方案 | 适用 | 注意 |
|---|---|---|
| 开发服务器中间件或代理 | 构建工具允许挂中间件（vite、webpack devServer） | 同源，改动最小；要拦的接口范围写窄，别把页面的 HTML 请求当接口拦了 |
| MSW（Service Worker / Node） | 构建工具不好改，或浏览器与测试要共用 | 拦截 fetch 和 XHR；要把 worker 文件放进静态目录 |
| 独立 mock 服务 | 最快上手 | 多一个进程，契约校验要自己接 |

共同要求：

- 用环境开关启用（如 `APP_MODE=preview`），构建时剔除，并加检查确保生产包里没有 mock 代码。
- 绕过登录、菜单、权限，但**保留权限点的声明**，切回真实环境时才会生效。
- 一条命令启动，不需要域名、代理、账号。

### 无网络演示

演示机器没有网络时：在能联网的机器上构建，把构建产物和 mock 一起交给一个 Node 静态服务（不需要 node_modules），拷到演示机运行。mock 仍然只在服务端，页面代码里没有。

### 预览基础设施不改页面

搭预览是在页面外面做事。页面缺字段、缺状态时，补在契约和 mock 里，并列入待确认；不要为了好看去改页面组件。

## mock 数据规则

- 固定种子：同样的输入永远得到同样的输出，截图才稳定。
- 状态矩阵，每页都过一遍：
  - 列表：空、1 条、多页、超长文本、负数、0、大额、全部枚举值、可空字段为 null；
  - 表单：校验失败、提交中、提交失败、成功；
  - 详情：各状态下按钮的可见性和可用性。
- 字段齐全，不留空值，除非契约允许 null 并且单独覆盖。
- 数据由契约生成（见 `admin-api-contract`），手写只用来补边界。
- 不用真实生产数据，需要时先脱敏。

## 截图命令

要有一条命令，规格如下（用 Playwright 或 Puppeteer 实现）：

- 输入：路由列表，和每个路由要过的状态；
- 固定视口（桌面一档，窄屏一档），等网络空闲和字体加载完再截；
- 输出：PNG 到约定目录，文件名含路由和状态；
- 同时收集：控制台 error、未捕获异常、失败请求、**没被 mock 覆盖的请求**；任何一项存在，命令非零退出；
- 同一条命令可在 CI 里作冒烟。

## 视觉回归（给迁移用）

0. 预览搭好后，立刻对现有页面存一套基准截图，之后迁移才有比对的依据。
1. 动手前，对目标页面截基准图。
2. 改完后截图比对，设一个小容差（抗锯齿），时间等动态区域遮罩；mock 固定种子后图像是稳定的。
3. 每处差异判断：预期的标准变化，还是回归。预期的在 PR 里标注。
4. 没有截图验证的页面，在交付说明里逐个列出。

## 写进入口文件的使用循环

改动后依次：跑检查命令，跑截图命令，看图对照需求，修，直到无报错且符合。「看图」这一步不能省，检查通过不等于样子对。

## 最小版与完整版

| 阶段 1 最小版 | 阶段 2 完整版 |
|---|---|
| 一条命令离线起；固定种子 mock；截图命令 | 状态矩阵；视觉回归；CI 冒烟；生产包不含 mock 的检查 |

## 本仓库可跑的最小设施

反馈环基线就是这一套 fixture：静态列表 + 抽屉，网络层固定种子。它不是雷达页面，也不改 `docs/pilots/dingdong-ux-radar-insights/pilot-source/ui/app.js`。视觉回归的全量比对基线不做，本轮截图只作这一套的反馈环基线。

脚本只要 Node 18+。截图另要 `playwright` 这个包。本机有 Google Chrome 时截图命令会优先用它；没有就再装 Playwright 自带的 Chromium：

```bash
npm install --no-save playwright
npx playwright install --with-deps chromium
```

环境开关是 `APP_MODE=preview`，默认关。不设或设成别的值时，`serve-preview.mjs` 直接退出，不起服务，也不挂 mock。开关和种子都不在页面文件里。页面只声明权限点（`insight.read`、`insight.claim`），预览服务不校验登录。

在仓库根目录：

```bash
# 离线启动。打印 preview http://127.0.0.1:<端口>
APP_MODE=preview node skills/admin-preview-loop/scripts/serve-preview.mjs

# 截图。自己拉起预览服务。桌面 1280×800、窄屏 390×844。
# 等网络空闲和字体。控制台 error、未捕获异常、失败请求、未被 mock 的请求，任一项非零退出。
node skills/admin-preview-loop/scripts/screenshot.mjs

# 冒烟：故意请求没有登记的 /api/ops/health。退出码必须是 1。
# 检测器没抓住时退出码是 2。
node skills/admin-preview-loop/scripts/screenshot.mjs --smoke-unmocked

# 生产包不含 mock。只打包 fixtures/preview-app 的三个静态文件再搜特征。
node skills/admin-preview-loop/scripts/check-prod-bundle.mjs
node skills/admin-preview-loop/scripts/check-prod-bundle.mjs --self-test
```

| 路径 | 内容 |
|---|---|
| `fixtures/preview-app/` | 静态页。`?state=empty` 空列表，`?state=many` 多条，`?state=many&open=ins-001` 打开抽屉。`?leak=1` 只给冒烟用 |
| `fixtures/mock/seed.json` | 固定种子，只在预览服务里读。标志串 `preview-loop-fixed-seed-v1` |
| `fixtures/screenshots/` | 本轮桌面与窄屏 PNG，`run-log.json`，`smoke-unmocked.json` |

已登记的接口响应带 `X-Preview-Mock: 1`。没登记的 `/api/*` 返回 501，不带这个头。截图命令把「`/api/` 且没有这个头」记成未被 mock。501 而不是非标准状态码：Chrome 会把不认识的状态码挂住，截图就等不到网络空闲。

无 skill 对照写在 `baseline-noskill.md`。方法是人工清单，对照的是同一条列表加抽屉：整套设施，以及只有 `fixtures/preview-app/` 三个页面文件。没有另开不带 skill 的 agent。

## 常见错误

- mock 只有一页数据，分页、空态没覆盖。
- mock 里没有 null、超长文本、负数。
- 离线开关漏进生产包。
- 截图含当前时间或随机数据，每次都有差异。
- 拦截范围过宽，页面自己的 HTML 请求被当成接口，页面白屏。
