# 列表 + 抽屉（脱敏）

一条后台页面，固定给反馈环对照用。

- 标题是「洞察池」。列表每一行能打开右侧抽屉。
- 三种状态：空列表、多条、打开 `ins-001` 的抽屉。
- 数据从网络来：`GET /api/insights`、`GET /api/facets`、`GET /api/insights/{id}`。
- 页面声明权限点 `insight.read` 和 `insight.claim`。预览不校验登录。
- 数据是固定种子，不是生产数据。种子不写在页面文件里。

页面文件在 `fixtures/preview-app/`。离线启动、mock、截图和生产包检查在该目录外面，见 `../SKILL.md` 的「本仓库可跑的最小设施」。
