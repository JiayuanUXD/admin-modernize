# 契约脚本

Node 18+，无第三方依赖。路径相对仓库根目录。

| 脚本 | 作用 |
|---|---|
| `extract-desired.mjs` | 从页面调用点抽 desired IR |
| `build-gap.mjs` | desired 对照 OpenAPI JSON 或 actual IR，写 gap IR |
| `../../scripts/generate-skeleton.mjs` | disposition 填完之后写映射骨架 |

样例对拍见 `../fixtures/sample-app/README.md` 和 `../fixtures/thin-wrappers/README.md`。形状见 `../references/ir-schema.md`。

## 薄封装默认名单

`extract-desired.mjs` 里的 `THIN_CALLS` 和 `THIN_API`：

| 调用 | 含义 |
|---|---|
| `get(url)` | GET |
| `delete(url)` | DELETE |
| `post(url, body)` | POST，第二参是请求体对象字面量 |
| `put(url, body)` | PUT，同上 |
| `patch(url, body)` | PATCH，同上 |
| `api(方法字面量, url, body?)` | 第一个参数必须是 `'GET'` 这类字符串，方法取这个字面量 |

另外一直认的是 `axios` / `fetch` / `$.ajax` / `$.get` / `$.post`。

真实页面经常是 `const get = (p) => api('GET', p)`，真正的 `fetch(path)` 用的是变量。只扫 `fetch` 会抽到 0 条。要扫外层这几个名字。

## 怎么扩展

同一种参数位置的别名，加进 `THIN_CALLS`（值是 HTTP 方法）或 `THIN_API`。例如团队把 POST 写成 `httpPost`，就加 `httpPost: 'POST'`。

参数位置不同的新形态，要在 `scanFile` 里加分支，写明 URL 在第几个参数。不要从变量名猜路径，也不要把 `loadInsights` 这种业务函数写进名单。

## URL 红线

认得出的 URL：

- 字符串字面量、模板字符串
- 以路径字面量开头的 `+` 拼接。静态片段保留，动态片段收成 `{param}`，置信度 `low`

直接跳过，不编接口：

- URL 整段是变量，例如 `fetch(path)`、`get(path)`、`api('GET', path)`
- `api` 的方法不是字符串字面量，例如 `api(method, '/api/insights')`
- 拼接里夹了三元表达式，看不清后面是路径还是查询串
- 注释里的调用

`${encodeURIComponent(id)}` 收成 `{param}`，不猜成 `{id}`。请求体只收对象字面量的键；值里面的 `.value` 不是字段。
