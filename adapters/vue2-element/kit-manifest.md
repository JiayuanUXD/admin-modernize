# kit 清单

来源：合成约定。这些名字是 Element UI 列表页和表单页反复用到的组件，不是从某个生产提交抄来的路径。清单不给出 mixin 或指令的真实仓库路径。

## 可共享

只依赖 Element UI，标成可共享。

| 组件 | 依赖 | 耦合 |
|---|---|---|
| `el-table`、`el-table-column` | Element UI | 可共享 |
| `el-form`、`el-form-item` | Element UI | 可共享 |
| `el-pagination` | Element UI | 可共享 |
| `el-button` | Element UI | 可共享 |
| `el-dialog` | Element UI | 可共享 |
| `el-drawer` | Element UI | 可共享 |
| `Message`、`MessageBox` | Element UI | 可共享 |

## 解耦前不共享

- 页面私有 mixin。里面夹了项目接口或权限判断的那种，解耦前不共享。
- 权限指令，例如项目自己的 `v-permission`。标成不共享，直到不再依赖项目私有模块。

没有第二份生产源码，所以这里不写仓库路径。
