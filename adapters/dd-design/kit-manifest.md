# kit 清单

来源：h5-fms-v3 @ `0d6c8a9`（main）。路径均相对该仓库根目录。

分三类：**运行时**（进应用 bundle，将来发包）、**开发期**（不进 bundle，拷进目标仓库并按仓库调整）、**生成物**（按目标仓库生成，不是拷贝）。

## A. 运行时

| 来源 | 依赖 | 耦合 | 备注 |
|---|---|---|---|
| `src/component/Overlay/`（index.tsx、index.scss） | `@ddfe/dd-design` | 干净 | FormDrawer / FormModal / FormSection / FormGrid / DetailGrid；规范见 `docs/overlay-spec.md` |
| `src/component/TableActions/` | `@ddfe/dd-design` | 干净 | `actionColumn()` + `<TableActions>`；操作列宽严格生效依赖 B 类的 `patchDdResizeColumn` |
| `src/component/TableSummary/` | 无 | 干净 | 工具栏标题 + 汇总 |
| `src/component/NameCode/` | `@/component/EllipsisTooltip` | 要一并带走 `EllipsisTooltip` | 名称 + 编码两行 |
| `src/common/useTableScrollY.ts` | react | 随 dd-design 版本 | 表格高度自适应；内部按 `.ant-table-body`、`.ant-pagination` 的 DOM 取尺寸 |
| `src/common/css/search-form.scss`、`table_render.scss` | dd-design 的 BaseCrud DOM（`.fr-search`、`.tr-*`） | **随 dd-design 版本** | 含 `#f2f2f2` / `#fff` 硬编码（样式层不受 S1 检查）；A 骨架高度写死 `calc(100vh - 96px)`，应是壳层顶栏 + 页签栏的高度之和（未核实），别处要参数化 |
| `src/common/css/brand-a11y.scss` | dd-design 主题变量 | **参考项目的品牌** | 把主色覆盖为 `#009919`。带不带由 D3（标准 v1 的范围）决定 |
| `src/component/common-template/commonTableConfigs.tsx` | `@/utils/tableFormat`、TableSummary、TableActions | 中 | 要带走 `tableFormat` 里的 `nameCodeFormatter` / `dateFormatter` / `priceFormatter` |
| `src/component/common-template/commonFormConfigs.ts` | `@/api`、`@/utils/dateRangePresets` | **高：耦合项目 api** | 先拆成「纯 schema helper」和「依赖 api 的字典 helper」才能共享 |
| `src/component/common-template/template/` | 以上 | 模板，复制用 | 每个目标仓库一份，README 说明改名步骤 |
| `src/common/css/layout-nav.scss`、`page-tabs.scss` | dd-boost 的 `.lib/layout` | 覆盖框架布局默认样式，视觉取舍是参考项目的 | 需要时再评估，默认不带 |

运行时组件里不得出现项目私有 import（`@/api`、业务 utils）。

## B. 开发期

| 来源 | 通用性 | 适配点 |
|---|---|---|
| `scripts/check-style-tokens.mjs` + `style-token-baseline.json` | 通用 | 扫描目录写死 `src/pages`、`src/component`；报错文案指向 `docs/style-tokens.md` |
| `scripts/check-overlay.mjs` + `overlay-baseline.json` | 通用 | 报错文案指向 `docs/overlay-spec.md` |
| `scripts/check-table-cells.mjs` | 通用 | 放行目录写死（`DDForm`、`TableActions`、`pages/demo`） |
| `scripts/check-search-styles.mjs` | 依赖 A 类两个 scss 存在 | 放行文件路径写死 |
| `scripts/check-search-schema.mjs` | 依赖 `commonFormConfigs.ts` 的 helper 路径与默认 span | 目标仓库没有这个 helper 时先不接 |
| `vite-plugins/patchDdResizeColumn.ts` | 绑 dd-design 的 `es/Table/resize-column.js` 片段 | 版本不同找不到片段会报错，需重新评估是否还要 |
| `package.json` 的 `lint`、`lint:styles`、`proto`、`proto:check` | 通用 | 脚本路径按目标仓库调整 |
| `prototype/vite.config.ts` | 半通用 | 包装 `../vite.config` 的函数式默认导出；`@/env` 指向同源的 `mocks/env.local.ts`，目标仓库需有 `src/env.ts`；监听 127.0.0.1；拦截范围是已注册路径加形如 `*-service/…`、`/ccapi/`、`mock/` 的 POST |
| `prototype/mocks/build-menu.mjs` | 半通用 | 扫 `src/pages/**/index.tsx` 生成菜单；`SERVICE = 'h5-fms-v3'`；`auth_item` 格式要与 `use-auth.ts` 的 `dealSsoMenu` 对上，对不上表现为菜单空白、页面打不开且无报错 |
| `prototype/mocks/lib.mjs`、`routes.mjs`、`_template.mjs` | 工具通用 | `lib.mjs` 里的数据池（城市、供应商、科目、公司…）是参考项目的业务数据，目标仓库要换 |
| `prototype/mocks/modules/*.mjs`、`fixtures/` | **不共享** | 参考项目的业务 mock；`getUser` 的结构有坑，见 `prototype/mocks/README.md` |
| `prototype/scripts/check-mock.mjs` | 半通用 | 读 `src/api/service-name.ts` 还原接口路径，只扫页面的 `api/` 与 `request.ts`；只查路径是否注册，不查字段 |

## C. 生成物

| 目标 | 做法 |
|---|---|
| `docs/overlay-spec.md`、`search-layout-spec.md` | 可拷贝 |
| `docs/style-tokens.md` | 拷贝后改「当前值」表（那是参考项目的主题值） |
| CLAUDE.md | 移植「搜索区样式 / 列表页表格卡 / 表格操作列 / 两行单元格 / 新增页面规则」几段，标杆页面换成目标仓库的 |
| AGENTS.md | 按插件内 `skills/admin-guardrails/references/ai-entry-files.md` 的结构重写，样板页与路径换成目标仓库的 |
| `.claude/skills/new-page` | 同上；流程不变，路径、模块、样板页换掉 |

## 引入方式

- 目标：运行时部分发成 npm 包。包名和 registry 按公司内部规范，尚未定。
- 开发期部分：lint 规则已整理成本目录的 `ratchet.config.json`（用 `admin-guardrails` 的 ratchet 运行）；原型模式、`patchDdResizeColumn` 等按 B 类拷贝并适配。
- 包发布前：按 A 类清单拷贝，在目标仓库 `docs/modernize/kit-source.md` 记录来源 commit 与拷贝文件列表，便于以后 diff 同步。

## 待办（共享前要先解决）

1. 拆 `commonFormConfigs.ts`：纯 schema helper 与依赖 `@/api` 的部分分开。
2. A 骨架的 `100vh - 96px` 改成 CSS 变量，由各后台设置自己的顶栏高度。
3. 品牌色与结构样式分离（`brand-a11y.scss` 已独立，确认其余 scss 里没有夹带品牌色）。
4. `patchDdResizeColumn` 对多个 dd-design 版本的适配，或推动上游修复。
5. 确定发布方式与包名。
