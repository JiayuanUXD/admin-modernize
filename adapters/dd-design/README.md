# adapter：dd-design

栈：React 18 + `@ddfe/dd-design`（antd v5 风格）+ Vite，页面文件即路由，qiankun 微前端。来源：h5-fms-v3（财务系统）@ `0d6c8a9`。

## 内容

| 文件 | 说明 |
|---|---|
| `ratchet.config.json` | 规则包：S1 hex 色值、S2 字号刻度、S3 行内样式、S4 rgb()/hsl() 色值、O1 页面 scss 覆盖浮层、O2 页面直接写 Drawer / Modal、L1 覆盖搜索区与表格卡外壳、C1 `tip-text`、C4 手写操作列 |
| `kit-manifest.md` | 参考实现里可共享的标准件、样式、脚本，按运行时 / 开发期 / 生成物分类，含耦合点与待办 |

## 用法

```bash
node <插件根>/skills/admin-guardrails/scripts/ratchet.mjs --config <插件根>/adapters/dd-design/ratchet.config.json --root <目标仓库> --report
```

规则里的路径（`src/pages`、`src/component`、`src/common/css/*`）是参考实现的目录约定，目标仓库不同就改配置里的 globs。S2 的字号刻度（12 / 14 / 16 / 18 / 20 / 24）、O 与 L 规则里的类名，是该规范的取值，沿用前先过 D3。

## 验证

在参考仓库 UI 走查前的快照（`9e46009`）上，下面 7 条规则的数字与该仓库自带 lint 逐项一致；在当前（已清零）的参考仓库上全部为 0。

| 规则 | 处数 | 文件数 |
|---|---|---|
| S1 | 421 | 63 |
| S2 | 50 | 25 |
| O1 | 31 | 9 |
| O2 | 51 | 45 |
| L1 | 61 | 7 |
| C1 | 3 | 2 |
| C4 | 23 | 23 |

S3、S4 比参考 lint 更严，数字不对账：

| 规则 | 与参考 lint 的差别 | 旧快照上 |
|---|---|---|
| S3 | 参考 lint 只认属性名在行首，漏掉单行 `<span style={{ color }}>`；这里两种都抓 | 84 → 186 处 / 43 文件 |
| S4 | 新增，参考 lint 没有；抓 `rgb()` / `rgba()` / `hsl()` | 47 处 / 15 文件 |

S3 会误报 tsx 里行首的 `color:` 属性（不在 style 里的对象字面量），用 `lint-allow: style-token <原因>` 放行。

## 没有移植的部分

- C2（手写 12px 灰色第二行）、C3（操作按钮内联 color）：要跨行匹配，ratchet 不支持。
- 搜索区 schema 排列检查（span 只用 4 / 8、折叠首行装满、行内无空洞）：要解析 schema 并模拟栅格，参考仓库里有专用脚本 `scripts/check-search-schema.mjs`。

## 版本敏感点

- 搜索区和表格卡的样式依赖 BaseCrud 的 DOM 类名（`.fr-search`、`.tr-*`），随 dd-design 版本变。
- `patchDdResizeColumn` 绑定 `es/Table/resize-column.js` 里的一行代码，版本不同可能找不到。
- 参考实现的 dd-design 版本：`5.29.0-beta.20`。
