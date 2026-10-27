# 反馈环：无 skill 对照

固定需求：`fixtures/list-drawer-requirement.md`（列表 + 抽屉，空列表、多条、打开抽屉）。

## 方法

人工清单。没有另开一个不带 skill 的 agent。

这个环境可以开子 agent，但子 agent 仍带着本插件的 skill 和系统提示，不能当成「干净会话、不读 skill」。所以没有跑。

两列用的是同一条需求、同一套已经提交的文件，人工把它们拆开打分：

| 列 | 看什么 |
|---|---|
| 有 skill 的现有设施 | `scripts/`、`fixtures/mock/`、`fixtures/screenshots/`，加上页面 |
| 无 skill 的实际 | 只看 `fixtures/preview-app/` 的 `index.html`、`app.js`、`preview.css` |

有 skill 这一列的截图证据是仓库里已有的 `fixtures/screenshots/run-log.json` 和 `smoke-unmocked.json`。写这篇对照时没有重开浏览器。

README 里更早的 Vue 2 + Element UI 复测只有叙述，仓库里没有那次的脚本和截图。那次的 6 项分数不进这张表。

## 期望交付项

来自本 skill 的「交付必含」：

1. 一条离线启动命令，并且能跑。
2. 固定种子 mock 在网络层，不在页面组件里。
3. 截图命令：桌面和窄屏，未 mock 的请求要让命令非零退出。
4. 生产包不含 mock 的检查。
5. 环境开关，默认关。

## 对照

| 期望 | 有 skill 的现有设施 | 无 skill（只有页面文件） |
|---|---|---|
| 离线启动命令 | 有。`APP_MODE=preview node skills/admin-preview-loop/scripts/serve-preview.mjs`。`APP_MODE` 不是 `preview` 时退出码 2 | 三个页面文件里没有启动命令 |
| 固定种子、网络层 | 有。`fixtures/mock/seed.json` 的标志是 `preview-loop-fixed-seed-v1`，由 `serve-preview.mjs` 读取。`app.js` 开头写明本文件不写种子 | 页面里没有种子。mock 在 `fixtures/mock/`，不在这一列的范围内 |
| 截图命令 | 有。`scripts/screenshot.mjs`。`run-log.json` 记录 `ok: true`、`exitCode: 0`、`browser: chrome`，桌面与窄屏各有 empty、many、drawer-open，`issueCount: 0`。`smoke-unmocked.json` 记录未 mock 的 `/api/ops/health` 使退出码为 1 | 页面目录里没有截图命令，也没有 PNG |
| 生产包检查 | 有。`scripts/check-prod-bundle.mjs` 只打包上述三个静态文件再搜 mock 特征 | 页面目录里没有这道检查 |
| 环境开关 | 有。开关在 `serve-preview.mjs`，默认关。页面文件不读 `APP_MODE` | 三个页面文件不区分预览和生产 |

## 结论

同一条列表加抽屉，设施交齐时五项都有落点，截图以已提交的 `run-log.json` 为准。只交页面文件时五项都没有。差在交付清单要不要设施，不在「本轮又跑了一个 agent」。

无 skill 这一列没有分数可填进 `docs/ai-benchmarks/scores.csv`。那张表留空，见复测剧本。
