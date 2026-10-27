# 合成 monorepo

前后端放在一个目录里，用来演练逻辑拆。这里没有下面三条里的任何一条：

1. 前后端发布节奏不同。
2. 后端由另一个团队拥有。
3. 合规或部署要求物理隔离。

所以默认停在仓内隔离，不进物理拆。`drill-split.mjs` 会在临时克隆上跑 `git filter-repo`，只为了把命令跑通。跑完即删，不把本目录拆成两个仓。

| 路径 | 作用 |
|---|---|
| `contracts/openapi.json` | 唯一契约 |
| `apps/web/` | 前端。`src/types.js` 标明由契约生成 |
| `services/api/` | 后端 |
| `CODEOWNERS` | 两侧目录不同 owner（占位，不是真人） |
| `.github/workflows/ci.yml` | 两个 job，各跑各的检查 |

```bash
node skills/admin-repo-split/scripts/drill-split.mjs
```
