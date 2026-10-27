# 拓扑夹具

这些目录是合成的，没有提交 `.git`。`verify-topology.mjs` 在临时目录里补 `.git`，再跑 `inventory.mjs --topology`。

| 目录 | 用来确认什么 |
|---|---|
| `single-fullstack/` | 根 `package.json` 同时有 react 和 express → `single-fullstack` |
| `split/` | `web/` 与 `api/`。只有子目录被 `git init` 之后，父目录才是 `multi-repo` |
| `server-dirname/` | 有 `server/index.js`，依赖里只有 react → 仍是 `single-frontend` |
| `java-under-fixtures/` | `fixtures/` 下放了 5 个 `.java`。形态判定不把样例树当证据，结果仍是 `single-frontend` |

本插件仓库本身也扫一次：它是一个 git 仓，当前形态是 `unknown`。
