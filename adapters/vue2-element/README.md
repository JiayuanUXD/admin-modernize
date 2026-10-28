# adapter：vue2-element

栈：Vue 2 + Element UI 2。组件标签是 Element UI 的 `el-*`。来源是本目录的合成夹具，不是生产仓库，不是 h5-fms-v3，也不是洞察池副本。

## 内容

| 文件 | 说明 |
|---|---|
| `ratchet.config.json` | E1–E5。`baseline` 字段指向 `ratchet-baseline.json`，验收不靠基线文件 |
| `kit-manifest.md` | 合成约定下的 Element UI 标准件，以及解耦前不共享的 mixin 和权限指令 |
| `fixtures/pages/` | 故意违规的小页和改过的小页，只为规则计数 |

## 用法

在插件仓库根目录执行：

```bash
node skills/admin-guardrails/scripts/ratchet.mjs \
  --config adapters/vue2-element/ratchet.config.json \
  --root adapters/vue2-element \
  --report
```

`--report` 退出码为 0。处数与文件数必须是：

| 规则 | 处数 | 文件数 |
|---|---|---|
| E1 | 2 | 2 |
| E2 | 1 | 1 |
| E3 | 2 | 2 |
| E4 | 2 | 2 |
| E5 | 1 | 1 |

数字对不上就改本目录的规则或夹具，直到和这张表一致。不要把 dd-design 在 h5-fms-v3 上的处数拿来当这套的期望。

一条 `style` 只含颜色、不含两处间距时，只计 E4，不计 E2。`v-html="sanitize(row.note)"` 不计 E5。固定页用 `{{ row.note }}`，所以固定页对 E5 也是 0。E4 的 `exclude` 让含 `url(` 的整行跳过；当前夹具没有这种行。

## 没有移植的部分

- dd-design 的 React / antd 类名规则（S、O、L、C 系列）。
- vue-cli 构建和 mock 中间件。0.5 的 README 已记录它们没在真实项目里跑过；本适配器不用跑通 vue-cli 来交差。
- 全量存量视觉统一。
- Element Plus 与 Vue 3。

## 版本敏感点

- 规则针对 Vue 2 单文件组件和 Element UI 2 的标签名。
- Element Plus 也用 `el-` 前缀，但表格和表单 API 不同。本适配器的规则不能直接拿去扫 Vue 3 工程。
- `this.$http` 是页面上常见的请求挂载，不是 Element 的 API。组合式 Vue 3 没有这个 `this`，那条规则只属于本适配器。

本文不写未经验证的补丁版本号。栈的名字锁定为 Vue 2 + Element UI 2。
