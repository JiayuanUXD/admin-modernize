# 能力盘点（带出处）

扫描根：`docs/pilots/dingdong-ux-radar-insights/pilot-source`

```bash
node skills/admin-recon/scripts/capabilities.mjs --root docs/pilots/dingdong-ux-radar-insights/pilot-source --out /tmp/recon-capabilities.json --md /tmp/recon-capabilities.md
```

- 页面接口只来自 extract-desired。认不出 URL 的调用不在表里。
- 数据层方法是 services / pipeline / controllers 等文件里不以 _ 开头的具名函数。不从路由分支反推接口。
- .vue 单文件组件里的方法定义本模式不扫。页面里的调用仍然来自 extract-desired。
- 没有 pages/<模块>/ 时，模块名取页面文件的父目录，或数据层文件名。路径资源是路径上的第一个静态段，不是业务模块名。

模块 3 个。页面调用 71 条，数据层调用 0 条，数据层方法 36 个。

## 模块 `api`

### 页面已用接口

（无）

### 数据层里的调用

（无）

### 数据层方法

| 方法 | 出处 | 种类 |
|---|---|---|
| `Api.can_write` | `pipeline/api.py:188` | method |
| `Api.dispatch` | `pipeline/api.py:199` | method |
| `make_handler` | `pipeline/api.py:689` | function |
| `Handler.log_message` | `pipeline/api.py:700` | method |
| `Handler.do_GET` | `pipeline/api.py:738` | method |
| `Handler.do_POST` | `pipeline/api.py:744` | method |
| `Handler.do_PUT` | `pipeline/api.py:748` | method |
| `Handler.do_DELETE` | `pipeline/api.py:753` | method |
| `Handler.do_OPTIONS` | `pipeline/api.py:757` | method |
| `serve` | `pipeline/api.py:834` | function |

## 模块 `insights`

### 页面已用接口

（无）

### 数据层里的调用

（无）

### 数据层方法

| 方法 | 出处 | 种类 |
|---|---|---|
| `normalize_filters` | `pipeline/insights.py:80` | function |
| `resolve_me` | `pipeline/insights.py:140` | function |
| `load_trackers` | `pipeline/insights.py:176` | function |
| `build_where` | `pipeline/insights.py:230` | function |
| `list_insights` | `pipeline/insights.py:381` | function |
| `facets` | `pipeline/insights.py:486` | function |
| `get_insight` | `pipeline/insights.py:594` | function |
| `list_events` | `pipeline/insights.py:695` | function |
| `export_csv` | `pipeline/insights.py:704` | function |
| `export_posts` | `pipeline/insights.py:780` | function |
| `claim` | `pipeline/insights.py:921` | function |
| `set_status` | `pipeline/insights.py:944` | function |
| `set_note` | `pipeline/insights.py:980` | function |
| `set_flag` | `pipeline/insights.py:992` | function |
| `tag_manual` | `pipeline/insights.py:1008` | function |
| `set_severity` | `pipeline/insights.py:1039` | function |
| `bulk` | `pipeline/insights.py:1143` | function |
| `north_star` | `pipeline/insights.py:1212` | function |
| `list_views` | `pipeline/insights.py:1264` | function |
| `get_view` | `pipeline/insights.py:1274` | function |
| `save_view` | `pipeline/insights.py:1287` | function |
| `delete_view` | `pipeline/insights.py:1307` | function |
| `seed_builtin_views` | `pipeline/insights.py:1326` | function |
| `summary` | `pipeline/insights.py:1343` | function |
| `meta` | `pipeline/insights.py:1379` | function |
| `owner_loads` | `pipeline/insights.py:1456` | function |

## 模块 `ui`

### 页面已用接口

| 方法 | 路径 | 路径资源 | 出处 | 符号 | 置信度 |
|---|---|---|---|---|---|
| GET | `/api/meta` | meta | `ui/app.js:476` | boot | medium |
| GET | `/api/summary` | summary | `ui/app.js:476` | boot | medium |
| GET | `/api/views` | views | `ui/app.js:476` | boot | medium |
| GET | `/api/health` | health | `ui/app.js:477` | boot | medium |
| GET | `/api/north-star` | north-star | `ui/app.js:477` | boot | medium |
| GET | `/api/insights` | insights | `ui/app.js:814` | cmdkSearchRemote | low |
| GET | `/api/board` | board | `ui/app.js:815` | cmdkSearchRemote | low |
| GET | `/api/views/{param}` | views | `ui/app.js:1232` | applyView | low |
| POST | `/api/views` | views | `ui/app.js:1266` | saveView | medium |
| GET | `/api/views` | views | `ui/app.js:1267` | saveView | medium |
| DELETE | `/api/views/{param}` | views | `ui/app.js:1289` | delView | low |
| GET | `/api/views` | views | `ui/app.js:1290` | delView | medium |
| GET | `/api/insights` | insights | `ui/app.js:1322` | loadInsights | low |
| GET | `/api/facets` | facets | `ui/app.js:1323` | loadInsights | low |
| POST | `/api/insights/{param}/claim` | insights | `ui/app.js:1513` | ownerMenuSpec | low |
| POST | `/api/insights/{param}/claim` | insights | `ui/app.js:1526` | unclaimOne | low |
| POST | `/api/insights/{param}/flag` | insights | `ui/app.js:1536` | flagAct | low |
| POST | `/api/insights/{param}/status` | insights | `ui/app.js:1559` | stMenuSpec | low |
| POST | `/api/insights/{param}/severity` | insights | `ui/app.js:1585` | sevLabel | low |
| POST | `/api/export/posts.csv` | export | `ui/app.js:1678` | exportPosts | medium |
| POST | `/api/insights/bulk` | insights | `ui/app.js:1869` | doBulk | medium |
| GET | `/api/insights/owner-loads` | insights | `ui/app.js:1915` | openAssign | medium |
| POST | `/api/insights/{param}/claim` | insights | `ui/app.js:2001` | asgGo | low |
| POST | `/api/insights/bulk` | insights | `ui/app.js:2011` | asgGo | medium |
| GET | `/api/north-star` | north-star | `ui/app.js:2040` | refreshCounters | medium |
| GET | `/api/summary` | summary | `ui/app.js:2040` | refreshCounters | medium |
| GET | `/api/insights/{param}` | insights | `ui/app.js:2166` | openDetail | low |
| POST | `/api/insights/{param}/claim` | insights | `ui/app.js:2295` | claimTo | low |
| POST | `/api/insights/{param}/status` | insights | `ui/app.js:2311` | claimTo | low |
| POST | `/api/insights/{param}/note` | insights | `ui/app.js:2318` | claimTo | low |
| POST | `/api/insights/{param}/status` | insights | `ui/app.js:2327` | claimTo | low |
| POST | `/api/insights/{param}/tag` | insights | `ui/app.js:2336` | claimTo | low |
| POST | `/api/insights/{param}/tag` | insights | `ui/app.js:2347` | claimTo | low |
| GET | `/api/board` | board | `ui/app.js:2456` | loadBoard | low |
| GET | `/api/board/meta` | board | `ui/app.js:2457` | loadBoard | medium |
| POST | `/api/board/{param}/status` | board | `ui/app.js:2692` | doThemeStatus | low |
| GET | `/api/board/{param}` | board | `ui/app.js:2709` | openCard | low |
| POST | `/api/board/{param}/status` | board | `ui/app.js:2822` | save | low |
| GET | `/api/workbench` | workbench | `ui/app.js:2874` | loadWorkbench | low |
| GET | `/api/workbench/summary` | workbench | `ui/app.js:2897` | loadWbBadge | low |
| GET | `/api/ops/summary` | ops | `ui/app.js:2898` | loadWbBadge | medium |
| GET | `/api/settings/summary` | settings | `ui/app.js:2899` | loadWbBadge | medium |
| GET | `/api/archive/summary` | archive | `ui/app.js:2900` | loadWbBadge | medium |
| POST | `/api/insights/bulk` | insights | `ui/app.js:3256` | wbBulkClaim | medium |
| POST | `/api/insights/{param}/claim` | insights | `ui/app.js:3301` | wbClaim | low |
| POST | `/api/insights/{param}/status` | insights | `ui/app.js:3311` | wbSetStatus | low |
| POST | `/api/board/{param}/status` | board | `ui/app.js:3327` | wbThemeStatus | low |
| GET | `/api/ops` | ops | `ui/app.js:3357` | loadOps | medium |
| GET | `/api/jobs` | jobs | `ui/app.js:3436` | startOpsJobPoll | medium |
| POST | `/api/jobs` | jobs | `ui/app.js:3563` | runOpsJob | medium |
| GET | `/api/jobs/{param}` | jobs | `ui/app.js:3587` | toggleJobLog | low |
| GET | `/api/rollback/preview` | rollback | `ui/app.js:3991` | pickBatch | low |
| POST | `/api/rollback/apply` | rollback | `ui/app.js:4012` | rbApply | medium |
| POST | `/api/samples/draw` | samples | `ui/app.js:4238` | drawSamples | medium |
| POST | `/api/samples/{param}/review` | samples | `ui/app.js:4286` | postSampleReview | low |
| GET | `/api/trackers` | trackers | `ui/app.js:4379` | loadTrackers | low |
| GET | `/api/trackers/meta` | trackers | `ui/app.js:4380` | loadTrackers | medium |
| POST | `/api/trackers/{param}/status` | trackers | `ui/app.js:4714` | doTrackerStatus | low |
| POST | `/api/trackers/{param}/status` | trackers | `ui/app.js:4909` | save | low |
| GET | `/api/dashboard` | dashboard | `ui/app.js:4975` | loadDashboard | low |
| GET | `/api/settings` | settings | `ui/app.js:5301` | loadConfig | medium |
| POST | `/api/jobs` | jobs | `ui/app.js:5811` | cfgRunAction | medium |
| GET | `/api/jobs/{param}` | jobs | `ui/app.js:5830` | cfgPollJob | low |
| GET | `/api/settings/test` | settings | `ui/app.js:5986` | runCfgTest | low |
| GET | `/api/settings/diff` | settings | `ui/app.js:6012` | loadCfgDiff | low |
| GET | `/api/settings/edit/{param}` | settings | `ui/app.js:6078` | loadCfgEditor | low |
| POST | `/api/settings/preview` | settings | `ui/app.js:6464` | cfgEditPreview | medium |
| PUT | `/api/settings/edit/{param}` | settings | `ui/app.js:6492` | cfgEditSave | low |
| GET | `/api/settings/test` | settings | `ui/app.js:6590` | cfgEdTestTracker | low |
| GET | `/api/archive` | archive | `ui/app.js:6726` | loadArchive | medium |
| GET | `/api/archive/weekly/{param}` | archive | `ui/app.js:6959` | loadWeekly | low |

### 数据层里的调用

（无）

### 数据层方法

（无）
