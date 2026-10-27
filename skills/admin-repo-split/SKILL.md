---
name: admin-repo-split
description: Use when a back-office system's frontend and backend live in one repository and they need independent release, separate ownership, or a write boundary that keeps AI-generated pages away from backend code — deciding whether to split, freezing the contract first, doing the logical split before the physical one, and keeping the two sides in sync afterwards. 前后端同仓拆分、拆仓、仓库边界。
---

# admin-repo-split：前后端同仓，先把边界拆出来

拆仓解决的是**独立发布和独立所有权**，不是「AI 别碰后端」——那件事靠目录白名单、分支保护和 CI 门禁，跟拆不拆仓无关。把两者混在一起，会得到一次成本很高、收益很小的拆仓。

## 什么时候拆

三个信号，命中一个才值得：

1. 前后端发布节奏不同（前端要天级发，后端按版本发）。
2. 后端由另一个团队拥有（CODEOWNERS 已经写不出共同维护）。
3. 合规或部署要求物理隔离。

都没有的话，先做「仓内隔离」：目录 + CODEOWNERS + 独立 CI job + 分支保护。同样的边界，成本十分之一。

## 红线

| 念头 | 现实 |
|---|---|
| 先拆目录，契约以后再说 | 拆完就是两个漂移的仓，联调返工比拆之前更多 |
| 拆仓顺便把后端重构了 | 拆仓的 diff 已经够大，混进逻辑改动，回滚时分不清 |
| 用 `cp -r` 复制代码建新仓 | 历史全丢，`git blame` 和线上问题定位一起丢 |
| 拆完两边各自维护契约 | 一定是两份，一定漂移 |
| 拆仓 = 安全了，AI 可以随便写 | 安全来自分支保护和目录白名单，不来自仓库个数 |

## 顺序：契约 → 逻辑拆 → 物理拆

**第 1 步：冻结契约（不改任何目录）**

- 契约唯一来源定在哪一侧（D4）：后端产 OpenAPI / proto，或前端产类型文件作为协商件。
- 契约进版本号，另一侧由它生成，不手工维护两份。
- 没有契约产物就先补，补完再谈拆。详见 `admin-api-contract`。

**第 2 步：逻辑拆（还在一个 git 仓里）**

- 目录边界先划出来：`apps/web`、`services/api`（或团队既有约定）。
- 加 CODEOWNERS：前端目录和后端目录不同 owner。
- CI 拆成两个 job，各自只跑一侧的检查；部署产物也分开。
- 目标是证明「两侧能独立构建、独立发布」，而不是先挪 git。

**第 3 步：验证独立发布**

- 前端能在后端不发版的情况下发布一次（兼容旧接口的版本）。
- 后端能在前端不发版的情况下发布一次（不破坏已有字段）。
- 两侧各有一条检查命令，且都不需要另一侧的源码。

**第 4 步：物理拆（保留历史）**

在**克隆**上做，不要在原仓直接操作：

```bash
# 方案 A：git filter-repo（推荐，先装：pip install git-filter-repo）
git clone <原仓> web && cd web
git filter-repo --path apps/web --path packages/ui --path-rename apps/web/: --path-rename packages/ui/ui/
# 核对：提交数、文件数、标签是否保留

# 方案 B：git subtree split（只想抽一个子目录时更简单）
git subtree split -P apps/web -b web-split
```

- 拆完保留原仓只读（至少 3 个月）作为回滚和对照。
- LFS 文件、子模块、CI 配置里的仓库路径都要单独核对。
- 顺序建议：契约包 → 前端 → 后端。后端是线上风险的承载者，动得越晚越好。

**第 5 步：跨仓契约同步**

- 契约版本进 CI：前端锁定契约版本，后端变更走版本号 + 变更日志。
- 跨仓契约测试：CI 里对测试环境跑一遍契约校验，字段差异在合并前暴露。
- 发布顺序写进文档并自动化检查：前端先发兼容旧接口的版本，后端后发。

## 验收清单

- [ ] 契约只有一个来源，另一侧由它生成
- [ ] 两侧各自能独立构建、独立发布，互不需要对方源码
- [ ] 各自的检查命令在 CI 里强制
- [ ] 跨仓契约测试通过（对测试环境）
- [ ] 发布顺序与兼容窗口写进文档，且有人负责
- [ ] 原仓只读、保留期与回滚步骤明确
- [ ] CODEOWNERS 覆盖两个新仓
- [ ] 分支保护开启，AI 与任何人都不能直接推 main

## 回滚

拆仓的回滚不是 `git revert`，是「回到原仓继续开发，新仓作废」。所以：

- 原仓在验证期内保持可构建（不删 CI，不归档）。
- 新仓上线后至少跑一个完整发布周期再决定原仓是否只读归档。
- 在 PR 里写明「回滚 = 切回原仓」，避免事后没人知道怎么退。

## 拆仓之后，AI 的边界反而更容易做

- 前端仓里没有后端代码可误改，AI 的写入面天然收窄。
- 但「AI 能不能推 main」仍然只能靠分支保护和 CODEOWNERS，不要因为拆了仓就放宽。
- 如果拆完是「前端仓 + 后端仓」，前后端同修的 PR 会变成两个 PR：用契约版本对齐，不要用「先合后合」的口头约定。

## 最小版与完整版

| 阶段 1 最小版 | 阶段 2 完整版 |
|---|---|
| 契约唯一来源；逻辑拆（目录 + CODEOWNERS + 独立 CI job）；两侧能独立构建 | 物理拆；跨仓契约测试；发布顺序自动化；原仓只读与回滚演练 |

## 合成演练

`fixtures/synthetic-monorepo/` 里前后端同目录，三个拆仓信号一条都没有，所以演练停在仓内隔离，不进物理拆。`git filter-repo` 只在临时克隆上跑，跑完即删。

```bash
node skills/admin-repo-split/scripts/drill-split.mjs
```

脚本拷到临时目录后做 3 笔提交：搭上契约和两侧目录；只改 `apps/web/src/types.js`；只改 `services/api/src/server.js`。再克隆一份，在克隆上执行：

```bash
python3 -m git_filter_repo \
  --path apps/web \
  --path contracts \
  --path CODEOWNERS \
  --path .github
```

2026-10-27 的输出：`commits_before=3`，`commits_after=2`，`services/api` 文件数为 0，`apps/web/check.mjs` 和 `contracts/openapi.json` 还在。只改后端的那笔被丢掉。临时目录里的原件不动。

本环境的命令是 `python3 -m git_filter_repo`（包 2.47.0）。`git filter-repo` 这个可执行文件不在默认 PATH 上时，不要把它写成已经跑通。模块缺失时脚本失败退出。只抽一个子目录的等价做法是在克隆上 `git subtree split -P apps/web -b web-split`，这一轮没有用它。

| 逻辑拆清单 | 合成仓上的结果 |
|---|---|
| 契约只有一个来源 | 通过。只有 `contracts/openapi.json`，`apps/web/src/types.js` 写明由它生成 |
| 两侧离开对方源码仍能检查 | 通过。`apps/web` 与 `services/api` 分别拷走再 `node check.mjs` |
| CI 里各有检查命令 | 通过。workflow 两个 job |
| CODEOWNERS 覆盖两侧目录 | 通过。owner 是占位名 `@web-owner`、`@api-owner`，不是真人 |
| 跨仓契约测试、原仓只读、分支保护 | 不做。默认仓内隔离，这些是物理拆之后的事 |

## 常见错误

- 没有契约就拆，拆完两边字段对不上，联调比拆之前更久。
- 拆仓和重构混在一个提交里。
- 用复制目录建新仓，历史丢失。
- 拆完两边各维护一份契约。
- 把拆仓当成 AI 的安全措施，分支保护照旧没开。
- 原仓立刻归档，出问题时无路可退。
