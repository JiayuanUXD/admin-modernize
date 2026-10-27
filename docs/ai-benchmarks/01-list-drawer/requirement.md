# 反馈条目：列表 + 抽屉

值班的人打开一个列表，按关键词查看反馈条目，点一行打开抽屉。抽屉里可以认领、改状态、写备注。

接口就这 6 个：

| 操作 | 方法 + 路径 | 请求 |
|---|---|---|
| 列表 | `GET /api/items` | 查询参数至少有 `q`、`page_size` |
| 筛选计数 | `GET /api/facets` | 无固定查询字段 |
| 详情 | `GET /api/items/{id}` | 无请求体 |
| 认领 | `POST /api/items/{id}/claim` | `owner`、`actor`，`note` 可选 |
| 改状态 | `POST /api/items/{id}/status` | `status_id`、`actor`。`note` 不传表示不动原备注，传空串才清空 |
| 写备注 | `POST /api/items/{id}/note` | `note`、`actor` |

契约片段：`contract.openapi.json`。

## 自动检查

- 仓库的检查命令对这次改动退出码 0。
- 截图命令退出码 0：桌面和窄屏都要有空列表、多条、抽屉打开。

## 人工检查

- 列表和抽屉同时可见，关抽屉后回到原列表。
- 空列表有空态，不拿「加载失败」代替。
- 改状态时，没填备注的提交体里不要出现 `note: ""`。
