# 洞察池副本 · 最小约束面

只检查 `pilot-source/ui/`。**不改 `app.js`。** 存量用基线冻结：新违规失败，违规变少也失败，要收紧基线，不能靠重写基线过关。

规则按这份副本的实际写法选的，替代写法都写在规则的 `message` 里：

| 规则 | 替代 | 本轮基线 |
|---|---|---|
| `inline-style` | 行内 `style` → class；动态尺寸用 CSS 变量 | 107 |
| `font-size-off-scale` | 字号只用 12/14/16/18/20/24px，或 CSS 变量。副本里游离的是 `13px` | 10 |
| `color-literal` | `#hex`、`rgb()` / `hsl()`、颜色名 → 现有 CSS 变量（`var(--p0)`、`var(--tx3)` 这类） | 0 |

色值规则特意不扫裸的 `#……`。`$(' #fbar ')` 这种选择器会被当成四位色值。只认 `color` / `background` / `border` / `fill` / `stroke` 后面的字面量。

`color-literal` 是 0：副本里的颜色已经走 CSS 变量，没有 `#hex`、`rgb()`、`hsl()`。基线文件里因此没有这一条（处数为 0 的规则不落行）。检查时按 0 比较，之后新写一个色值就会失败。另外两条不是空跑，合计 117 处，全部在 `pilot-source/ui/app.js`。

没有加「页面里直接 `fetch`」：唯一的 `fetch` 在同文件的 `api()` 里，逐行正则分不清封装和页面调用。这条留到数据层拆出去之后再开。

## 复跑

`--root` 是试点目录，不是仓库根。基线路径相对这个 root。在仓库根目录执行：

```bash
# 只统计，不跟基线比，退出码 0
node skills/admin-guardrails/scripts/ratchet.mjs \
  --config docs/pilots/dingdong-ux-radar-insights/guardrails/ratchet.config.json \
  --root docs/pilots/dingdong-ux-radar-insights \
  --report

# 检查。新增或减少都非零退出
node skills/admin-guardrails/scripts/ratchet.mjs \
  --config docs/pilots/dingdong-ux-radar-insights/guardrails/ratchet.config.json \
  --root docs/pilots/dingdong-ux-radar-insights
```

第一次入库用 `--update-baseline` 写下当前 117 处。之后只在违规变少时用它收紧。比基线多会被拒绝。新增规则、纳入新目录这种必须放宽的情况，才加 `--allow-increase`，并在提交说明里写原因。检查失败时改代码，不要重写基线。

豁免写在命中行或上一行：`lint-allow: <规则 id> <原因>`。没有原因不算数。
