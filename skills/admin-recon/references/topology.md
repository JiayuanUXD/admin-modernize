# 拓扑：先判单仓还是分仓

拓扑不是背景信息，是**决定隔离机制放在哪一层**的依据：

| 拓扑 | 隔离放哪 | 主要风险 | 下一步 |
|---|---|---|---|
| 单仓，前后端同构建体系 | 目录 + CODEOWNERS + 拆 CI job | AI 误改后端；构建耦合 | `admin-repo-split` |
| 单仓，前后端两套构建 | 目录 + CODEOWNERS + 独立 CI | AI 误改后端；历史耦合 | `admin-repo-split`（最便宜） |
| 多仓 | 契约 + 版本 + 发布顺序 | 契约漂移；联调成本 | 直接进阶段 1 |
| 服务端渲染为主 | 路由级替换 + 共享外壳 | 页面不在前端工程里，规则扫不到 | `admin-legacy-migration` |
| 微前端 | 子应用边界 | 样式隔离、token 跨子应用统一 | 按子应用拆试点 |

判错的代价：把分仓当单仓，会去改构建和目录，做完发现本来就不用拆；把单仓当分仓，会跳过契约冻结，拆完两仓漂移。

## 怎么扫

单仓：

```bash
node <本 skill>/scripts/inventory.mjs --topology <仓库>
```

分仓（多路径，或直接给父目录——子目录是独立 git 仓时会自动展开）：

```bash
node <本 skill>/scripts/inventory.mjs --topology <前端仓> <后端仓>
node <本 skill>/scripts/inventory.mjs --topology <含多个 git 仓的父目录>
```

完整盘点也会输出「## 拓扑」一节；`--json` 时在 `profile.topology`。

## 六种形态

| 形态 | 典型特征 |
|---|---|
| `monorepo-fullstack` | workspace 或多子包，同时有前端依赖和后端构建文件 |
| `single-fullstack` | 无 workspace，前端框架 + 后端（Node 全栈或构建文件）在同一仓 |
| `monorepo-frontend` | workspace/多子包，只有前端 |
| `single-frontend` | 单前端应用仓 |
| `single-backend` | 单后端仓，没有页面 |
| `server-rendered` | 服务端模板 ≥ 10 且没有前端组件文件，页面不在前端工程里 |
| `multi-repo` | 扫描的是父目录，子目录各自是 git 仓 |
| `unknown` | 信号不足，人工确认 |

## 怎么读报告

1. **形态**：决定下一步走哪个 skill。`monorepo-fullstack` / `single-fullstack` 才需要 `admin-repo-split`。
2. **置信度**：高 = 至少两条结构证据（workspace、构建文件、多子包、容器、模板）；中 = 一条；低 = 只有依赖或扩展名线索。置信度低时不要据此选方案，先把仓边界问清楚。
3. **拆仓难度**：`同仓两套构建` 最便宜（物理移目录即可）；`同仓同构建体系` 要动 workspace、构建配置、CI；`已是分仓` 不用拆。
4. **契约产物**：有 OpenAPI/proto/类型文件，拆仓才有唯一来源；没有就先补，否则拆完两边漂移。
5. **服务端模板数与微前端**：决定迁移通道（原地改 vs 路由级替换 vs 子应用边界），不是拆仓问题。

## 边界情况

- **单前端仓不等于系统只有前端**：另一端可能在别的仓。`--topology` 只给一个路径时，报告会提示补扫。
- **父目录不是仓库**：如果父目录本身是 git 仓，子目录里的 `.git` 会被当作子模块，不会命中 `multi-repo`；用多路径明确列出。
- **前端仓里的 Node 脚本**：`server/`、`api/` 目录名本身不算后端证据，要看构建文件或后端框架依赖。
- **服务端模板少**：少于 10 个时只作提示，不改形态——尾部几个模板页不值得单独一条迁移通道。
- **微前端**：只在依赖里判定；壳工程没有 qiankun 依赖但实际是微前端的情况会漏，向用户确认。
- **monorepo 的子包**：`examples/`、`fixtures/`、`__tests__/` 下的 package.json 不算子包。这些目录里的页面文件、后端源码和契约文件也不参与形态判定。
- **子包里的 express**：根 `package.json` 没有后端依赖、后端源码也不够 5 个时，form 不会因为子包被标成「后端」就变成 fullstack。
- 本仓库上跑出来的形态和几条误判，写在 `admin-recon` skill 的「常见错误」。复跑：`node skills/admin-recon/scripts/verify-topology.mjs`。
