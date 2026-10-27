/* 叮咚体验雷达 · 后台前端
 *
 * 一个刻意的取舍：不引框架、不打包、不加依赖。
 * 这个后台的全部复杂度在数据语义（版本化标签、状态流转、口径一致），不在 UI。
 * 引一个 SPA 框架进来，只会让"改一列"变成"改三处"。
 *
 * 契约：所有中文标签都从 /api/meta 拿，页面里不写死任何一个分类体系的值。
 * 这样 config/taxonomy.json 改版时，页面跟着变，不会出现"配置改了、页面还是旧的"。
 */

const AXIS_ORDER = ['experience', 'category', 'sentiment', 'severity', 'persona'];

// 每天真正会被点的只有这四个。剩下的折起来 —— 筛选器占掉半屏，列表就掉到折叠线以下了，
// 而列表才是这个页面的主角。
const PRIMARY_AXES = ['severity', 'experience', 'owner', 'status'];
const SECONDARY_AXES = ['category', 'sentiment', 'persona'];

// 导航是扁平的：不按「看 / 办 / 养 / 存」分段，不编号。顺序承担分组的职能 ——
// 前五个是每天 / 每周会点的，按"待办 → 条目 → 主题 → 趋势 → 横切面"的处理深度排；
// 后三个是维护用的。图标是内联 SVG（16×16，currentColor，1.5 描边），
// 侧栏 <1180px 收成图标轨时只剩它，所以每项还带 aria-label。
const ICON = {
  // 收件托盘：今天该我做什么
  inbox:   '<path d="M2.5 9.5h3l1.5 2.5h2l1.5-2.5h3"/><path d="M4 3.5h8l1.5 6v3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-3z"/>',
  // 三层叠片：条目池
  layers:  '<path d="M8 2.5 14 5.5 8 8.5 2 5.5z"/><path d="m2 8.5 6 3 6-3"/><path d="m2 11.5 6 3 6-3"/>',
  // 三列泳道：主题看板
  kanban:  '<rect x="2" y="2.5" width="3.2" height="11" rx=".8"/><rect x="6.4" y="2.5" width="3.2" height="7" rx=".8"/><rect x="10.8" y="2.5" width="3.2" height="9" rx=".8"/>',
  // 折线脉搏：趋势
  pulse:   '<path d="M1.5 9h2.5l2-5 3 8 2-4.5 1.5 1.5h2"/>',
  // 柱状图：横切面
  bars:    '<path d="M3 13.5V8"/><path d="M7 13.5V4"/><path d="M11 13.5V6.5"/><path d="M1.5 13.5h13"/>',
  // 数据库柱：底层数据
  db:      '<ellipse cx="8" cy="4" rx="5.5" ry="2"/><path d="M2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4"/><path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"/>',
  // 滑杆：规则
  sliders: '<path d="M2 4.5h12M2 11.5h12"/><circle cx="6" cy="4.5" r="1.6"/><circle cx="10.5" cy="11.5" r="1.6"/>',
  // 归档箱：历史
  archive: '<rect x="2" y="2.5" width="12" height="3" rx=".8"/><path d="M3 5.5v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-7"/><path d="M6.5 8.5h3"/>',
  // 以下是页面里的小记号，和导航图标同一套笔画（16 格、1.5 线宽、圆头）。
  search:      '<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/>',
  info:        '<circle cx="8" cy="8" r="6.25"/><path d="M8 7.25V11"/><path d="M8 5h.01"/>',
  check:       '<path d="m3.5 8.5 3 3 6-7"/>',
  checkCircle: '<circle cx="8" cy="8" r="6.25"/><path d="m5.25 8.25 1.9 1.9 3.6-4.15"/>',
  xCircle:     '<circle cx="8" cy="8" r="6.25"/><path d="m6 6 4 4M10 6l-4 4"/>',
  minusCircle: '<circle cx="8" cy="8" r="6.25"/><path d="M5.5 8h5"/>',
  alert:       '<path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.5 9.75a1 1 0 0 1-.87 1.5h-11a1 1 0 0 1-.87-1.5z"/><path d="M8 6.25v3"/><path d="M8 11.5h.01"/>',
  external:    '<path d="M5.5 3.5h7v7"/><path d="m12.5 3.5-9 9"/>',
  maximize:    '<path d="M9.5 2.5h4v4"/><path d="m13.5 2.5-4.5 4.5"/><path d="M6.5 13.5h-4v-4"/><path d="m2.5 13.5 4.5-4.5"/>',
  minimize:    '<path d="M9 2.5V7h4.5"/><path d="m9 7 4.5-4.5"/><path d="M7 13.5V9H2.5"/><path d="m7 9-4.5 4.5"/>',
  star:        '<path d="m8 1.9 1.85 3.75 4.15.6-3 2.92.7 4.13L8 11.35 4.3 13.3l.7-4.13-3-2.92 4.15-.6z" fill="currentColor"/>',
  arrowUp:     '<path d="M8 13V3.5"/><path d="m4 7.5 4-4 4 4"/>',
  arrowDown:   '<path d="M8 3v9.5"/><path d="m4 8.5 4 4 4-4"/>',
  x:           '<path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/>',
};

const PAGES = [
  { id: 'workbench', name: '工作台',   icon: 'inbox' },
  { id: 'insights',  name: '洞察池',   icon: 'layers' },
  { id: 'board',     name: '跟进看板', icon: 'kanban' },
  { id: 'trackers',  name: '追踪中心', icon: 'pulse' },
  { id: 'weekly',    name: '本周看板', icon: 'bars' },
  { id: 'pipeline',  name: '数据管道', icon: 'db' },
  { id: 'config',    name: '配置中心', icon: 'sliders' },
  { id: 'archive',   name: '归档',     icon: 'archive' },
];

function iconSvg(name, size = 16, cls = '') {
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor"
    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
}

// 结论条 / 自检卡片最前面的记号。颜色跟外层的 .ok / .warn / .bad 走；none 是「还没测过」。
const LEVEL_ICON = { ok: 'checkCircle', warn: 'alert', bad: 'xCircle', none: 'minusCircle' };
const levelMark = (level, size = 16) => iconSvg(LEVEL_ICON[level] || LEVEL_ICON.ok, size);
// 新窗口打开的链接末尾那个小斜箭头。
const EXT_ICON = iconSvg('external', 12, 'ext');

// 八个页面现在都是能点的了，"规划中"这张表因此空了。
//
// 留着这个空对象而不是删掉：`renderSoonPage` 还挂在路由的兜底分支上
// （页面 id 写错时它会说"页面不存在"）。等哪天有第九页要规划，
// 这里就是它该待的地方 —— 而不是在导航项上写一个 `soon: true` 然后让页面白屏。
const SOON = {};

// ---------------------------------------------------------------- 状态

const S = {
  page: 'workbench',
  meta: null,
  summary: null,
  views: [],
  northStar: null,
  data: null,
  facets: null,
  detail: null,
  activeView: null,
  moreOpen: false,
  canWrite: true,
  // 角色单独存一份。`canWrite` 只回答"能不能改状态/认领"，
  // 而回滚要的是更严的一档（只给 admin）—— 拿 canWrite 代替它会出现
  // "owner 看到一个可点的删除按钮，点下去 403"，那是最差的一种交互。
  // 默认取最小权限：boot() 拿到 /api/health 之前不该有任何删除按钮，
  // 而 boot 失败时这一页根本渲染不出来 —— 所以这个默认值只在异常路径上起作用，
  // 那就让它偏向"什么都不给"。
  role: 'owner',
  actor: localStorage.getItem('dd_actor') || '我',
  loadSeq: 0,        // 防止慢请求盖掉快请求
  // 全站口径：这一屏按哪把尺子算。空串 = 交给服务端解析成当前口径。
  // 它是**全局**的（ADMIN-IA §一.3：口径只有一个开关），所以不放在任何一页的状态里 ——
  // 放在页面状态里就会变成"每个页面各有一把尺子"，而对不上的那两屏都看不出问题。
  version: '',
  // URL 里的 open=<id>：先记下来，等这一页的列表装完再打开 —— 详情要在列表旁边高亮出自己是哪一行。
  pendingOpen: '',
  f: blankFilters(),
  // 批量选择。**绑在产生它的那份查询上**（selKey 就是那串查询参数）：
  // 换了筛选或翻了页，勾选立刻作废。一个"已选 12 条"如果对不上屏幕上的行，
  // 它就是在骗人，而批量写是最不能被骗的地方。
  sel: new Set(),
  selKey: null,
  selDropped: 0,     // 上一次收敛时被丢掉的勾选数（那几条已经不在这一页了）
  bulkFail: [],      // 上一条批量操作里失败的条目，带原因，显示在操作条里
  // 工作台自己的状态：整屏一次取回（/api/workbench），不筛不翻页。
  // 它回答的是"今天该我做什么"，语义上是一次判断，不是一次查询。
  wb: null,
  wbSel: new Set(),   // P0 池里勾选的条目，批量认领用；整屏重取后只留还列着的
  // 数据管道自己的状态：同样是整屏一次取回。它回答的是"这些数还作不作数"。
  ops: null,
  // 本周看板自己的状态。窗口（days）是这一页的视图设置，跟着 URL 走。
  // 它**不是**筛选条件，所以不和洞察池的 S.f 共用。
  w: { data: null, days: 7 },
  // 看板自己的状态。和洞察池的筛选器刻意分开：那边是"条目级查询条件"，
  // 这边是"这一屏看哪几列"，语义不同，混在一个对象里必然互相污染。
  // status 是**数组**：泳道筛选天生是多值的，"还没闭环"就是 3 条泳道一起选。
  // 做成单选的话，看板上「待跟进 5」点过来只能落在 1 条泳道上（写 5 看到 2）。
  b: { data: null, detail: null, kind: '', owner: '', status: [],
       onlyFlagged: false, includeEmpty: true,
       // 手动收起的空泳道。空泳道默认**展开**（用户拍板），收起过的记在这里，重画不弹回。
       collapsed: new Set() },
  // 追踪中心自己的状态。口径不在这里 —— 它全站共用 S.version。
  t: { data: null, meta: null, detail: null, other: '', owner: '',
       status: '', direction: '', view: '', q: '', sort: 'alert' },
  // 配置中心（页面 7）。整屏一次取回；试算和版本间对照各自单独请求。
  // 试算的条件**不跟着 URL 走**：它是"如果这样配呢"的一次推演，不是"我现在在看哪批内容"。
  // 写成 URL 的话，转发出去的那条链接会带着一组根本没生效过的条件 ——
  // 而它长得跟真配置一模一样。
  cfg: { data: null, diff2: null, test: null, testF: {}, match: 'all',
         weeks: 12, from: '', to: '', seq: 0,
         job: null,     // 「动手」发起的作业（登记发布 / 重算历史），跑完清掉
         // 子路由 #config?edit=<kind>：editKind 跟 URL 走；edit 是装进来的那份可编辑文档（见 renderCfgEditorPage）
         editKind: null, edit: null,
         testOpen: false, relOpen: false, kwOpen: null,   // 折叠块的开合（试算抽屉 / 已登记版本 / 各词组）
         testFrom: '',                                     // 试算条件载入自哪条追踪项（改了 chip 就清）
         justSaved: null },                                // 刚从编辑器保存回来：一次性提示条
  // 归档（页面 8）。整屏一次取回；周报正文单独请求 ——
  // 它可能几千字，塞进整屏那一份里会让每次刷新都拖着它走。
  arc: { data: null, week: '', weekly: null,
         pick: '',   // 周历上选中的那一周：过滤下方的产物明细
         kind: '' }, // 类型 chip：'' 全部 / weekly 周报 / dashboard 看板快照 / version 分类版本
  // 危险区（回滚某次导入）。批次列表跟着 /api/ops 一起来；
  // **预览单独请求**：它要真算一遍影响面，不该每刷一次页面就跑一遍。
  // tick 是"我已经看过会删什么"那个勾选 —— 没勾上，执行按钮不可点。
  // busy 存的是在跑哪一步（'preview' / 'apply' / ''），因为两句话说得不一样：
  // "正在算"和"正在删"之间隔着一个不可撤销的动作，按钮上写错一个字就是误导。
  // result 存上一次执行的结果，留在页面上 —— 一句 toast 三秒就没了，
  // 而"我刚才到底删掉了什么"这件事，人往往是在伸手去点第二次之前才想起来问。
  rb: { preview: null, batch: '', tick: false, busy: '', err: '', result: null, expanded: false },
};

function blankFilters() {
  return {
    experience: [], category: [], sentiment: [], severity: [], persona: [],
    owner: [], status: [],
    // 追踪项：**单选**（存 id，不存数组）。它和标签轴不是一回事 —— 标签是"这条内容
    // 属于哪些类别"，所以天然多值；追踪项是"用哪个镜头看这批内容"，
    // 选两个等于取并集，而并集不是一个追踪项，界面却会让人以为在看某个追踪项的数。
    tracker: '',
    // 类型：笔记 / 评论。看板上的「笔记 / 评论」那一格点过来就是按它筛，
    // 少了它那一格就成了点不动的数字（或者更糟：点过去看到的是两个数的和）。
    item_type: '',
    severity_none: false, include_muted: false, only_open: false, starred: false,
    q: '', sort: 'time_desc',
    days: 0, likes_min: 0,
    page: 1, page_size: 50,
  };
}

// ---------------------------------------------------------------- 请求

function paramsFrom(f, forFacets) {
  const p = new URLSearchParams();
  for (const ax of AXIS_ORDER) {
    if (f[ax] && f[ax].length) p.set(ax, f[ax].join(','));
  }
  if (f.owner.length) p.set('owner', f.owner.join(','));
  if (f.status.length) p.set('status', f.status.join(','));
  if (f.tracker) p.set('tracker', f.tracker);
  if (f.item_type) p.set('item_type', f.item_type);
  if (f.severity_none) p.set('severity_none', '1');
  if (f.include_muted) p.set('include_muted', '1');
  if (f.only_open) p.set('only_open', '1');
  if (f.starred) p.set('starred', '1');
  if (f.q) p.set('q', f.q);
  if (f.days) p.set('days', f.days);
  if (f.likes_min) p.set('likes_min', f.likes_min);
  if (f.sort) p.set('sort', f.sort);
  // 口径跟着列表走：筛选器按当前口径算、列表按请求的口径算，会出现
  // "每个选项都点得动、点进去却是 0 条"—— 两个数都对，就是不是一套。
  if (S.version) p.set('version', S.version);
  if (!forFacets) {
    p.set('page', f.page);
    p.set('page_size', f.page_size);
  }
  return p;
}

async function api(method, path, body) {
  const opt = { method, headers: {} };
  if (body !== undefined) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(path, opt);
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch (e) { data = { raw: txt }; }
  if (!res.ok) {
    const err = new Error(data && data.error ? data.error : (method + ' ' + path + ' 失败'));
    err.status = res.status;   // 409 撞车和 400 校验不过，页面上要说两句不同的话
    err.data = data;
    throw err;
  }
  return data;
}

const get = (p) => api('GET', p);
const post = (p, b) => api('POST', p, b);

// ---------------------------------------------------------------- 小工具

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const $ = (sel) => document.querySelector(sel);

function toast(msg, bad) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), bad ? 4200 : 2000);
}

let _labels = null, _statusLabels = null, _sevRank = null;
function labels() {
  if (_labels) return _labels;
  _labels = {}; _statusLabels = {}; _sevRank = {};
  for (const ax of (S.meta.axes || [])) {
    _labels[ax.id] = {};
    (ax.values || []).forEach((v, i) => { _labels[ax.id][v.id] = v.label; });
    if (ax.id === 'severity') (ax.values || []).forEach((v, i) => { _sevRank[v.id] = i; });
  }
  for (const st of (S.meta.statuses || [])) _statusLabels[st.id] = st.label;
  return _labels;
}

const valLabel = (ax, id) => (labels()[ax] || {})[id] || id;
const axisLabel = (ax) => (S.meta.axes.find((a) => a.id === ax) || {}).label || ax;
const statusLabel = (id) => (!id ? '待评估' : (_statusLabels[id] || id));
// 追踪项的中文名也在服务端（读 config/trackers.json），页面不写死 —— 和轴名同一条规矩。
const trackerLabel = (id) => ((S.meta.trackers || []).find((t) => t.id === id) || {}).label || id;
const sevRank = (id) => (id in _sevRank ? _sevRank[id] : 99);

const CHIP_CLASS = { experience: 'exp', category: 'cat', sentiment: 'sen', persona: 'per' };
const SEV_CLASS = { 'sev.p0': 'p0', 'sev.p1': 'p1', 'sev.p2': 'p2' };

const DONE = ['st.fixed', 'st.wontfix'];
function stClass(id) {
  if (!id) return 'st-idle';
  if (id === 'st.wontfix') return 'st-wont';
  return DONE.includes(id) ? 'st-done' : 'st-open';
}

// ---------------------------------------------------------------- 路由
//
// **URL 就是筛选条件。** 这是「看 → 办」的技术前提（ADMIN-IA §四.2）：
// 看板上那句「P0 有 7 条」如果点不动，看的人只会记住 7，而不会去做那 7 件事。
//
// 四条规矩：
//
//  1. **只有一个入口。** 导航、URL、点数字全都走 `go(page, query)`。
//     每个入口各自拼一次筛选条件，迟早出现"某个入口忘了带"的错误。
//  2. **URL 是这一屏的写实，不是副本。** 屏幕上是什么筛选，URL 就写成什么；
//     反过来也一样。两边不一致时，转发出去的链接会把同事带去看另一批数，
//     而两边都觉得自己看到的是对的。
//  3. **写 URL 和读 URL 不许互相触发。** 自己写的那一次 hashchange 要认出来跳过，
//     否则就是"改筛选 → 写 URL → 读到变化 → 再改筛选"。
//  4. **写不出筛选条件的数字，不许做成可点。** 一个点进去筛不到东西的链接比不做更坏
//     （所以「覆盖体验域」是唯一一个 `to: null` 的格子，见 pipeline/dashboard.py）。
//
// 为什么用 hash 不用 pathname：后台是 http.server 递的静态文件，没有服务端路由。
// 用 pathname 就得加一条通配把 /insights 也映射到 index.html —— 为了 URL 好看一点去动
// 服务端，不值得。

// 逗号只在**多值字段**上拆。`q` 里出现逗号是正常搜索词（"海鲜,冷链"），
// 拆开就变成一个永远搜不到的数组。
const MULTI_KEYS = new Set([...AXIS_ORDER, 'owner', 'status', 'keyword', 'source']);
const truthy = (v) => v === true || ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

const allPageIds = () => PAGES.map((p) => p.id);

function parseHash() {
  const raw = String(location.hash || '').replace(/^#/, '');
  const at = raw.indexOf('?');
  const id = at < 0 ? raw : raw.slice(0, at);
  const query = {};
  new URLSearchParams(at < 0 ? '' : raw.slice(at + 1)).forEach((v, k) => {
    if (v === '') return;
    query[k] = MULTI_KEYS.has(k) && v.includes(',') ? v.split(',') : v;
  });
  return { id: allPageIds().includes(id) ? id : '', query };
}

function hashFor(page, query) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v == null || v === '' || v === false) continue;
    if (Array.isArray(v)) { if (v.length) p.set(k, v.join(',')); continue; }
    p.set(k, v === true ? '1' : String(v));
  }
  const qs = p.toString();
  return '#' + page + (qs ? '?' + qs : '');
}

// 这一页现在的筛选条件，序列化成 URL 上的形状。
// 空值一律不写：`?days=0` 和"没有天数"是两件事。
const CFG_EDIT_KINDS = ['taxonomy', 'trackers', 'keywords'];

function routeQuery(page) {
  const q = {};
  if (page === 'insights') {
    if (S.detail && S.detail.insight_id) q.open = S.detail.insight_id;
    for (const ax of AXIS_ORDER) if (S.f[ax].length) q[ax] = S.f[ax];
    if (S.f.owner.length) q.owner = S.f.owner;
    if (S.f.status.length) q.status = S.f.status;
    if (S.f.tracker) q.tracker = S.f.tracker;
    if (S.f.item_type) q.item_type = S.f.item_type;
    ['severity_none', 'include_muted', 'only_open', 'starred']
      .forEach((k) => { if (S.f[k]) q[k] = '1'; });
    if (S.f.q) q.q = S.f.q;
    if (S.f.days) q.days = S.f.days;
    if (S.f.likes_min) q.likes_min = S.f.likes_min;
    if (S.f.sort && S.f.sort !== 'time_desc') q.sort = S.f.sort;
    if (S.f.page > 1) q.page = S.f.page;
  } else if (page === 'board') {
    if (S.b.detail) q.open = themeId(S.b.detail);
    if (S.b.kind) q.kind = S.b.kind;
    if (S.b.owner) q.owner = S.b.owner;
    if (S.b.status.length) q.status = S.b.status;
    if (S.b.onlyFlagged) q.flagged = '1';
    if (!S.b.includeEmpty) q.empty = '0';
  } else if (page === 'trackers') {
    if (S.t.detail && S.t.detail.id) q.open = S.t.detail.id;
    if (S.t.other === '0') q.compare = '0';
    if (S.t.owner) q.owner = S.t.owner;
    if (S.t.status) q.status = S.t.status;
    if (S.t.direction) q.direction = S.t.direction;
    if (S.t.view) q.view = S.t.view;
    if (S.t.q) q.q = S.t.q;
    if (S.t.sort && S.t.sort !== 'alert') q.sort = S.t.sort;
  } else if (page === 'weekly') {
    if (S.w.days !== 7) q.days = S.w.days;
  } else if (page === 'config') {
    if (S.cfg.editKind) q.edit = S.cfg.editKind;   // 编辑器是配置中心的子路由
  }
  // 口径是全站的，写在任何一页的 URL 上都成立 —— 一屏数字按哪把尺子算的，
  // 必须能被转发出去，否则"上一版看着是 12 条"永远说不清。
  if (S.version) q.version = S.version;
  return q;
}

// URL → 页面状态。**URL 说什么就是什么，没写的一律回默认** ——
// 不许"上次留下的还在"，否则"清空筛选"和"URL 里什么都没有"会变成两种东西。
function applyRoute(route) {
  const q = route.query || {};
  // 口径只在 URL 明确写了才改：`to` 里的链接不带版本号，含义是"就用你现在这把尺子"。
  // 一改就换尺子的话，点一下数字就会把数字本身的意思换掉。
  if (q.version !== undefined) S.version = String(q.version);
  if (route.id === 'insights') {
    S.pendingOpen = q.open ? String(q.open) : '';
    S.f = blankFilters();
    for (const ax of AXIS_ORDER) if (q[ax]) S.f[ax] = [].concat(q[ax]);
    if (q.owner) S.f.owner = [].concat(q.owner);
    if (q.status) S.f.status = [].concat(q.status);
    S.f.tracker = q.tracker ? String(q.tracker) : '';
    if (q.item_type === 'post' || q.item_type === 'comment') S.f.item_type = q.item_type;
    ['severity_none', 'include_muted', 'only_open', 'starred']
      .forEach((k) => { S.f[k] = truthy(q[k]); });
    if (q.q) S.f.q = String(q.q);
    if (q.sort) S.f.sort = String(q.sort);
    S.f.days = parseInt(q.days, 10) || 0;
    S.f.likes_min = parseInt(q.likes_min, 10) || 0;
    S.f.page = Math.max(1, parseInt(q.page, 10) || 1);
    S.activeView = null;   // URL 里是展开后的条件，不是某个视图的 id
  } else if (route.id === 'board') {
    S.pendingOpen = q.open ? String(q.open) : '';
    S.b.kind = q.kind || '';
    S.b.owner = q.owner || '';
    // 多值：`?status=st.todo,st.backlog,st.scheduled` 是"这三条泳道一起看"。
    // 收成字符串的话 `c.lane !== status` 恒真，页面会一张卡都不显示 —— 而且不报错。
    S.b.status = q.status ? [].concat(q.status) : [];
    S.b.onlyFlagged = truthy(q.flagged);
    S.b.includeEmpty = q.empty === undefined ? true : truthy(q.empty);
  } else if (route.id === 'trackers') {
    S.pendingOpen = q.open ? String(q.open) : '';
    S.t.other = q.compare === '0' ? '0' : '';
    S.t.owner = q.owner || '';
    S.t.status = q.status || '';
    S.t.direction = q.direction || '';
    // 状态 chip 单选：alert / drift / unowned / ok。以前的「只看告警」是 alert=1，老链接照认。
    S.t.view = TRK_VIEWS.some((v) => v.id === q.view) ? q.view : (truthy(q.alert) ? 'alert' : '');
    S.t.q = q.q || '';
    S.t.sort = q.sort || 'alert';
  } else if (route.id === 'weekly') {
    const d = parseInt(q.days, 10);
    S.w.days = [7, 14, 28].includes(d) ? d : 7;   // 没实现的窗口不许"尽力而为"地算
  } else if (route.id === 'config') {
    // 认不出来的 edit= 当作没写：回配置中心本页，不渲染一个空编辑器。
    S.cfg.editKind = CFG_EDIT_KINDS.includes(q.edit) ? q.edit : null;
  }
}

let _echo = '';   // 自己刚写下去的那串 hash

function setHash(h) {
  if ((location.hash || '') === h) return;   // 相同就不写：写了会多一次没意义的 hashchange
  _echo = h;
  location.hash = h;
}

function syncHash(page) {
  const p = page || S.page;
  setHash(hashFor(p, routeQuery(p)));
}

function onHashChange() {
  const here = location.hash || '';
  if (here === _echo) { _echo = ''; return; }   // 自己刚写的那次，跳过
  _echo = '';
  const r = parseHash();
  if (!r.id) return;                            // 认不出来的 hash 不当成导航
  go(r.id, r.query);                            // 状态在 go() 里落（离开编辑器的拦截要跑在它之前）
}

window.addEventListener('hashchange', onHashChange);
// 关标签页 / 刷新：编辑器里有没保存的改动就拦一下（浏览器自己的那句话）。
window.addEventListener('beforeunload', (ev) => {
  if (S.cfg.edit && cfgEditDirty()) { ev.preventDefault(); ev.returnValue = ''; }
});

// 点一个数字：跳过去，并把"这个数对应哪批东西"一起带过去。
// `to` 里是语义（目标页面 + 筛选条件），URL 长什么样是这一层的事 ——
// 所以后端不需要知道前端用的是 hash 还是 pathname。
function goto(to) {
  if (!to || !to.page) return;
  const query = { ...to };
  delete query.page;
  return go(to.page, query);
}

// ---------------------------------------------------------------- 启动

async function boot() {
  try {
    const [meta, summary, views, ns, health] = await Promise.all([
      get('/api/meta'), get('/api/summary'), get('/api/views'),
      get('/api/north-star?weeks=8'), get('/api/health'),
    ]);
    S.meta = meta; S.summary = summary; S.views = views.views || []; S.northStar = ns;
    // 操作人默认跟服务端对齐，用户改过就以用户的为准（存在 localStorage 里）
    if (!localStorage.getItem('dd_actor') && health.actor && health.actor !== 'api') {
      S.actor = health.actor;
    }
    S.canWrite = health.role !== 'read';
    // 角色原样存下来。**不能只留一个布尔**：`canWrite` 回答的是"能不能改状态"，
    // 而回滚要问的是"是不是管理员"—— owner 和 admin 都能改状态，但只有 admin 能删数据。
    // 用布尔代替角色，结果就是 owner 看到一个点下去必然 403 的删除按钮。
    S.role = health.role || 'owner';
    labels();
    renderNav();
    $('#verLine').textContent = '后台 v0.1';
    renderTopbar();
    const ckBtn = $('#cmdkBtn');
    if (ckBtn) ckBtn.addEventListener('click', cmdkOpen);
    await loadWbBadge();
    // 落在哪一页由 URL 决定 —— 链接能直接发给别人，刷新也停在原地。
    // 什么都没写时落工作台：这个后台存在的意义是"今天该我做什么"，
    // 不是"池子里有多少条数据"。默认打开哪一页，等于告诉人哪一页最重要。
    const route = parseHash();
    if (route.id) applyRoute(route);
    await go(route.id || 'workbench');
  } catch (e) {
    // 不写死地址：局域网里的同事照着 127.0.0.1 打开的是自己的电脑。
    // 网页打开时本页地址就是后台地址，服务起来刷新即可；双击 HTML 打开时没有地址可给。
    const served = /^https?:$/.test(location.protocol || '');
    $('#main').innerHTML = '<div class="empty"><b>后台连不上接口</b>' + esc(e.message) +
      '<div class="note" style="max-width:560px;margin:14px auto 0;text-align:left">' +
      (served
        ? '后台服务可能没有启动，请联系管理员。服务启动后刷新本页。'
        : '直接双击 HTML 文件取不到数据。请在浏览器里打开后台地址，地址可以找管理员要。') +
      '</div></div>';
  }
}

// ---------------------------------------------------------------- 顶栏
//
// 全站只有这一处口径开关、这一处操作人（ADMIN-IA §一.3）。以前 weekly / trackers 各有一个
// 口径下拉，四页各有一个操作人输入框 —— 都在改同一个 S.version / S.actor，
// 于是"在洞察池里看到的数按哪把尺子算的"这个问题，在洞察池里没法回答。

function fmtAgo(h) {
  if (h == null) return '';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} 分钟前`;
  if (h < 48) return `${Math.round(h)} 小时前`;
  return `${Math.round(h / 24)} 天前`;
}

// bell：把散在导航角标上的几类信号排成一张跳转列表。不是收件箱 —— 没有"未读"、没有历史，
// 就是"现在有哪几件事等着人"的一眼汇总；每一条点过去都带筛选条件。
// 数据全部来自 loadWbBadge 已经拉回来的那几份 summary，不多打一次接口。
function tbBellItems() {
  const out = [];
  const wb = S.wbBadge || {};
  const ob = S.opsBadge || {};
  const cb = S.cfgBadge || {};
  const ab = S.arcBadge || {};
  if (wb.unclaimed_p0) out.push({ lv: 'bad', label: `${wb.unclaimed_p0} 条 P0 没人认领`, hint: '洞察池 · 阻断级且没负责人',
    run: () => { S.f = blankFilters(); S.f.severity = ['sev.p0']; S.f.owner = ['__none__']; S.f.only_open = true; return go('insights'); } });
  if (wb.mine_untriaged) out.push({ lv: 'warn', label: `${wb.mine_untriaged} 条在我名下还没判`, hint: '洞察池 · 等我分诊',
    run: () => { S.f = blankFilters(); S.f.owner = [S.actor]; S.f.status = ['__none__', 'st.todo']; return go('insights'); } });
  const blind = (S.b.data && S.b.data.totals && S.b.data.totals.blind_p0) || 0;
  if (blind) out.push({ lv: 'bad', label: `${blind} 个主题有 P0 却没人看过`, hint: '跟进看板 · 只看有异常的',
    run: () => { S.b.onlyFlagged = true; return go('board'); } });
  if (ob.job_running) out.push({ lv: 'run', label: '有作业在跑', hint: '数据管道 · 作业执行区',
    run: () => go('pipeline') });
  if (ob.job_failed) out.push({ lv: 'bad', label: `${ob.job_failed} 个作业没跑成`, hint: '数据管道 · 作业执行区',
    run: () => go('pipeline') });
  if (ob.bad_checks || ob.warn_checks) out.push({ lv: ob.bad_checks ? 'bad' : 'warn',
    label: `自检 ${ob.bad_checks ? `${ob.bad_checks} 项红` : ''}${ob.bad_checks && ob.warn_checks ? '、' : ''}${ob.warn_checks ? `${ob.warn_checks} 项黄` : ''}`,
    hint: ob.headline && ob.headline.text ? ob.headline.text : '数据管道 · 健康自检', run: () => go('pipeline') });
  if (cb.warning_count) out.push({ lv: 'warn', label: `分类体系有 ${cb.warning_count} 处漂移`, hint: '配置中心 · 状态卡',
    run: () => go('config') });
  if (ab.level && ab.level !== 'ok') out.push({ lv: 'warn', label: '归档有异常', hint: '归档 · 产物指向库里没有的周，或口径快照没登记',
    run: () => go('archive') });
  return out;
}

function tbBellToggle(force) {
  const pop = $('#tbBellPop');
  const bell = $('#tbBell');
  if (!pop) return;
  const open = force === undefined ? !!pop.hidden : !!force;
  if (!open) { pop.hidden = true; pop.innerHTML = ''; if (bell) bell.classList.remove('on'); return; }
  const items = tbBellItems();
  pop.innerHTML = `<div class="tb-pop-h">需要处理的信号 <span>${items.length ? `${items.length} 条` : ''}</span></div>` + (items.length
    ? items.map((it, i) => `<button type="button" class="tb-pop-row ${esc(it.lv)}" data-bell="${i}">
        <i class="d"></i><span class="l">${esc(it.label)}</span><span class="h">${esc(it.hint)}</span></button>`).join('')
    : '<div class="tb-pop-empty">现在没有等着人的事。</div>');
  pop.hidden = false;
  if (bell) bell.classList.add('on');
  pop.querySelectorAll('[data-bell]').forEach((b) => b.addEventListener('click', async () => {
    tbBellToggle(false);
    try { await items[+b.dataset.bell].run(); } catch (e) { toast(e.message, true); }
  }));
}

// 点外面 / Esc 收起
document.addEventListener('click', (e) => {
  const pop = $('#tbBellPop');
  if (pop && !pop.hidden && e.target && e.target.closest && !e.target.closest('.tb-bell-wrap')) tbBellToggle(false);
});

function renderTopbar() {
  const el = $('#topbar');
  if (!el) return;
  // meta.versions 是后来加的字段；接口还是旧进程时它是空的 —— 这时至少把当前口径摆出来，
  // 一个空的下拉比没有下拉更糟（看起来像坏了）。
  let vers = (S.meta && S.meta.versions) || [];
  if (!vers.length && S.meta && S.meta.taxonomy_version) {
    vers = [{ version: String(S.meta.taxonomy_version), is_active: true, is_config: true }];
  }
  const active = vers.find((v) => v.is_active) || null;
  const cur = S.version || (active ? active.version : '');
  // 历史口径：整站描琥珀边。历史口径下的数长得和现在的数一模一样，不标就一定会被当成现在的。
  const hist = !!(active && cur && cur !== active.version);

  const opts = vers.map((v) =>
    `<option value="${esc(v.version)}" ${cur === v.version ? 'selected' : ''}>v${esc(v.version)}${esc(verSuffix(v))}</option>`);
  // URL 里带了一个清单里没有的版本号：照样显示出来，让人看见自己在看什么，而不是静默回落。
  if (cur && !vers.some((v) => v.version === cur)) opts.push(`<option value="${esc(cur)}" selected>v${esc(cur)}</option>`);

  // 新鲜度：绿 / 黄（>24h）/ 红（>48h，和工作台"采集可能停了"同一个阈值）。数据来自导航角标那次请求。
  const ob = S.opsBadge || {};
  const h = ob.stale_hours;
  let lv = 'na'; let txt = '还没采集过';
  if (h != null) { lv = h > 48 ? 'bad' : h > 24 ? 'warn' : 'ok'; txt = `采集 ${fmtAgo(h)}`; }
  const freshTitle = ob.latest_at ? `最近一次新内容：${ob.latest_at}（阈值 48 小时）· 点击去数据管道` : '库里还没有内容 · 点击去数据管道';

  el.className = 'topbar' + (hist ? ' hist' : '');
  el.innerHTML = `
    <label class="chk" title="全站口径：这一屏的数按哪个分类版本计算，切换后整站生效">口径
      <select id="tbVer">${opts.join('')}</select></label>
    ${hist ? `<span class="tb-hist" title="历史口径下同一个主题的条数可能和现在不同，差值来自分类改版，和产品表现无关。切回 v${esc(active.version)} 看现在的数。">你在看历史口径 v${esc(cur)} · 当前 v${esc(active.version)}</span>` : ''}
    <a class="tb-fresh ${lv}" id="tbFresh" title="${esc(freshTitle)}"><i class="dot"></i>${esc(txt)}</a>
    ${(S.cfgBadge || {}).warning_count ? `<a class="tb-fresh warn" id="tbDrift" title="配置和库里登记的口径对不上 · 点击去配置中心"><i class="dot"></i>口径有 ${S.cfgBadge.warning_count} 处不一致</a>` : ''}
    <span class="sp"></span>
    <span class="tb-bell-wrap">
      <button type="button" class="tb-bell${tbBellItems().length ? ' has' : ''}" id="tbBell" aria-label="需要处理的信号" title="需要处理的信号">
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.2a3.6 3.6 0 0 0-3.6 3.6v2.4L3 10.6h10l-1.4-2.4V5.8A3.6 3.6 0 0 0 8 2.2z"/><path d="M6.6 12.6a1.5 1.5 0 0 0 2.8 0"/></svg><i class="dot"></i></button>
      <div class="tb-pop" id="tbBellPop" hidden></div>
    </span>
    <label class="chk" title="以谁的身份看和写：决定工作台「我名下」的内容，写操作记在这个名字下">操作人
      <input type="text" id="tbActor" list="tbOwners" value="${esc(S.actor)}" style="width:82px" maxlength="16">
      <datalist id="tbOwners">${[...new Set([...((S.meta && S.meta.owners) || []), S.actor].filter(Boolean))]
        .map((o) => `<option value="${esc(o)}">`).join('')}</datalist></label>`;

  const sel = $('#tbVer');
  if (sel) sel.addEventListener('change', async (e) => {
    S.version = e.target.value;
    // 换口径 = 整屏重取（不是筛选一下当前这一屏）。切换期间禁用，
    // 否则连点两下会先后请求互相覆盖 —— 工作台换操作人那里踩过一次。
    e.target.disabled = true;
    try { await go(S.page); } finally { renderTopbar(); }
  });
  const fr = $('#tbFresh');
  if (fr) fr.addEventListener('click', () => go('pipeline'));
  const dr = $('#tbDrift');
  if (dr) dr.addEventListener('click', () => go('config'));
  const bell = $('#tbBell');
  if (bell) bell.addEventListener('click', (e) => { e.stopPropagation(); tbBellToggle(); });
  const ac = $('#tbActor');
  if (ac) ac.addEventListener('change', (e) => {
    S.actor = e.target.value.trim() || '我';
    localStorage.setItem('dd_actor', S.actor);
    loadWbBadge();
    // 只有工作台的内容跟着操作人变（「我名下」那一块）；别的页面记的是写操作的名字，不用重取。
    if (S.page === 'workbench') loadWorkbench();
  });
}

// ---------------------------------------------------------------- ⌘K 命令面板
//
// 全局动作层。以前没有：换页要去侧栏点、切口径要去顶栏找、找一条条目要先进洞察池再筛。
// 一个 <dialog> + 子串匹配，零依赖。同步候选（跳页 / 切口径 / 切操作人 / 追踪项 / 常用动作）
// 立刻出；条目 / 主题要打接口，输够两个字再搜，结果追加在后面。
// 键盘：⌘K / Ctrl+K 开，↑↓ 选，Enter 跑，Esc 关。

const K = { open: false, q: '', items: [], at: 0, seq: 0 };

// 子串匹配打分：整串命中 > 开头命中 > 各关键词命中。中文没有分词，子串就是最贴近人输入的方式。
function cmdkScore(q, hay) {
  if (!q) return 1;
  const h = hay.toLowerCase();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const t of terms) {
    const i = h.indexOf(t);
    if (i < 0) return 0;
    score += i === 0 ? 3 : 2;
  }
  return score;
}

// 同步候选。每一项：{group, label, hint, keys, run}
function cmdkCandidates(q) {
  const out = [];
  const push = (c) => { const sc = cmdkScore(q, [c.label, c.hint || '', c.keys || ''].join(' ')); if (sc) out.push({ ...c, sc }); };

  PAGES.forEach((p) => push({
    group: '跳页', label: `去 ${p.name}`, hint: '', keys: `${p.id} page 页面 跳 go`,
    run: () => go(p.id),
  }));

  const vers = (S.meta && S.meta.versions) || [];
  const active = vers.find((v) => v.is_active);
  vers.forEach((v) => push({
    group: '切口径', label: `口径 → v${v.version}${v.is_active ? '（在跑）' : ''}`,
    hint: S.version === v.version || (!S.version && v.is_active) ? '当前' : (v.is_active ? '切回现在的数' : '按历史口径回看'),
    keys: 'version 版本 口径',
    run: async () => { S.version = v.version; await go(S.page); renderTopbar(); },
  }));

  const owners = [...new Set([...((S.meta && S.meta.owners) || []), S.actor].filter(Boolean))];
  owners.forEach((o) => push({
    group: '切操作人', label: `操作人 → ${o}`, hint: o === S.actor ? '当前' : '', keys: 'actor 身份 操作人 我',
    run: () => cmdkSetActor(o),
  }));
  // 输入了一个不在候选里的名字：也允许直接切成它（操作人本来就是自由文本）
  const m = q.match(/(?:操作人|actor)\s*[:：>→]?\s*(\S+)$/i);
  if (m && !owners.includes(m[1])) out.push({ group: '切操作人', label: `操作人 → ${m[1]}`, hint: '新名字', sc: 5, run: () => cmdkSetActor(m[1]) });

  ((S.meta && S.meta.trackers) || []).forEach((t) => push({
    group: '追踪项', label: t.label, hint: t.owner ? `负责人 ${t.owner}` : '', keys: `${t.id} 追踪项 tracker 镜头 ${t.desc || ''}`,
    run: async () => { await go('trackers'); openTracker(t.id, true); },
  }));

  [
    { label: '看 P0 未认领', hint: '洞察池 · 阻断级且没负责人', keys: 'p0 未认领 认领 claim',
      run: () => { S.f = blankFilters(); S.f.severity = ['sev.p0']; S.f.owner = ['__none__']; S.f.only_open = true; return go('insights'); } },
    { label: '看我名下待分诊', hint: '洞察池 · 分给我、还没判的', keys: '我 名下 分诊 mine',
      run: () => { S.f = blankFilters(); S.f.owner = [S.actor]; S.f.status = ['__none__', 'st.todo']; return go('insights'); } },
    { label: '看有异常的主题', hint: '跟进看板 · 只看有信号的卡', keys: '异常 主题 看板 flag',
      run: () => { S.b.onlyFlagged = true; return go('board'); } },
    { label: '去跑一次作业', hint: '数据管道 · 作业执行区', keys: '作业 采集 跑 job crawl ingest weekly',
      run: async () => { await go('pipeline'); const t = document.getElementById('opsJobs'); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); } },
    { label: '看告警中的追踪项', hint: '追踪中心 · 只看在告警的线', keys: '告警 alert 追踪',
      run: () => { S.t.view = 'alert'; return go('trackers'); } },
  ].forEach((c) => push({ group: '常用动作', ...c }));

  out.sort((a, b) => b.sc - a.sc);
  return out;
}

function cmdkSetActor(o) {
  S.actor = o;
  localStorage.setItem('dd_actor', o);
  renderTopbar();
  loadWbBadge();
  if (S.page === 'workbench') loadWorkbench();
  toast('操作人已切为 ' + o);
}

function cmdkOpen() {
  const dlg = $('#cmdk');
  if (!dlg) return;
  K.open = true; K.q = ''; K.at = 0;
  K.items = cmdkCandidates('');
  cmdkRender();
  if (dlg.showModal && !dlg.open) dlg.showModal();
  const inp = $('#cmdkQ');
  if (inp && inp.focus) inp.focus();
}

function cmdkClose() {
  const dlg = $('#cmdk');
  K.open = false;
  if (dlg && dlg.close && dlg.open) dlg.close();
  if (dlg) dlg.innerHTML = '';
}

function cmdkRender() {
  const dlg = $('#cmdk');
  if (!dlg) return;
  const groups = [];
  K.items.forEach((it, i) => {
    let g = groups.find((x) => x.name === it.group);
    if (!g) { g = { name: it.group, rows: [] }; groups.push(g); }
    g.rows.push({ ...it, i });
  });
  const list = groups.length ? groups.map((g) => `
    <div class="ck-g">${esc(g.name)}</div>
    ${g.rows.map((r) => `<div class="ck-row ${r.i === K.at ? 'on' : ''}" data-ck="${r.i}">
      <span class="ck-l">${esc(r.label)}</span>${r.hint ? `<span class="ck-h">${esc(r.hint)}</span>` : ''}
    </div>`).join('')}`).join('')
    : `<div class="ck-empty">${K.q.length >= 2 ? '没有匹配的。条目 / 主题要输够两个字才搜。' : '输两个字搜条目或主题；也可以直接输"看板""口径""操作人 张三"'}</div>`;
  // 只在首次渲染写输入框，之后只换列表 —— 每次重写输入框会把光标和已输入的字一起冲掉。
  if (!$('#cmdkQ') || !dlg.innerHTML) {
    dlg.innerHTML = `
      <div class="ck-head">${iconSvg('search')}
        <input type="text" id="cmdkQ" placeholder="跳页 · 搜条目 / 主题 · 切口径 · 切操作人" autocomplete="off" spellcheck="false">
        <kbd>Esc</kbd></div>
      <div class="ck-list" id="cmdkList">${list}</div>
      <div class="ck-foot"><kbd>↑</kbd><kbd>↓</kbd> 选 · <kbd>Enter</kbd> 执行 · 条目 / 主题输两个字起搜</div>`;
    const inp = $('#cmdkQ');
    if (inp) {
      inp.addEventListener('input', () => cmdkQuery(inp.value));
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); K.at = Math.min(K.items.length - 1, K.at + 1); cmdkRender(); cmdkScrollTo(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); K.at = Math.max(0, K.at - 1); cmdkRender(); cmdkScrollTo(); }
        else if (e.key === 'Enter') { e.preventDefault(); cmdkRun(K.at); }
        else if (e.key === 'Escape') { e.preventDefault(); cmdkClose(); }
      });
    }
  } else {
    const l = $('#cmdkList');
    if (l) l.innerHTML = list;
  }
  dlg.querySelectorAll('[data-ck]').forEach((r) => {
    r.addEventListener('click', () => cmdkRun(+r.dataset.ck));
    r.addEventListener('mousemove', () => { const i = +r.dataset.ck; if (K.at !== i) { K.at = i; cmdkRender(); } });
  });
}

function cmdkScrollTo() {
  const el = document.querySelector('#cmdk .ck-row.on');
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

let _ckTimer = null;
function cmdkQuery(q) {
  K.q = q; K.at = 0;
  K.items = cmdkCandidates(q);
  cmdkRender();
  clearTimeout(_ckTimer);
  if (q.trim().length < 2) return;
  const seq = ++K.seq;
  _ckTimer = setTimeout(() => cmdkSearchRemote(q.trim(), seq), 220);
}

// 条目走 /api/insights?q=，主题走 /api/board（一次拿全，之后在本地筛）。慢请求盖掉快请求：按 seq 丢弃。
let _ckBoard = null;
async function cmdkSearchRemote(q, seq) {
  try {
    const jobs = [get('/api/insights?q=' + encodeURIComponent(q) + '&page_size=6')];
    if (!_ckBoard) jobs.push(get('/api/board?include_empty=1')); else jobs.push(Promise.resolve(_ckBoard));
    const [ins, board] = await Promise.all(jobs);
    if (seq !== K.seq || !K.open) return;
    _ckBoard = board;
    const extra = [];
    ((ins && ins.items) || []).forEach((it) => extra.push({
      group: '条目', label: (it.title || it.text || '').slice(0, 60),
      hint: `${it.item_type === 'post' ? '笔记' : '评论'} · ${it.owner || '未认领'} · ${it.status || ''}`,
      run: async () => { await go('insights'); openDetail(it.insight_id, true); },
    }));
    const ql = q.toLowerCase();
    ((board && board.lanes) || []).forEach((ln) => (ln.cards || []).forEach((c) => {
      if (String(c.name || '').toLowerCase().includes(ql)) extra.push({
        group: '主题', label: c.name, hint: `${c.kind_label || ''} · ${ln.label}`,
        run: async () => { await go('board'); openCard(themeId(c), true); },
      });
    }));
    K.items = K.items.concat(extra);
    cmdkRender();
  } catch (e) { /* 面板里的搜索失败不打断主流程 */ }
}

async function cmdkRun(i) {
  const it = K.items[i];
  if (!it) return;
  cmdkClose();
  try { await it.run(); } catch (e) { toast(e.message, true); }
}

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    if (K.open) cmdkClose(); else cmdkOpen();
  }
});
// <dialog> 自己的 Esc 会关掉它，但不会走 cmdkClose；补上，免得 K.open 还挂着 true。
const _ckDlg = document.getElementById('cmdk');
if (_ckDlg && _ckDlg.addEventListener) {
  _ckDlg.addEventListener('close', () => { K.open = false; _ckDlg.innerHTML = ''; });
  _ckDlg.addEventListener('click', (e) => { if (e.target === _ckDlg) cmdkClose(); });   // 点遮罩关
}

// ---------------------------------------------------------------- 导航

function renderNav() {
  const blind = (S.b.data && S.b.data.totals.blind_p0) || 0;
  const wb = wbUrgent();
  $('#nav').innerHTML = PAGES.map((it) => {
    const cls = ['navitem'];
    if (it.id === S.page) cls.push('on');
    let pill = '';
    // 「P0 没人认领」是工作台那一句话结论的核心数字，角标就挂在这个落地页上。
    // 洞察池自己在 KPI 第一排写着同一个数，导航上不再挂第二遍。
    if (it.id === 'workbench' && wb.p0) pill = `<span class="pill">P0 ${wb.p0}</span>`;
    else if (it.id === 'workbench' && wb.mine) pill = `<span class="pill">待办 ${wb.mine}</span>`;
    // 看板上的角标只报「有 P0 却连状态都没登记过」—— 那是这块板上最该被点开的一批。
    if (it.id === 'board' && blind) pill = `<span class="pill">? ${blind}</span>`;
    // 数据管道的角标只报两件事：有作业在跑、有作业没跑成。
    // 它不重复报自检的警告 —— 那些在这一页的标题上已经写了一整句，角标再挂一个数字
    // 只会变成"每次打开都亮着、于是没人再看"的那类角标。
    // ⚠️ 页面的 id 是 `pipeline` 不是 `ops`（接口叫 /api/ops，页面叫数据管道）。
    // 这里写成 'ops' 会静静地永远不亮 —— 而"角标不亮"看上去和"没有作业在跑"一模一样。
    if (it.id === 'pipeline') {
      const ob = S.opsBadge || {};
      if (ob.job_running) pill = '<span class="pill run">跑中</span>';
      else if (ob.job_failed) pill = `<span class="pill">! ${ob.job_failed}</span>`;
    }
    // 配置中心的角标只报**漂移告警**（未登记 / 内容改了没升版本号 / 数据口径落后），
    // 不报"配置有改动"—— 改配置是正常动作，改了没登记才是问题。
    // 两者混成一个数字，人就会对这个角标脱敏。
    if (it.id === 'config') {
      const cb = S.cfgBadge || {};
      if (cb.warning_count) pill = `<span class="pill">! ${cb.warning_count}</span>`;
    }
    // 归档的角标只报**真出事**的那两种：产物指向一个库里没有的周、或者口径快照没登记过。
    // 「N 周没留档」**不挂角标** —— 那个数会随时间自然累积（组织里不会每周都出报表），
    // 挂上去等于让一个常态数字永远亮着，而亮着的东西很快就没人看了。
    if (it.id === 'archive') {
      const ab = S.arcBadge || {};
      if (ab.level && ab.level !== 'ok') pill = '<span class="pill">!</span>';
    }
    // 角标的文字也进 aria-label：收成图标轨时角标退化成一个点，读屏只剩这一句。
    const pillText = pill.replace(/<[^>]+>/g, '').trim();
    const aria = esc(it.name + (pillText ? ' · ' + pillText : ''));
    // 真链接：中键、⌘ / Ctrl + 点、右键「在新标签页打开」都照浏览器的规矩走。
    return `<a class="${cls.join(' ')}" href="#${it.id}" data-page="${it.id}"
      aria-label="${aria}" title="${esc(it.name)}"${it.id === S.page ? ' aria-current="page"' : ''}>
      ${iconSvg(it.icon)}<span class="nm">${esc(it.name)}</span>${pill}</a>`;
  }).join('');

  // 普通左键仍走 go()：它带着这一页的筛选状态，也会先拦「编辑器里有没保存的改动」。
  $('#nav').querySelectorAll('.navitem').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      go(el.dataset.page);
    });
  });
}

async function go(page, query) {
  // 正在编辑配置且有未保存的改动：去别处（换页、回配置中心、换另一个编辑器）先问一句。
  // 不问的话，改了二十条 hints 一个误点就全没了 —— 而 URL 已经变了，还得把它写回来。
  const ed = S.cfg.edit;
  if (ed && cfgEditDirty()) {
    const staying = page === 'config' && (query === undefined ? S.cfg.editKind === ed.kind : query.edit === ed.kind);
    if (!staying && !cfgEditMayLeave()) { syncHash(S.page); return; }
    if (!staying) { S.cfg.edit = null; }
  }
  S.page = page;
  // 带 query 进来的（点数字、贴链接）先落状态；不带就沿用这一页本来的筛选 ——
  // 从导航切回来时把人家刚筛好的条件清掉，是那种"每次都要重新筛一遍"的烦人。
  if (query !== undefined) applyRoute({ id: page, query });
  S.detail = null;
  S.b.detail = null;
  S.t.detail = null;
  // 离开洞察池 = 放弃这批勾选。留着它，回来时会看到一个
  // 谁也想不起来是什么时候选上的"已选 12 条"。
  if (page !== 'insights') { S.sel.clear(); S.bulkFail = []; S.selKey = null; }
  renderNav();
  renderTopbar();
  closeDrawer();
  // 屏幕变了 URL 就得跟着变，否则转发出去的是别人那一屏。
  syncHash(page);
  if (page === 'workbench') return renderWorkbenchPage();
  if (page === 'weekly') return renderWeeklyPage();
  if (page === 'trackers') return renderTrackersPage();
  if (page === 'insights') return renderInsightsPage();
  if (page === 'board') return renderBoardPage();
  if (page === 'pipeline') return renderOpsPage();
  if (page === 'config') return renderConfigPage();
  if (page === 'archive') return renderArchivePage();
  return renderSoonPage(page);
}

// ---------------------------------------------------------------- 页面 4：洞察池

// 筛选在顶部（用户拍板：侧边 rail 体验不好）：镜头 → 保存的视图 → 常驻轴 → 更多 / 开关 / 搜索 / 重置 / 存为视图。
// 详情在右边一栏（Dock），列表结构在 Dock 打开前后**完全一致**——7 列表格不变，所以并排只在 ≥1600px
// 才做（放得下），更窄走覆盖式。
async function renderInsightsPage() {
  $('#main').innerHTML = `
    <div class="head">
      <div>
        <h1>洞察池</h1>
        <div class="sub" id="lede">正在加载…</div>
      </div>
      <div class="rt" id="headrt"></div>
    </div>
    <div class="filters" id="filters">
      <div class="fbar" id="fbar"></div>
      <div class="factive" id="factive"></div>
    </div>
    <div class="selbar" id="selbar"></div>
    <div class="card" id="list"><div class="empty">正在加载…</div></div>
    <div id="pager"></div>`;

  renderFiltersShell();
  // 有上一屏的数据就先画出来，别让人每次切回来都看一眼「正在加载」；下面照常重取。
  if (S.data) { renderList(); renderPager(); }
  await loadInsights();
}

const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const isBlank = (f) => !AXIS_ORDER.some((a) => f[a].length) && !f.owner.length && !f.status.length
  && !f.q && !f.only_open && !f.starred && !f.severity_none && !f.include_muted
  && !f.days && !f.likes_min && !f.item_type && !f.tracker;

// ---------------------------------------------------------------- 筛选：一行 + 列头菜单 + 生效条件行
//
// 规矩一句话：**有列的条件放列头，没列的放上面。** 上方一行是 搜索 · 视图 · 追踪项 · 体验域 · 品类线 · 情绪 · 人群场景 · 含已静音 · 只看星标；
// 类型 / 时间 / 负责人 / 状态 / 赞 / 严重度 在各自的列头点 ▾（时间 / 赞 / 严重度还能排序）。
// 不管在哪设的条件，都统一列在第二行（#factive），每条能 ×。默认的「只看未闭环」不算条件。
//
// 所有菜单同一套稳定性规则：项按分类体系 / 配置文件顺序固定，永远不按计数重排；计数来自 facets
// （已是"摘掉本轴自身条件"的算法）；后端只返回计数 > 0 的值，前端把没出现的当 0 —— **留在原位灰掉**，仍可点。

const SEARCH_ICON = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const NONE = '__none__';

function facetCounts(kind) {
  const f = S.facets || {};
  const out = {};
  if (kind === 'owners') (f.owners || []).forEach((c) => { out[c.value == null || c.value === '' ? NONE : c.value] = c.count; });
  else if (kind === 'statuses') (f.statuses || []).forEach((c) => { out[c.value] = c.count; });
  else if (kind === 'trackers') (f.trackers || []).forEach((c) => { out[c.value] = c.count; });
  else if (kind === 'item_types') (f.item_types || []).forEach((c) => { out[c.value] = c.count; });
  else ((f.axes || {})[kind] || []).forEach((c) => { out[c.value] = c.count; });
  return out;
}

// 改了条件之后的统一出口：视图失效、回第一页、重取（loadInsights 会同步 URL、刷新计数和条件行）。
function fSet(fn) {
  fn(S.f);
  S.activeView = null;
  applyFilters();
}
const toggleIn = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };

// 一个标签轴的多选 spec：固定顺序 + 计数 + 0 灰掉。
function axisSpec(ax) {
  const spec = (S.meta.axes || []).find((a) => a.id === ax) || { values: [] };
  return {
    title: spec.label, multi: true,
    items: () => {
      const cnt = facetCounts(ax);
      const items = (spec.values || []).map((v) => ({ value: v.id, label: v.label, on: S.f[ax].includes(v.id), count: cnt[v.id] || 0,
        sw: ax === 'severity' ? (SEV_CLASS[v.id] || 'p2') : '' }));
      if (ax === 'severity') items.push({ value: NONE, label: '未识别', on: S.f.severity_none, count: cnt[NONE] || 0, sw: 'none' });
      return items;
    },
    pick: (v) => fSet((f) => { if (v === NONE) f.severity_none = !f.severity_none; else toggleIn(f[ax], v); }),
  };
}

function fMenuSpec(key) {
  const f = S.f;
  if (key === 'view') {
    return {
      title: '保存的视图',
      items: () => (S.views || []).map((v) => ({ value: v.view_id, label: v.name, on: S.activeView === v.view_id }))
        .concat([{ sep: true }, { value: '', label: '不用视图', on: !S.activeView }]),
      pick: (v) => { if (v) applyView(v); else fSet((x) => { Object.assign(x, blankFilters()); }); },
    };
  }
  if (key === 'trk') {
    // 追踪项单选：它是"用哪个镜头看"，选两个是并集，而并集不是一个追踪项。
    return {
      title: '追踪项',
      items: () => {
        const cnt = facetCounts('trackers');
        return (S.meta.trackers || []).map((t) => ({ value: t.id, label: t.label, on: f.tracker === t.id, count: cnt[t.id] || 0 }))
          .concat([{ sep: true }, { value: '', label: '不按追踪项', on: !f.tracker }]);
      },
      pick: (v) => fSet((x) => { x.tracker = v; }),
    };
  }
  if (key === 'exp') return axisSpec('experience');
  if (key === 'cat') return axisSpec('category');
  if (key === 'sen') return axisSpec('sentiment');
  if (key === 'per') return axisSpec('persona');
  if (key === 'sev') {
    const base = axisSpec('severity');
    return {
      title: '严重度', multi: true,
      items: () => base.items().concat([{ sep: true }, { head: '排序' }, { value: 's:sev', label: '最严重在前', on: f.sort === 'sev', sw: '' }]),
      pick: (v) => { if (v === 's:sev') fSet((x) => { x.sort = 'sev'; }); else base.pick(v); },
    };
  }
  if (key === 'type') {
    return {
      title: '类型',
      items: () => { const c = facetCounts('item_types'); const all = (c.post || 0) + (c.comment || 0);
        return [{ value: '', label: '全部', on: !f.item_type, count: S.facets ? all : undefined },
                { value: 'post', label: '笔记', on: f.item_type === 'post', count: S.facets ? (c.post || 0) : undefined },
                { value: 'comment', label: '评论', on: f.item_type === 'comment', count: S.facets ? (c.comment || 0) : undefined }]; },
      pick: (v) => fSet((x) => { x.item_type = v; }),
    };
  }
  if (key === 'time') {
    return {
      items: () => [{ head: '排序' },
        { value: 's:time_desc', label: '最新在前', on: f.sort === 'time_desc' }, { value: 's:time_asc', label: '最早在前', on: f.sort === 'time_asc' },
        { sep: true }, { head: '范围' },
        ...[[0, '全部'], [7, '最近 7 天'], [14, '最近 14 天'], [28, '最近 28 天']].map(([d, l]) => ({ value: 'd:' + d, label: l, on: f.days === d }))],
      pick: (v) => fSet((x) => { if (v.startsWith('s:')) x.sort = v.slice(2); else x.days = +v.slice(2); }),
    };
  }
  if (key === 'owner') {
    return {
      title: '负责人', multi: true, search: true,
      items: () => {
        const cnt = facetCounts('owners');
        const names = [...new Set([S.actor, ...(S.meta.owners || []), ...Object.keys(cnt).filter((k) => k !== NONE)].filter(Boolean))];
        return [{ value: NONE, label: '未认领', on: f.owner.includes(NONE), count: cnt[NONE] || 0 }]
          .concat(names.map((o) => ({ value: o, label: o === S.actor ? `${o}（我）` : o, on: f.owner.includes(o), count: cnt[o] || 0 })));
      },
      pick: (v) => fSet((x) => toggleIn(x.owner, v)),
    };
  }
  if (key === 'st') {
    // 三态：全部（默认）= 两者都空；未闭环 = only_open 且不选具体状态；具体状态 = status[] 且 only_open 关。
    // 默认是全部而不是未闭环：URL 说什么就是什么，空 URL = 没筛，这个契约不动。
    return {
      title: '状态', multi: true,
      items: () => {
        const cnt = facetCounts('statuses');
        const total = S.data ? S.data.total : 0;
        const noState = Math.max(0, total - Object.values(cnt).reduce((a, n) => a + n, 0));
        const mode = f.status.length ? 'sel' : (f.only_open ? 'open' : 'all');
        return [{ value: 'm:all', label: '全部（默认）', on: mode === 'all' }, { value: 'm:open', label: '未闭环', on: mode === 'open', hint: '待评估 / 已建需求 / 排期中 / 还没建状态' },
          { sep: true }, { head: '具体状态' },
          { value: NONE, label: '还没建状态', on: f.status.includes(NONE), count: S.data ? noState : 0 },
          ...(S.meta.statuses || []).map((st) => ({ value: st.id, label: st.label, on: f.status.includes(st.id), count: cnt[st.id] || 0, sw: stClass(st.id) }))];
      },
      pick: (v) => fSet((x) => {
        if (v === 'm:open') { x.status = []; x.only_open = true; }
        else if (v === 'm:all') { x.status = []; x.only_open = false; }
        else { toggleIn(x.status, v); x.only_open = false; }
      }),
    };
  }
  if (key === 'likes') {
    return {
      items: () => [{ head: '排序' }, { value: 's:likes', label: '点赞最多在前', on: f.sort === 'likes' },
        { sep: true }, { head: '阈值' },
        ...[[0, '不限'], [50, '赞 ≥ 50'], [100, '赞 ≥ 100'], [300, '赞 ≥ 300']].map(([n, l]) => ({ value: 'n:' + n, label: l, on: f.likes_min === n })),
        { value: 'n:custom', label: '自定义…', on: ![0, 50, 100, 300].includes(f.likes_min), hint: ![0, 50, 100, 300].includes(f.likes_min) ? `当前 ≥ ${f.likes_min}` : '' }],
      pick: (v) => {
        if (v === 's:likes') return fSet((x) => { x.sort = 'likes'; });
        if (v === 'n:custom') {
          const raw = typeof prompt === 'function' ? prompt('赞 ≥ 多少', String(f.likes_min || '')) : null;
          if (raw == null) return;
          const n = parseInt(raw, 10);
          return fSet((x) => { x.likes_min = Number.isFinite(n) && n > 0 ? n : 0; });
        }
        fSet((x) => { x.likes_min = +v.slice(2); });
      },
    };
  }
  return { items: () => [], pick: () => {} };
}

// 上方一行：搜索 + 六个下拉 + 两个勾选框；页头只剩导出。只画一次，之后 fbarSync 只改按钮上的字（搜索框不能被重画打断）。
function renderFiltersShell() {
  const bar = $('#fbar');
  const rt = $('#headrt');
  if (!bar || !rt) return;
  bar.innerHTML = `
    <label class="fsearch">${SEARCH_ICON}<input type="search" id="fQ" placeholder="搜原文关键词…" value="${esc(S.f.q)}"></label>
    ${['view', 'trk', 'exp', 'cat', 'sen', 'per'].map((k) => `<button type="button" class="dd-btn" data-dd="${k}" aria-haspopup="listbox" aria-expanded="false"><span class="tx"></span>${SEL_CHEVRON}</button>`).join('')}
    <label class="chk"><input type="checkbox" id="fMute" ${S.f.include_muted ? 'checked' : ''}> 含已静音</label>
    <label class="chk"><input type="checkbox" id="fStar" ${S.f.starred ? 'checked' : ''}> 只看星标</label>`;
  rt.innerHTML = `<button class="btn sm" id="fExport">导出 CSV</button>`;
  bar.querySelectorAll('[data-dd]').forEach((b) => b.addEventListener('click', () => openMenu(b, fMenuSpec(b.dataset.dd))));
  $('#fMute').addEventListener('change', (e) => fSet((f) => { f.include_muted = e.target.checked; }));
  $('#fStar').addEventListener('change', (e) => fSet((f) => { f.starred = e.target.checked; }));
  $('#fExport').addEventListener('click', exportCsv);
  let t = null;
  $('#fQ').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { S.f.q = e.target.value.trim(); S.activeView = null; applyFilters(); }, 320);
  });
  fbarSync();
  renderActiveRow();
}

// 下拉按钮上的字自己说明状态：没选 = 名字；选 1 个 = 名字：值；选多个 = 名字 · N。
const ddLabel = (name, arr, lbl) => !arr.length ? name : arr.length === 1 ? `${name}：${lbl(arr[0])}` : `${name} · ${arr.length}`;
function fbarSync() {
  const f = S.f;
  const view = (S.views || []).find((v) => v.view_id === S.activeView);
  const axl = (ax, name) => [ddLabel(name, f[ax], (v) => valLabel(ax, v)), f[ax].length > 0];
  const labels = {
    view: [view ? `视图：${view.name}` : '视图', !!view],
    trk: [f.tracker ? `追踪项：${trackerLabel(f.tracker)}` : '追踪项', !!f.tracker],
    exp: axl('experience', '体验域'), cat: axl('category', '品类线'), sen: axl('sentiment', '情绪'), per: axl('persona', '人群场景'),
  };
  document.querySelectorAll('#fbar [data-dd]').forEach((b) => {
    const [tx, on] = labels[b.dataset.dd] || ['', false];
    const t = b.querySelector('.tx'); if (t) t.textContent = tx;
    b.classList.toggle('on', on);
  });
  const q = $('#fQ');
  if (q && q.value !== f.q && document.activeElement !== q) q.value = f.q;
  const mu = $('#fMute'); if (mu) mu.checked = !!f.include_muted;
  const st = $('#fStar'); if (st) st.checked = !!f.starred;
}

// 生效条件行：当前条件的唯一真相。默认的「未闭环」不算。
function condChips() {
  const f = S.f, c = [];
  const add = (k, v, text, cls) => c.push({ k, v, text, cls: cls || '' });
  if (f.tracker) add('tracker', f.tracker, `追踪项 · ${trackerLabel(f.tracker)}`, 'trk');
  f.severity.forEach((v) => add('severity', v, `严重度 · ${valLabel('severity', v)}`));
  if (f.severity_none) add('severity_none', 1, '严重度 · 未识别');
  f.experience.forEach((v) => add('experience', v, `体验域 · ${valLabel('experience', v)}`));
  f.owner.forEach((v) => add('owner', v, `负责人 · ${v === NONE ? '未认领' : v}`));
  if (!f.status.length && f.only_open) add('only_open', 1, '状态 · 未闭环');
  f.status.forEach((v) => add('status', v, `状态 · ${v === NONE ? '还没建状态' : statusLabel(v)}`));
  if (f.item_type) add('item_type', f.item_type, `类型 · ${f.item_type === 'post' ? '笔记' : '评论'}`);
  if (f.days) add('days', f.days, `最近 ${f.days} 天`);
  if (f.likes_min) add('likes_min', f.likes_min, `赞 ≥ ${f.likes_min}`);
  SECONDARY_AXES.forEach((ax) => f[ax].forEach((v) => add(ax, v, `${axisLabel(ax)} · ${valLabel(ax, v)}`)));
  if (f.include_muted) add('include_muted', 1, '含已静音');
  if (f.starred) add('starred', 1, '只看星标');
  if (f.q) add('q', 1, `搜「${f.q}」`);
  return c;
}

function renderActiveRow() {
  const el = $('#factive');
  if (!el) return;
  const chips = condChips();
  if (!chips.length) { el.innerHTML = ''; el.classList.remove('on'); return; }
  el.classList.add('on');
  el.innerHTML = chips.map((c) => `<span class="fcond ${c.cls}">${esc(c.text)}<button type="button" class="x" data-x="${esc(c.k)}" data-val="${esc(String(c.v))}" title="去掉这个条件">${iconSvg('x', 12)}</button></span>`).join('')
    + `<span class="acts"><button type="button" class="btn sm ghost" id="fReset">重置</button><button type="button" class="btn sm" id="saveView">＋ 存为视图</button></span>`;
  el.querySelectorAll('[data-x]').forEach((x) => x.addEventListener('click', () => clearCond(x.dataset.x, x.dataset.val)));
  $('#fReset').addEventListener('click', () => fSet((f) => { Object.assign(f, blankFilters()); }));
  $('#saveView').addEventListener('click', saveView);
}

// 去掉一个条件（生效条件行的 ×）。多值的按值去；开关类的关掉；「全部」回到默认的未闭环。
function clearCond(k, v) {
  const f = S.f;
  if (Array.isArray(f[k])) { const i = f[k].indexOf(v); if (i >= 0) f[k].splice(i, 1); }
  else if (k === 'only_open') f.only_open = false;
  else if (k === 'tracker' || k === 'item_type' || k === 'q') f[k] = '';
  else if (k === 'days' || k === 'likes_min') f[k] = 0;
  else f[k] = false;
  S.activeView = null;
  applyFilters();
}

async function applyView(id) {
  try {
    const v = await get('/api/views/' + encodeURIComponent(id));
    const q = v.query || {};
    S.f = blankFilters();
    for (const ax of AXIS_ORDER) if (q[ax]) S.f[ax] = [].concat(q[ax]);
    if (q.owner) S.f.owner = [].concat(q.owner);
    if (q.status) S.f.status = [].concat(q.status);
    S.f.tracker = q.tracker ? String(q.tracker) : '';
    // 视图里的 me=True 是占位符：「我负责」对每个人结果不同，所以服务端只存占位符，
    // 到用的时候才落地成当前操作人。
    if (q.me) S.f.owner = [S.actor];
    ['severity_none', 'include_muted', 'only_open', 'starred'].forEach((k) => { S.f[k] = !!q[k]; });
    S.f.q = q.q || ''; S.f.sort = q.sort || 'time_desc';
    S.f.days = q.days || 0; S.f.likes_min = q.likes_min || 0;
    S.activeView = id;
    await applyFilters();
  } catch (e) { toast(e.message, true); }
}

async function saveView() {
  const name = prompt('视图名字', suggestName());
  if (!name) return;
  try {
    const body = { name, owner: '', shared: true, query: {} };
    for (const ax of AXIS_ORDER) if (S.f[ax].length) body.query[ax] = S.f[ax];
    if (S.f.owner.length) body.query.owner = S.f.owner;
    if (S.f.status.length) body.query.status = S.f.status;
    if (S.f.tracker) body.query.tracker = S.f.tracker;
    ['severity_none', 'include_muted', 'only_open', 'starred'].forEach((k) => {
      if (S.f[k]) body.query[k] = 1;
    });
    if (S.f.q) body.query.q = S.f.q;
    if (S.f.days) body.query.days = S.f.days;
    if (S.f.likes_min) body.query.likes_min = S.f.likes_min;
    if (S.f.sort !== 'time_desc') body.query.sort = S.f.sort;
    const v = await post('/api/views', body);
    S.views = (await get('/api/views')).views || [];
    S.activeView = v.view_id || null;
    fbarSync();
    toast('已保存视图：' + name);
  } catch (e) { toast(e.message, true); }
}

function suggestName() {
  const bits = [];
  if (S.f.tracker) bits.push(trackerLabel(S.f.tracker));
  for (const ax of ['severity', 'experience', 'category']) {
    S.f[ax].forEach((v) => bits.push(valLabel(ax, v)));
  }
  if (!S.f.severity.some((x) => x === 'sev.p0') && S.f.owner.includes('__none__')) bits.push('未认领');
  if (S.f.only_open) bits.push('未闭环');
  if (S.f.owner.filter((o) => o !== '__none__').length) bits.push(S.f.owner.join('/'));
  return bits.slice(0, 3).join(' · ') || '我的视图';
}

async function delView(id) {
  if (!confirm('删除这个视图？')) return;
  try {
    await api('DELETE', '/api/views/' + encodeURIComponent(id));
    S.views = (await get('/api/views')).views || [];
    if (S.activeView === id) S.activeView = null;
    fbarSync();
    toast('已删除');
  } catch (e) { toast(e.message, true); }
}

async function applyFilters() {
  S.f.page = 1;
  await loadInsights();
}

// ---------------------------------------------------------------- 列表

async function loadInsights() {
  const seq = ++S.loadSeq;
  // URL 立刻跟上：筛选条件是"用户表达了什么"，和请求成没成功无关 ——
  // 请求失败（比如带了个不存在的口径）时 URL 也该记着，那才复现得出来。
  syncHash('insights');
  const p = paramsFrom(S.f, false);
  // 查询变了 = 屏幕上换了一批行。旧勾选对应不上任何一条看得见的东西，
  // 所以直接作废，而不是留一个对不上号的"已选 12 条"。
  // 写操作之后也会走这里，但那时参数没变，所以失败的勾选能留住。
  const key = p.toString();
  if (S.selKey !== key) {
    S.sel.clear();
    S.bulkFail = [];
    S.selDropped = 0;
    S.selKey = key;
  }
  try {
    const [data, fac] = await Promise.all([
      get('/api/insights?' + p.toString()),
      get('/api/facets?' + paramsFrom(S.f, true).toString()),
    ]);
    if (seq !== S.loadSeq) return;   // 有更新的请求在跑，丢弃这次
    S.data = data; S.facets = fac;
    pruneSel();                      // 勾选只保留这一页真实存在的行
    fbarSync();
    renderActiveRow();
    renderList();
    renderPager();
    if (S.pendingOpen) { const id = S.pendingOpen; S.pendingOpen = ''; openDetail(id, true); }
    const lede = $('#lede');
    if (lede) {
      const nActive = countActive(S.f);
      lede.innerHTML = `共 <b>${data.total}</b> 条${nActive ? '（已筛选）' : ''}`
        + (S.summary && S.summary.p0_unclaimed
            ? ` · <span style="color:var(--p0)">${S.summary.p0_unclaimed} 条 P0 还没人认领</span>` : '');
    }
  } catch (e) {
    if (seq !== S.loadSeq) return;
    const l = $('#list');
    if (l) l.innerHTML = `<div class="empty"><b>加载失败</b>${esc(e.message)}</div>`;
  }
}

function countActive(f) {
  return AXIS_ORDER.reduce((a, ax) => a + f[ax].length, 0) + f.owner.length + f.status.length
    + [f.severity_none, f.include_muted, f.only_open, f.starred, !!f.q, !!f.days, !!f.likes_min,
       !!f.item_type, !!f.tracker]
      .filter(Boolean).length;
}

function renderList() {
  const el = $('#list');
  if (!el) return;
  const d = S.data;
  if (!d || !d.items.length) {
    el.innerHTML = `<div class="empty"><b>没有符合条件的洞察</b>
      换个筛选条件，或者点「清空筛选」回到全量看。</div>`;
    return;
  }

  el.innerHTML = `<table>
    <thead><tr>
      <th class="w-sel"><input type="checkbox" id="selAll" title="选中本页全部"></th>
      <th>内容</th>
      <th class="w-sev">${thBtn('sev', '严重度')}</th>
      <th class="w-type">${thBtn('type', '类型')}</th>
      <th class="w-time">${thBtn('time', '时间')}</th>
      <th class="w-owner">${thBtn('owner', '负责人')}</th>
      <th class="w-st">${thBtn('st', '状态')}</th>
      <th class="w-like num">${thBtn('likes', '赞')}</th>
      <th class="w-act">操作</th>
    </tr></thead>
    <tbody>${d.items.map(rowHtml).join('')}</tbody>
  </table>`;

  el.querySelectorAll('[data-open]').forEach((x) => {
    x.addEventListener('click', () => openDetail(x.dataset.open));
  });
  el.querySelectorAll('[data-col]').forEach((b) => {
    b.addEventListener('click', () => openMenu(b, fMenuSpec(b.dataset.col)));
  });
  el.querySelectorAll('[data-more]').forEach((b) => {
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const it = (S.data && S.data.items || []).find((x) => x.insight_id === b.dataset.more);
      if (it) openMenu(b, rowMoreSpec(it));
    });
  });
  // 负责人列的单元格（未认领 / 我名下 / 他人名下，同一颗按钮）：点开直列配置名单。
  el.querySelectorAll('[data-own]').forEach((b) => {
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const it = (S.data && S.data.items || []).find((x) => x.insight_id === b.dataset.own);
      if (it) openMenu(b, ownerMenuSpec(it));
    });
  });
  // 状态列内联改：默认只显示值，hover 才露出下拉的描边和箭头，点开是同一套菜单。
  el.querySelectorAll('.stbtn').forEach((b) => {
    b.addEventListener('click', (ev) => { ev.stopPropagation(); openMenu(b, stMenuSpec(b.dataset.id, b.dataset.st)); });
  });
  // 严重度列同一套交互；负责人列走上面的 [data-own] 绑定（同一个菜单）。
  el.querySelectorAll('.sevbtn').forEach((b) => {
    b.addEventListener('click', (ev) => { ev.stopPropagation(); openMenu(b, sevMenuSpec(b.dataset.sev, b.dataset.cur)); });
  });
  // 勾选框：点它不该等于点这一行。行上现在没有点击事件，
  // 但加一道 stopPropagation，将来谁给行加个"点开详情"也不会把勾选带坏。
  el.querySelectorAll('input[data-sel]').forEach((cb) => {
    cb.addEventListener('click', (ev) => ev.stopPropagation());
    cb.addEventListener('change', () => toggleSel(cb.dataset.sel, cb.checked));
  });
  const all = $('#selAll');
  if (all) {
    all.addEventListener('click', (ev) => ev.stopPropagation());
    all.addEventListener('change', () => {
      S.bulkFail = [];                       // 新的选择 = 旧那批失败已经翻篇了
      pageIds().forEach((id) => { if (all.checked) S.sel.add(id); else S.sel.delete(id); });
      syncSel();
    });
  }
  syncSel();
}

// 列头菜单按钮：`名字 [生效值] [↓] ▾`。有生效条件蓝底蓝字；当前排序列带箭头。
function thBtn(key, name) {
  const f = S.f;
  let val = '', sortKey = '';
  if (key === 'sev') { val = f.severity.length || f.severity_none ? (f.severity.length + (f.severity_none ? 1 : 0) === 1 ? (f.severity[0] ? valLabel('severity', f.severity[0]) : '未识别') : `· ${f.severity.length + (f.severity_none ? 1 : 0)}`) : ''; sortKey = 'sev'; }
  else if (key === 'type') val = f.item_type ? (f.item_type === 'post' ? '笔记' : '评论') : '';
  else if (key === 'time') { val = f.days ? `最近 ${f.days} 天` : ''; sortKey = 'time'; }
  else if (key === 'owner') val = f.owner.length ? (f.owner.length === 1 ? (f.owner[0] === NONE ? '未认领' : f.owner[0]) : `· ${f.owner.length}`) : '';
  else if (key === 'st') val = f.status.length ? (f.status.length === 1 ? (f.status[0] === NONE ? '还没建状态' : statusLabel(f.status[0])) : `· ${f.status.length}`) : (f.only_open ? '未闭环' : '');
  else if (key === 'likes') { val = f.likes_min ? `≥ ${f.likes_min}` : ''; sortKey = 'likes'; }
  const sorted = sortKey && (f.sort === sortKey || (sortKey === 'time' && f.sort.startsWith('time')));
  const arrow = sorted ? `<span class="sa">${iconSvg(f.sort === 'time_asc' ? 'arrowUp' : 'arrowDown', 12)}</span>` : '';
  return `<button type="button" class="thb${val ? ' on' : ''}" data-col="${key}" aria-haspopup="listbox" aria-expanded="false">
    <span>${esc(name)}</span>${val ? `<span class="val">${esc(val)}</span>` : ''}${arrow}${SEL_CHEVRON}</button>`;
}

// 类型只在底色上区分：笔记 = 实线有底，评论 = 实线无底。不用图标，不用虚线 —— 虚线在这套里是「未识别 / 没有」的语义。
// 类名用 tnote / tcmt：`.note` 是说明框那条通用规则（虚线、14px、大内边距），叫 .chip.note 会被它撞上。
const typeChip = (t) => t === 'post' ? '<span class="chip tnote">笔记</span>' : '<span class="chip tcmt">评论</span>';
// 严重度列里只印等级（P0 / P1 / P2），全名放 title：列头已经写着"严重度"，"体验受损"四个字在这里是重复的。
const sevChip = (sev) => {
  if (!sev) return '<span class="chip none">未识别</span>';
  const full = valLabel('severity', sev);
  const short = /^P\d/.test(full) ? full.split(/\s+/)[0] : full;
  return `<span class="chip ${SEV_CLASS[sev] || 'gray'}" title="${esc(full)}">${esc(short)}</span>`;
};

// 状态单元格：写得动的角色是一颗按钮（● 值），hover 变成下拉收起态；只读角色是纯文本。
function stCell(it) {
  // 圆点六态：未登记空心圈、待评估实心灰、已建需求蓝、排期中蓝点 + 淡蓝底、已修复绿、不处理灰 + 删除线
  const cls = stClass(it.status_id) + (it.status_id === 'st.scheduled' ? ' st-sched' : '');
  const dot = it.has_state === false ? 'st-none' : stClass(it.status_id);
  const inner = `<span class="dot ${dot}"></span><span class="tx">${esc(it.status)}</span>`;
  if (!S.canWrite) return `<span class="stval ${cls}">${inner}</span>`;
  return `<button type="button" class="stbtn ${cls}" data-id="${esc(it.insight_id)}" data-st="${esc(it.status_id || '')}"
      aria-haspopup="listbox" aria-expanded="false" title="改状态">${inner}${SEL_CHEVRON}</button>`;
}

// 严重度单元格：同一套「平时是值，hover 才露出下拉」的交互，套在 sev chip 外面。
// 只读角色维持纯 badge，不出现"点了没反应"的假按钮。
function sevCell(it, sev) {
  if (!S.canWrite) return sevChip(sev);
  return `<button type="button" class="sevbtn" data-sev="${esc(it.insight_id)}" data-cur="${esc(sev || '')}"
      aria-haspopup="listbox" aria-expanded="false" title="改严重度">${sevChip(sev)}${SEL_CHEVRON}</button>`;
}

// 负责人单元格：三个态都可点（未认领 / 我名下 / 他人名下），点开同一个 ownerMenuSpec。
// 他人名下也能从单元格改派 —— 这里就是负责人列，不该让人再跑去 Dock 找入口。
function ownerCell(it) {
  const txt = `<span class="tx">${esc(it.owner || '未认领')}</span>`;
  if (!S.canWrite) return `<span class="owner ${it.owner ? '' : 'none'}">${txt}</span>`;
  return `<button type="button" class="ownbtn${it.owner ? '' : ' none'}" data-own="${esc(it.insight_id)}"
      aria-haspopup="listbox" aria-expanded="false" title="改负责人">${txt}${SEL_CHEVRON}</button>`;
}

// 行尾「⋯」：星标 / 静音。文案跟着当前状态走（已星标 → 取消星标）。
function rowMoreSpec(it) {
  return {
    items: () => [
      ...(it.owner ? [{ value: 'unclaim', label: '取消认领', hint: `现在是 ${it.owner}` }] : []),
      { value: 'star', label: it.starred ? '取消星标' : '加星标' },
      { value: 'mute', label: it.muted ? '取消静音' : '静音' , hint: it.muted ? '' : '默认不显示，可恢复' },
    ],
    pick: (v) => {
      if (v === 'unclaim') return unclaimOne(it.insight_id);
      flagAct(it.insight_id, v === 'star' ? 'starred' : 'muted', v === 'star' ? it.starred : it.muted);
    },
  };
}

// 负责人菜单：直列配置中心的名单（S.meta.owners ← config/trackers.json 各追踪项的
// owner，配置中心可改），点谁就是谁 —— 认领 / 分配 / 转交在接口层是同一个 claim。
// 名单里没有的名字仍能从详情抽屉的自由文本里填。有主的多一项「放回池中」。
function ownerMenuSpec(it) {
  const mine = !!it.owner && it.owner === S.actor;
  const title = !it.owner ? '未认领' : (mine ? `我名下（${it.owner}）` : `负责人：${it.owner}`);
  return {
    title,
    items: () => [
      ...(S.meta.owners || []).map((o) => ({
        value: o, label: o === S.actor ? `${o}（我）` : o, on: o === it.owner })),
      ...(it.owner ? [{ sep: true }, { value: '_pool', label: '放回池中', hint: '退回未认领' }] : []),
    ],
    pick: async (v) => {
      if (v === '_pool') return unclaimOne(it.insight_id);
      if (v === it.owner) return;
      try {
        await post(`/api/insights/${encodeURIComponent(it.insight_id)}/claim`, { owner: v, actor: S.actor });
        toast(v === S.actor ? '已认领给 ' + v : (it.owner ? '已转交给 ' + v : '已分配给 ' + v));
        await refreshCounters();
        await loadInsights();
        if (S.detail && S.detail.insight_id === it.insight_id) await openDetail(it.insight_id, true);
      } catch (e) { toast(e.message, true); }
    },
  };
}

// 退回未认领：同一个 claim 接口，owner 传空。
async function unclaimOne(id) {
  try {
    await post(`/api/insights/${encodeURIComponent(id)}/claim`, { owner: '', actor: S.actor });
    toast('已退回未认领');
    await refreshCounters();
    await loadInsights();
    if (S.detail && S.detail.insight_id === id) await openDetail(id, true);
  } catch (e) { toast(e.message, true); }
}

async function flagAct(id, flag, cur) {
  try {
    await post(`/api/insights/${encodeURIComponent(id)}/flag`, { flag, value: !cur, actor: S.actor });
    toast(cur ? '已取消' : (flag === 'starred' ? '已加星标' : '已静音（默认不显示）'));
    await refreshCounters();
    await loadInsights();
    if (S.detail && S.detail.insight_id === id) await openDetail(id, true);
  } catch (e) { toast(e.message, true); }
}

// 状态菜单：五个状态，当前 ✓；「不处理」不在列表里就地改 —— 理由是写给人看的，去 Dock 写。
function stMenuSpec(id, cur) {
  return {
    items: () => S.meta.statuses.map((st) => ({
      value: st.id, label: st.label, on: st.id === (cur || 'st.todo'), sw: stClass(st.id),
      hint: st.id === 'st.wontfix' ? '要写理由，会打开详情' : '' })),
    pick: async (sid) => {
      if (sid === cur) return;
      if (sid === 'st.wontfix') {
        toast('标为「不处理」要先写一句理由', true);
        await openDetail(id);
        const n = $('#dnote'); if (n && n.focus) n.focus();
        return;
      }
      try {
        await post(`/api/insights/${encodeURIComponent(id)}/status`, { status_id: sid, actor: S.actor });
        toast('状态已改为 ' + statusLabel(sid));
        await refreshCounters();
        await loadInsights();
        if (S.detail && S.detail.insight_id === id) await openDetail(id, true);
      } catch (e) { toast(e.message, true); }
    },
  };
}

// 严重度菜单：等级列表来自 meta（config/taxonomy.json），页面不写死 ——
// 和列头筛选、抽屉加标签用的是同一份字典，配置改版这里跟着变。
// 「未识别」= 把 severity 标签全撤掉（后端 set_severity 的空串语义）。
function sevMenuSpec(id, cur) {
  const sevs = ((S.meta.axes.find((a) => a.id === 'severity') || {}).values) || [];
  const sevLabel = (v) => (/^P\d/.test(valLabel('severity', v)) ? valLabel('severity', v).split(/\s+/)[0] : valLabel('severity', v));
  return {
    title: '严重度',
    items: () => [
      ...sevs.map((v) => ({ value: v.id, label: v.label, on: v.id === cur,
        sw: SEV_CLASS[v.id] || 'p2' })),
      { value: '', label: '未识别', on: !cur, sw: 'none', hint: '撤掉严重度标签' },
    ],
    pick: async (v) => {
      if (v === (cur || '')) return;
      try {
        await post(`/api/insights/${encodeURIComponent(id)}/severity`, { value: v, actor: S.actor });
        toast(v ? '严重度已改为 ' + sevLabel(v) : '已改为未识别');
        await refreshCounters();
        await loadInsights();
        if (S.detail && S.detail.insight_id === id) await openDetail(id, true);
      } catch (e) { toast(e.message, true); }
    },
  };
}

function rowHtml(it) {
  const t = it.tags || {};
  const chips = [];
  const sev = (t.severity || [])[0] || it.severity;
  (t.experience || []).slice(0, 2).forEach((v) =>
    chips.push(`<span class="chip exp">${esc(valLabel('experience', v))}</span>`));
  (t.category || []).slice(0, 2).forEach((v) =>
    chips.push(`<span class="chip cat">${esc(valLabel('category', v))}</span>`));
  (t.sentiment || []).slice(0, 1).forEach((v) =>
    chips.push(`<span class="chip sen">${esc(valLabel('sentiment', v))}</span>`));
  (t.persona || []).slice(0, 1).forEach((v) =>
    chips.push(`<span class="chip per">${esc(valLabel('persona', v))}</span>`));
  // 命中的追踪项。条目级的负责人是人、主题级的负责人是团队，追踪项是这两者之间
  // 唯一的那条线 —— 一条 P0 旁边写着「履约时效与超时」，就同时回答了
  // "这条该给谁看"和"它会不会让那根线抬头"。最多两个，多的折成 +n。
  const tk = it.trackers || [];
  tk.slice(0, 2).forEach((x) =>
    chips.push(`<span class="chip trk" title="命中追踪项 · 负责人 ${esc(x.owner || '未指定')}">${esc(x.name)}</span>`));
  if (tk.length > 2) chips.push(`<span class="chip trk" title="${esc(tk.map((x) => x.name).join('、'))}">+${tk.length - 2}</span>`);

  const head = it.title
    ? `<div class="t">${esc(it.title)}</div><div class="x">${esc(it.text.slice(it.title.length).trim().slice(0, 70))}</div>`
    : `<div class="x">${esc(it.text.slice(0, 96))}${it.text.length > 96 ? '…' : ''}</div>`;

  // 操作列只留星标和「⋯」。认领 / 分配 / 转交全收进负责人列的下拉（ownerMenuSpec）：
  // 同一件事两个入口，总会有一处跟着需求变化忘了改。
  const actBtns = [];
  if (it.starred) actBtns.push(`<span class="star on" title="已加星标">${iconSvg('star', 14)}</span>`);
  actBtns.push(`<button type="button" class="btn sm ghost more" data-more="${esc(it.insight_id)}" aria-haspopup="listbox" aria-expanded="false"
      title="更多">⋯</button>`);

  return `<tr class="${it.muted ? 'muted' : ''}" data-row="${esc(it.insight_id)}">
    <td class="w-sel"><input type="checkbox" data-sel="${esc(it.insight_id)}"
        ${S.sel.has(it.insight_id) ? 'checked' : ''}></td>
    <td><div class="sumtext" data-open="${esc(it.insight_id)}">${head}</div>
        <div class="tagrow">${chips.join('')}</div></td>
    <td class="w-sev">${sevCell(it, sev)}</td>
    <td class="w-type">${typeChip(it.item_type)}</td>
    <td class="w-time" title="${esc(it.time)}">${esc(/^\d{4}-/.test(it.time || '') ? it.time.slice(5) : it.time)}</td>
    <td class="w-owner">${ownerCell(it)}</td>
    <td class="w-st">${stCell(it)}</td>
    <td class="w-like num">${it.like_count || 0}</td>
    <td class="w-act"><div class="acts">${actBtns.join('')}</div></td>
  </tr>`;
}

function renderPager() {
  const el = $('#pager');
  if (!el || !S.data) return;
  const d = S.data;
  el.innerHTML = `<div class="card" style="margin-top:12px">
    <div class="pager">
      <span class="info">第 ${d.page} / ${d.pages || 1} 页 · 每页 ${d.page_size} 条 · 共 ${d.total} 条</span>
      <span class="sp">
        <button class="btn sm" id="pPrev" ${d.page <= 1 ? 'disabled' : ''}>上一页</button>
        <button class="btn sm" id="pNext" ${d.page >= d.pages ? 'disabled' : ''}>下一页</button>
        <select id="pSize">${S.meta.page_sizes.map((n) =>
          `<option value="${n}" ${d.page_size === n ? 'selected' : ''}>${n} / 页</option>`).join('')}</select>
      </span>
    </div></div>`;
  const prev = $('#pPrev'), next = $('#pNext');
  if (prev) prev.addEventListener('click', () => { S.f.page = Math.max(1, d.page - 1); loadInsights(); });
  if (next) next.addEventListener('click', () => { S.f.page = Math.min(d.pages || 1, d.page + 1); loadInsights(); });
  $('#pSize').addEventListener('change', (e) => { S.f.page_size = +e.target.value; S.f.page = 1; loadInsights(); });
}

// 两个导出，分得很清楚：
//   这里      内容级明细，一条内容一行。回答"这批东西各自长什么样"。走筛选条件。
//   exportPosts 原帖级清单，一篇笔记一行。回答"我要打开哪几篇"。走勾选的那一批。
// 合并成一个就必然丢掉其中一个用途，而丢掉的通常是"要接手的那位"要看的那个。
function exportCsv() {
  if (!S.canWrite) { toast('只读角色不能导出（导出件里有用户原话）', true); return; }
  const p = paramsFrom(S.f, false);
  p.delete('page'); p.delete('page_size');
  window.location.href = '/api/export.csv?' + p.toString();
}

async function exportPosts() {
  const ids = [...S.sel];
  if (!ids.length) return;
  const bar = $('#selbar');
  if (bar) bar.querySelectorAll('button,select').forEach((b) => { b.disabled = true; });
  try {
    const r = await post('/api/export/posts.csv', { ids });
    downloadCsv(r.csv, `原帖清单-${r.posts}篇-${today()}.csv`);
    // 报账。**一句都不能省**：勾了 12 条却只导出 8 行，不说清楚的话，
    // 人的第一反应是"导出漏了 4 条"或者"这工具坏了"，而不是"4 条是评论"。
    const bits = [`已导出 ${r.posts} 篇原帖`];
    if (r.comments) bits.push(`（${r.items} 条内容归并，其中 ${r.comments} 条评论并进了所属笔记）`);
    const warn = [];
    if (r.no_url) warn.push(`${r.no_url} 篇没有链接，打开清单也点不进去`);
    if ((r.missing || []).length) warn.push(`${r.missing.length} 条已不在库里，没能带出来`);
    if (warn.length) bits.push('注意：' + warn.join('；'));
    toast(bits.join(' '), warn.length > 0);
  } catch (e) {
    toast(e.message, true);
  } finally {
    if (bar) bar.querySelectorAll('button,select').forEach((b) => { b.disabled = false; });
  }
}

// 走 fetch 拿文本再自己触发下载。为什么不用 window.location.href 那套（导出 CSV 用的）：
// 一次可能带 200 个 id，塞进 URL 会超长，而超长的后果是**被截断后导出一份少了几行的清单**，
// 且没有任何提示 —— 一份看起来完整、实际少两条的清单，比导出失败危险得多。
function downloadCsv(text, filename) {
  // BOM：Excel 打开中文 CSV 不乱码。命令行那边写 utf-8-sig 是同一件事。
  const blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- 批量选择
//
// 两条刻意的限制：
//
// 1. **只能选本页。** 不做「全选筛选结果」——那是在看不见的行上动手。
//    354 条里一次改 200 条、而屏幕上只有 50 条的时候，点完就没人知道改了什么。
//    想批量处理更多，就调大每页条数，让它们真的出现在眼前。
// 2. **选择跟着查询走。** selKey 记下勾选时那串筛选参数，参数变了就清空。
//    翻页也算变了 —— 否则"已选 12 条"会和屏幕上的行对不上。
//
// 这两条加起来只为一件事：让人**在动手之前看得见自己要动什么**。

function pageIds() {
  return ((S.data && S.data.items) || []).map((i) => i.insight_id);
}

// 选择只能指向屏幕上真实存在的行。
// 库里删过、或者数据变动把某条挤出了这一页，那个 id 就不再对应任何看得见的东西；
// 留着它，「已选 12 条」就会比屏幕上的勾多出来 —— 一个自己都对不上的数字，
// 在批量写之前出现是最危险的。所以每次加载后按这一页的行收敛一次，
// 并且**如实说出收敛掉了几条**，不做无声的丢弃。
function pruneSel() {
  if (!S.sel.size) return;
  const alive = new Set(pageIds());
  const before = S.sel.size;
  for (const id of [...S.sel]) {
    if (!alive.has(id)) S.sel.delete(id);
  }
  const dropped = before - S.sel.size;
  if (dropped) S.selDropped = dropped;
}

function toggleSel(id, on) {
  S.bulkFail = [];
  S.selDropped = 0;
  if (on) S.sel.add(id); else S.sel.delete(id);
  syncSel();
}

function syncSel() {
  // 只改勾选态和操作条，**不重建列表** —— 重建会把滚动位置和键盘焦点一起丢掉，
  // 勾第二行的时候页面跳回顶部是很烦的。
  const el = $('#list');
  if (el) {
    el.querySelectorAll('input[data-sel]').forEach((cb) => {
      cb.checked = S.sel.has(cb.dataset.sel);
    });
  }
  const all = $('#selAll');
  if (all) {
    const ids = pageIds();
    const n = ids.filter((id) => S.sel.has(id)).length;
    all.checked = n > 0 && n === ids.length;
    all.indeterminate = n > 0 && n < ids.length;
  }
  renderSelBar();
}

function renderSelBar() {
  const el = $('#selbar');
  if (!el) return;
  const n = S.sel.size;
  const fails = S.bulkFail || [];
  // 没有勾选但还有失败明细时也要出现 —— 否则"哪几条没成功、为什么"
  // 会随着计数归零一起消失，而那正是最该留在眼前的信息。
  if (!n && !fails.length) { el.classList.remove('on'); el.innerHTML = ''; return; }
  el.classList.add('on');

  const failBox = fails.length ? `<div class="fails">
      <b>${fails.length} 条没成功</b>（这些还留着选中，处理完原因再点一次就行）：
      ${fails.slice(0, 3).map((f) =>
        `<span class="f"><code>${esc(f.insight_id)}</code> ${esc(f.error)}</span>`).join('')}
      ${fails.length > 3 ? `<span class="f">…另有 ${fails.length - 3} 条</span>` : ''}
      <button class="btn sm ghost" data-bulk="dismiss">知道了</button>
    </div>` : '';

  if (!n) {
    // 选中的都被收敛掉了（比如那几条已经不在库里），但失败原因要留给人看
    el.innerHTML = `<div class="bar">${failBox}</div>`;
    el.querySelectorAll('[data-bulk]').forEach((b) =>
      b.addEventListener('click', () => doBulk(b.dataset.bulk)));
    return;
  }

  const hint = S.selDropped
    ? `有 ${S.selDropped} 条已不在这一页，已从选择里移除`
    : '只选本页 · 换页或改筛选会清空';

  el.innerHTML = `<div class="bar">
    <span class="cnt">已选 <b>${n}</b> 条</span>
    <span class="hint${S.selDropped ? ' warn' : ''}">${esc(hint)}</span>
    <span class="sp">
      <button class="btn sm" data-bulk="claim">认领给 ${esc(S.actor)}</button>
      <button class="btn sm" data-bulk="assign" title="把已选的分给别人负责，附一句理由进操作日志">分配给…</button>
      <button class="btn sm" data-bulk="unclaim" title="退回未认领（只清负责人，不动状态）">取消认领</button>
      <select class="stsel" data-bulksel="1" style="padding:2px 4px;font-size: 13px">
        <option value="">— 改状态 —</option>
        ${S.meta.statuses.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}
      </select>
      <button class="btn sm" data-bulk="star">加星标</button>
      <button class="btn sm" data-bulk="unstar">取消星标</button>
      <button class="btn sm" data-bulk="mute">静音</button>
      ${S.canWrite ? `<button class="btn sm" data-bulk="export-posts"
        title="把这些条目背后的**原帖**去重后导出（一篇笔记一行），拿去发给对应的团队看">导出原帖清单</button>` : ''}
      <button class="btn sm ghost" data-bulk="clearsel">取消选择</button>
    </span>
    ${failBox}</div>`;

  el.querySelectorAll('[data-bulk]').forEach((b) => {
    b.addEventListener('click', () => doBulk(b.dataset.bulk));
  });
  const sel = el.querySelector('[data-bulksel]');
  if (sel) {
    sel.addEventListener('change', (e) => {
      const sid = e.target.value;
      if (!sid) return;
      e.target.value = '';          // 立刻归位，避免看起来"卡"在某个状态上
      doBulk('status', sid);
    });
  }
}

async function doBulk(action, value) {
  if (action === 'clearsel') {
    S.sel.clear(); S.bulkFail = []; S.selDropped = 0; syncSel(); return;
  }
  if (action === 'dismiss') { S.bulkFail = []; renderSelBar(); return; }
  // 导出不是写操作，但它属于"选中了一批东西之后要做的事"，所以住在操作条里 ——
  // 放在筛选栏那个「导出 CSV」旁边会变成两个按钮同一个动作，而它们不是。
  if (action === 'export-posts') { await exportPosts(); return; }
  const ids = [...S.sel];
  if (!ids.length) return;

  // 分配 / 转交进弹层：和别的批量动作不一样——要选人、要看对方负载、要留理由，
  // 不是一次 POST 能说完的事。已选的全是我自己的 → 弹层直接叫"转交"。
  if (action === 'assign') {
    const its = ids.map((id) => (S.data && S.data.items || []).find((x) => x.insight_id === id)).filter(Boolean);
    const mine = its.length === ids.length && its.every((x) => x.owner === S.actor);
    return openAssign({ mode: mine ? 'transfer' : 'assign', ids,
                        cur: mine ? S.actor : '', origin: 'sel' });
  }

  const body = { ids, actor: S.actor };
  if (action === 'claim') { body.action = 'claim'; body.owner = S.actor; }
  else if (action === 'unclaim') { body.action = 'unclaim'; }
  else if (action === 'status') { body.action = 'status'; body.status_id = value; }
  else if (action === 'star' || action === 'unstar') {
    body.action = 'flag'; body.flag = 'starred'; body.value = action === 'star';
  } else if (action === 'mute' || action === 'unmute') {
    body.action = 'flag'; body.flag = 'muted'; body.value = action === 'mute';
  } else return;

  const bar = $('#selbar');
  bar.querySelectorAll('button,select').forEach((b) => { b.disabled = true; });
  try {
    const r = await post('/api/insights/bulk', body);
    // 成功的那些已经不是"待办"了，失败的还留着选中 —— 重试只要再点一次。
    S.sel = new Set(r.failures.map((f) => f.insight_id));
    S.bulkFail = r.failures;
    if (r.failed) {
      toast(`${r.applied} 条成功，${r.failed} 条失败，原因见下方`, true);
    } else {
      toast(`${r.applied} 条已${r.label}`);
    }
    await refreshCounters();
    await loadInsights();
  } catch (e) {
    toast(e.message, true);
  } finally {
    syncSel();
  }
}

// ---------------------------------------------------------------- 分配 / 转交（§3.5 协作层）
//
// 认领 / 分配 / 转交在接口层是同一个动作（改 owner，都走 claim），但语义是三个：
//   认领 = 自己接手（owner == 操作人）；分配 = 把未认领的推给别人；转交 = 把有主的换个人。
// 单条不走弹层：负责人列的下拉直接列配置名单（见 ownerMenuSpec），点谁就是谁。
// 批量分配 / 转交在这里进弹层：对方名下已经有多少活要看得见（负载可见 §3.5.3），
// 理由要留得下、进操作日志（§3.5.4）。

let _asg = null;   // 弹层上下文：{ mode, ids, cur, origin, sel, q, loads, loadsDone }

function assignCandidates(cur) {
  // 候选 = 出现过的负责人 + 操作人自己，去掉当前负责人（转给本人不叫转交，叫没变）。
  // 没做 roster 严选（§3.5.2 的后续项）：先保证"看得见负载"，再谈"管得住名单"。
  const excl = new Set([cur, S.actor].filter(Boolean));
  return [...new Set([...(S.meta.owners || []), S.actor].filter(Boolean))]
    .filter((o) => !excl.has(o));
}

async function openAssign(cfg) {
  // cfg: { mode: 'assign'|'transfer', ids: [...], cur: 当前负责人, origin: 'row'|'sel'|'wb' }
  _asg = { mode: cfg.mode, ids: cfg.ids || [], cur: cfg.cur || '', origin: cfg.origin || 'row',
           sel: null, q: '', loads: {}, loadsDone: false };
  asgPaint();
  $('#assign').showModal();
  $('#asgQ').focus();
  // 负载数字打开时取一次（全局口径，不随当前筛选变）。取不到就不显示——
  // 弹层少个提示数字是遗憾，为此拦住分配才是灾难。
  try {
    const rows = await get('/api/insights/owner-loads');
    if (!_asg) return;                      // 弹层已经关了
    _asg.loads = {};
    rows.forEach((r) => { _asg.loads[r.owner] = r; });
    _asg.loadsDone = true;
    asgSync();
  } catch (e) { /* 数字没取到，动作照常 */ }
}

// 骨架只在每次打开时画一遍；输入和选中只刷列表与确认按钮（asgSync），
// 不重画整个弹层——重画会把输入框焦点一起丢掉。
function asgPaint() {
  const a = _asg;
  $('#assign').innerHTML = `
    <div class="asg-head">
      <h3>${a.mode === 'transfer' ? '转交' : '分配'}${a.ids.length > 1 ? `（已选 ${a.ids.length} 条）` : ''}</h3>
      <div class="sub">${a.mode === 'transfer'
        ? `把这些条目从 ${a.cur} 名下转给另一个人负责`
        : '把这些条目交给某个人负责'}</div>
    </div>
    <div class="asg-body">
      <input type="text" id="asgQ" placeholder="搜名字；新名字要点下面那行「＋」才算数" autocomplete="off" value="${esc(a.q)}">
      <div class="asg-list" id="asgList"></div>
      <input type="text" id="asgNote" placeholder="一句理由（选填，进操作日志）——为什么是这个人">
    </div>
    <div class="asg-foot">
      <button class="btn ghost" id="asgCancel">取消</button>
      <button class="btn" id="asgGo" disabled></button>
    </div>`;
  $('#asgQ').addEventListener('input', (e) => { _asg.q = e.target.value; asgSync(); });
  $('#asgQ').addEventListener('keydown', (e) => {
    // 回车只选人、不提交：选中的名字再由按钮（或理由框回车）确认——
    // 替别人做主的动作值得多按一下，误回车不该直接把条目推出去。
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = _asg.q.trim();
    const cands = assignCandidates(_asg.cur);
    const hit = cands.find((o) => o === q) || cands.filter((o) => !q || o.includes(q))[0];
    if (hit) { _asg.sel = hit; asgSync(); }
  });
  $('#asgNote').addEventListener('keydown', (e) => { if (e.key === 'Enter') asgGo(); });
  $('#asgCancel').addEventListener('click', asgClose);
  $('#asgGo').addEventListener('click', asgGo);
  asgSync();
}

function asgSync() {
  const a = _asg; if (!a) return;
  const q = a.q.trim();
  const cands = assignCandidates(a.cur).filter((o) => !q || o.includes(q));
  const exact = cands.some((o) => o === q);
  const showNew = q && !exact;             // 打的字不是现成成员的精确名 → 给出「＋ 新名字」行
  // 选中项必须还看得见：列表过滤后把选中的名字滤掉时要清掉选择，
  // 否则按钮上写着"转交给 X"而列表里根本没有 X，等于盲签。
  const visible = new Set(cands); if (showNew) visible.add(q);
  if (a.sel && !visible.has(a.sel)) a.sel = null;

  const row = (o, isNew) => {
    const l = a.loads[o];
    const hint = isNew ? '新名字 · 点这一行才会用上它'
      : l ? `P0×${l.p0} · P1×${l.p1} · 未闭环 ${l.open} 条`
      : a.loadsDone ? '名下没有未闭环条目' : '';
    return `<div class="asg-row${a.sel === o ? ' on' : ''}" data-pick="${esc(o)}" role="option" aria-selected="${a.sel === o}">
        <span class="nm">${isNew ? '＋ ' : ''}${esc(o)}</span><span class="hint">${esc(hint)}</span></div>`;
  };
  $('#asgList').innerHTML = (cands.length || showNew)
    ? cands.map((o) => row(o)).join('') + (showNew ? row(q, true) : '')
    : '<div class="asg-none">没有匹配的成员</div>';
  $('#asgList').querySelectorAll('[data-pick]').forEach((r) => {
    r.addEventListener('click', () => { a.sel = r.dataset.pick; asgSync(); });
  });

  const verb = a.mode === 'transfer' ? '转交给' : '分配给';
  const go = $('#asgGo');
  go.disabled = !a.sel;
  go.textContent = a.sel ? `${verb} ${a.sel}${a.ids.length > 1 ? `（${a.ids.length} 条）` : ''}` : `${verb}…`;
}

async function asgGo() {
  const a = _asg; if (!a || !a.sel) return;
  const go = $('#asgGo'); go.disabled = true;
  const note = ($('#asgNote').value || '').trim();
  const verb = a.mode === 'transfer' ? '转交给' : '分配给';
  try {
    if (a.ids.length === 1) {
      const id = a.ids[0];
      await post(`/api/insights/${encodeURIComponent(id)}/claim`,
                 { owner: a.sel, actor: S.actor, note });
      asgClose();
      toast(`已${verb} ${a.sel}`);
      await refreshCounters();
      if (S.page === 'workbench') await loadWorkbench(); else await loadInsights();
      if (S.detail && S.detail.insight_id === id) await openDetail(id, true);
      return;
    }
    // 批量走 bulk：和批量认领同一个接口、同一套"部分成功要报数、失败留选中重试"的规矩。
    const r = await post('/api/insights/bulk',
      { ids: a.ids, actor: S.actor, action: 'claim', owner: a.sel, note });
    asgClose();
    const fails = r.failures || [];
    if (a.origin === 'wb') S.wbSel = new Set(fails.map((f) => f.insight_id));
    else { S.sel = new Set(fails.map((f) => f.insight_id)); S.bulkFail = fails; }
    toast(r.failed
      ? `${r.applied} 条已${verb} ${a.sel}，${r.failed} 条失败，仍选中着，再试一次就行`
      : `${r.applied} 条已${verb} ${a.sel}`, !!r.failed);
    await refreshCounters();
    if (a.origin === 'wb') { await loadWorkbench(); wbSyncSel(); }
    else { await loadInsights(); syncSel(); }
  } catch (e) {
    toast(e.message, true);
    if (_asg) go.disabled = false;          // 弹层没关就留着按钮，改个名字再试
  }
}

function asgClose() {
  _asg = null;
  const dl = $('#assign');
  if (dl.open) dl.close();
}
// 原生 dialog：Esc 关闭也要把上下文清掉，别让下一个弹层捡到上一个的选择。
$('#assign').addEventListener('close', () => { _asg = null; });


async function refreshCounters() {
  try {
    const [summary, ns] = await Promise.all([get('/api/summary'), get('/api/north-star?weeks=8')]);
    S.summary = summary; S.northStar = ns;
    renderNav();
  } catch (e) { /* 顶栏数字没刷上不影响主流程 */ }
  await loadWbBadge();
}

// ---------------------------------------------------------------- 详情抽屉

// ---------------------------------------------------------------- Dock：详情容器
//
// 三种详情（条目 / 主题卡 / 追踪项）共用一个容器，挂在 #dock 里、列表旁边，不遮罩列表。
// 以前是 #layer 里的全屏遮罩抽屉：看一条 → 遮罩 → 关掉 → 找下一条，20 条 P0 要点 40 次。
// 现在头部有 ← →（j / k 同义），在**当前页可见列表**里循环；Esc 关。
// 打开的那一条写进 URL（open=<id>）：URL 是这一屏的写实（ADMIN-IA §四.2），转发出去的链接
// 该让对方看到同一条详情，而不是同一张列表。
// <1400px 时容器退回覆盖式（CSS 里切），别的都不变。

const D = { kind: '', id: '', ids: [], open: null };

// 各页告诉 Dock："我这一页可见的是哪些 id、按什么顺序"。用 DOM 顺序，
// 因为那正是人眼里的顺序（排序 / 筛选都已经体现在 DOM 上了）。
function dockIds() {
  if (D.kind === 'tracker') return [...document.querySelectorAll('.trkrow[data-trk]')].map((r) => r.dataset.trk);
  if (D.kind === 'insight') return [...document.querySelectorAll('tbody tr[data-row]')].map((r) => r.dataset.row);
  if (D.kind === 'theme') {
    // 看板：只在同一条泳道里移动。跨泳道跳等于换了一个问题（"排期中的下一张"）。
    const cur = document.querySelector(`.bcard[data-theme="${cssEsc(D.id)}"]`);
    const lane = cur && cur.closest ? cur.closest('.lane') : null;
    return [...(lane || document).querySelectorAll('.bcard[data-theme]')].map((c) => c.dataset.theme);
  }
  return [];
}
function cssEsc(v) { return String(v).replace(/["\\]/g, '\\$&'); }

// 把一份详情挂进 Dock。`inner` 是抽屉的 .dh / .db / .df 三段，原样来自各自的 draw 函数。
function dockMount(kind, id, openFn, inner) {
  D.kind = kind; D.id = id; D.open = openFn;
  D.ids = dockIds();
  const at = D.ids.indexOf(id);
  const n = D.ids.length;
  const pos = at >= 0 && n ? `${at + 1} / ${n}` : '';
  const el = $('#dock');
  if (!el) return;
  // 刚打开才滑入；j / k 在条目之间走的时候只换内容，不重放动画（动画在这种连续操作里是噪音）。
  const fresh = !($('#stage') && $('#stage').dataset.open);
  _drawerBye = null;   // 正在关的那一份不用管了，这次挂的是新内容
  el.innerHTML = `
    <div class="drawer-mask" id="dmask"></div>
    <div class="drawer${fresh ? ' enter' : ''}" role="dialog" aria-modal="true" aria-label="详情">
      <div class="dnav">
        <button class="btn sm" id="dprev" ${at > 0 ? '' : 'disabled'} title="上一条（k / ←）">‹</button>
        <span class="pos">${esc(pos)}</span>
        <button class="btn sm" id="dnext" ${at >= 0 && at < n - 1 ? '' : 'disabled'} title="下一条（j / →）">›</button>
        <span class="sp"></span>
        <span class="kbd-hint"><kbd>j</kbd><kbd>k</kbd> 上下条 · <kbd>Esc</kbd> 关</span>
        <button class="btn sm" id="dclose" title="关闭（Esc）">关闭</button>
      </div>
      ${inner}
    </div>`;
  const stage = $('#stage');
  if (stage) stage.dataset.open = kind;
  if ($('#dmask')) $('#dmask').addEventListener('click', closeDrawer);
  if ($('#dclose')) $('#dclose').addEventListener('click', closeDrawer);
  if ($('#dprev')) $('#dprev').addEventListener('click', () => dockStep(-1));
  if ($('#dnext')) $('#dnext').addEventListener('click', () => dockStep(1));
  // 屏幕上多了一条详情，URL 就得写上它。
  syncHash(S.page);
}

function dockStep(delta) {
  if (!D.open || !D.ids.length) return;
  const at = D.ids.indexOf(D.id);
  const to = at < 0 ? 0 : at + delta;
  if (to < 0 || to >= D.ids.length) return;
  D.open(D.ids[to], true);
}

let _drawerBye = null;

function closeDrawer() {
  const layer = $('#layer');
  if (layer) layer.innerHTML = '';
  const dock = $('#dock');
  // 关的时候也放一段动画：先加 .leave（抽屉滑出、遮罩淡出），等动画跑完再清空。
  // 清空必须延后，但状态（D / S.detail / URL）立刻就改 —— 那 200ms 里再点一条，
  // dockMount 会把内容整个换掉，这里的定时器就不能再去清它，所以用 _drawerBye 认一下。
  if (dock) {
    const d = dock.querySelector && dock.querySelector('.drawer');
    if (!d) {
      dock.innerHTML = '';          // 没有可动画的节点（假 DOM / 本来就空着）：直接清
    } else {
      const tok = {};
      _drawerBye = tok;
      const m = dock.querySelector('.drawer-mask');
      d.classList.remove('enter'); d.classList.add('leave');
      if (m) m.classList.add('leave');
      setTimeout(() => { if (_drawerBye === tok) { dock.innerHTML = ''; _drawerBye = null; } }, 180);
    }
  }
  const stage = $('#stage');
  if (stage && stage.dataset) delete stage.dataset.open;
  const wasOpen = !!D.kind;
  D.kind = ''; D.id = ''; D.ids = []; D.open = null;
  S.detail = null; S.b.detail = null; S.t.detail = null;
  document.querySelectorAll('.pick').forEach((x) => x.classList.remove('pick'));
  // 关掉了，URL 里的 open= 也得去掉 —— 但只在真的开过时写，免得每次切页都多写一次 hash。
  if (wasOpen) syncHash(S.page);
}

// 键盘只注册一次。焦点在输入框 / 下拉里时不抢 —— 人在备注框里打 j 是在写字。
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const bp = $('#tbBellPop'); if (bp && !bp.hidden) { tbBellToggle(false); return; } }
  if (e.key === 'Escape' && !D.kind) { wkUnfocus(); return; }
  if (!D.kind) return;
  const t = e.target || {};
  const tag = (t.tagName || '').toLowerCase();
  if (e.key === 'Escape') { if (wkUnfocus()) return; closeDrawer(); return; }
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'j' || e.key === 'ArrowRight') { e.preventDefault(); dockStep(1); }
  else if (e.key === 'k' || e.key === 'ArrowLeft') { e.preventDefault(); dockStep(-1); }
});

async function openDetail(id, quiet) {
  try {
    const d = await get('/api/insights/' + encodeURIComponent(id));
    S.detail = d;
    drawDrawer(d);
    document.querySelectorAll('tbody tr').forEach((tr) =>
      tr.classList.toggle('pick', tr.dataset.row === id));
  } catch (e) {
    if (!quiet) toast(e.message, true);
  }
}

function drawDrawer(d) {
  const t = d.tags || {};
  const man = d.manual_tags || {};

  const tagLines = AXIS_ORDER.map((ax) => {
    const vals = t[ax] || [];
    const spec = S.meta.axes.find((a) => a.id === ax) || { values: [] };
    const cls = CHIP_CLASS[ax] || 'gray';
    const chips = vals.map((v) => {
      const isMan = (man[ax] || []).includes(v);
      const k = ax === 'severity' ? (SEV_CLASS[v] || 'gray') : cls;
      return `<span class="chip ${k} ${isMan ? 'manual' : ''}" title="${isMan ? '人工加的，点 × 可撤' : '规则打的'}">
        ${esc(valLabel(ax, v))}${isMan ? `<span class="x" data-untag="${ax}" data-v="${esc(v)}">${iconSvg('x', 12)}</span>` : ''}</span>`;
    }).join('');
    const opts = (spec.values || []).filter((v) => !vals.includes(v.id))
      .map((v) => `<option value="${esc(v.id)}">${esc(v.label)}</option>`).join('');
    return `<div class="tagline"><span class="ax">${esc(axisLabel(ax))}</span>
      <span class="chips">${chips || '<span class="chip none">无</span>'}
        <select class="addtag" data-ax="${ax}" style="padding:1px 4px;font-size: 12px">
          <option value="">＋</option>${opts}
        </select></span></div>`;
  }).join('');

  const ctx = d.context || {};
  let ctxHtml = '';
  if (d.item_type === 'comment' && ctx.post) {
    ctxHtml = `<div class="sect"><h3>上下文 · 这条评论出自</h3>
      <div class="quote muted">${esc(ctx.post.title || ctx.post.post_id)}</div>
      ${(ctx.siblings || []).map((s) => `<div class="ctx">${esc(s.content)}
        <span style="color:var(--tx3)">（${s.like_count} 赞）</span></div>`).join('')}
      </div>`;
  }

  const sim = (d.similar || []).length ? `<div class="sect"><h3>同类证据 · 共享 ≥2 个标签的其他笔记
      <span class="sp">${(d.similar || []).length} 篇</span></h3>
      ${(d.similar || []).map((s) => `<div class="ctx">${esc((s.text || '').slice(0, 80))}
        <span style="color:var(--tx3)">（共享 ${s.shared} 个标签 · 该帖 ${s.items} 条）</span></div>`).join('')}
      </div>`
    : `<div class="sect"><h3>同类证据</h3><div class="ctx" style="color:var(--tx3)">没有同类笔记。</div></div>`;

  const evs = (d.events || []).map((e) => `<div class="ev">
      <span class="w">${esc(shortTime(e.at))}</span>
      <span class="b">${esc(e.actor || '')} ${e.action === 'claim' ? evClaim(e)
        : `<b>${esc(actLabel(e.action))}</b>${e.from_value || e.to_value ? esc(fmtVal(e)) : ''}`}${e.note ? ' · ' + esc(e.note) : ''}</span>
    </div>`).join('') || '<div class="ctx" style="color:var(--tx3)">还没有操作记录。</div>';

  // 命中哪些追踪项 = 这条反馈会被哪根趋势线数进去、该找哪个团队。
  // 做成可点的：从这里能直接跳到"这个镜头下的全部条目"——
  // 一条 P0 是不是普遍现象，看它旁边那条线比看它自己的赞数准得多。
  const tks = d.trackers || [];
  const trkLine = tks.length
    ? tks.map((x) => `<span class="chip trk act" data-gotrk="${esc(x.id)}"
        title="看这个追踪项下的全部条目">${esc(x.name)}
        ${x.owner ? `<span class="c">${esc(x.owner)}</span>` : ''}</span>`).join(' ')
    : '<span class="chip none">没有命中任何追踪项</span>';

  dockMount('insight', d.insight_id, openDetail, `
      <div class="dh">
        <div style="flex:1;min-width:0">
          <h2>${esc(d.title || d.text.slice(0, 40))}</h2>
          <div style="font-size: 13px;color:var(--tx3);margin-top:4px">
            ${d.item_type === 'post' ? '笔记' : '评论'} · ${esc(d.time)} · ${d.like_count} 赞
            ${d.url ? ` · <a href="${esc(d.url)}" target="_blank" rel="noopener">原帖${EXT_ICON}</a>` : ''}
          </div>
        </div>
      </div>
      <div class="db">
        <div class="sect"><h3>原文</h3><div class="quote">${esc(d.text)}</div></div>
        ${ctxHtml}
        <div class="sect"><h3>标签${infoI('手动加的标签不会替换规则打的同类标签；撤销时不区分来源。点标签上的 × 撤销。')}</h3>${tagLines}</div>
        ${sim}
        <div class="sect"><h3>负责人 / 状态</h3>
          <div class="kv">
            <dt>负责人</dt><dd>
              <input type="text" id="downer" list="ownerlist" value="${esc(d.owner || '')}"
                     placeholder="未认领，填名字即认领" style="width:170px">
              <datalist id="ownerlist">
                ${[...new Set([...(S.meta.owners || []), S.actor, d.owner].filter(Boolean))]
                  .map((o) => `<option value="${esc(o)}"></option>`).join('')}
              </datalist>
              <button class="btn sm" id="dclaims" style="margin-left:6px">保存</button>
              <span style="color:var(--tx3);font-size: 13px;margin-left:6px">回车也可以</span>
            </dd>
            <dt>状态</dt><dd><span class="st ${stClass(d.status_id)}">${esc(d.status)}</span></dd>
            <dt>追踪项</dt><dd>${trkLine}</dd>
            <dt>最近改动</dt><dd>${d.updated_at ? esc(shortTime(d.updated_at)) + ' · ' + esc(d.updated_by || '') : '—'}</dd>
            <dt>来源</dt><dd>${esc(d.source || '—')}${d.keyword ? ' · ' + esc(d.keyword) : ''}</dd>
          </div>
        </div>
        <div class="sect"><h3>备注</h3>
          <textarea id="dnote" rows="3" style="width:100%" placeholder="为什么认领 / 为什么标不处理，写给人看的话">${esc(d.note || '')}</textarea>
        </div>
        <div class="sect"><h3>操作日志</h3>${evs}</div>
      </div>
      <div class="df">
        <select id="dstatus">
          ${S.meta.statuses.map((s) =>
            `<option value="${esc(s.id)}" ${d.status_id === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
        </select>
        <button class="btn" id="dsave">保存备注</button>
        <button class="btn ${d.status_id === 'st.wontfix' ? '' : 'danger'}" id="dwont">不处理</button>
      </div>
  `);

  // 抽屉里那条追踪项点一下 → 跳到"这个镜头下的全部条目"。
  // 从一条 P0 出发想问的是"这条是不是普遍现象"，所以跳过去的是**整个镜头**
  // （不带这边正在用的筛选）—— 带着"只看未认领"过去会把答案截掉一半。
  $('#dock').querySelectorAll('[data-gotrk]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.gotrk;
      closeDrawer();
      go('insights', { tracker: id });
    });
  });

  const claimTo = async () => {
    const owner = $('#downer').value.trim();
    if (!owner) { toast('填个负责人名字', true); return; }
    if (owner === (d.owner || '')) { toast('负责人没变'); return; }
    await post(`/api/insights/${encodeURIComponent(d.insight_id)}/claim`, { owner, actor: S.actor });
    // 三个词说三件事（§3.5.4）：自己接手是认领，把池里的推出去是分配，把名下（自己的
    // 或改派别人的）换人是转交。Dock 这里是快路径，理由走列表 / 批量条的弹层留。
    toast(owner === S.actor
      ? (d.owner ? `已认领（原负责人 ${d.owner}）` : '已认领：' + owner)
      : !d.owner
        ? '已分配给 ' + owner
        : d.owner === S.actor
          ? '已转交给 ' + owner
          : `负责人已改：${d.owner} → ${owner}`);
    await afterWrite(d.insight_id);
  };
  $('#dclaims').addEventListener('click', claimTo);
  $('#downer').addEventListener('keydown', (e) => { if (e.key === 'Enter') claimTo(); });

  $('#dstatus').addEventListener('change', async (e) => {
    await post(`/api/insights/${encodeURIComponent(d.insight_id)}/status`,
               { status_id: e.target.value, actor: S.actor });
    toast('状态已改为 ' + statusLabel(e.target.value));
    await afterWrite(d.insight_id);
  });

  $('#dsave').addEventListener('click', async () => {
    await post(`/api/insights/${encodeURIComponent(d.insight_id)}/note`,
               { note: $('#dnote').value, actor: S.actor });
    toast('备注已保存');
    await afterWrite(d.insight_id);
  });

  $('#dwont').addEventListener('click', async () => {
    const note = $('#dnote').value.trim();
    if (!note) { toast('先写一句为什么不处理，再点这个按钮', true); $('#dnote').focus(); return; }
    await post(`/api/insights/${encodeURIComponent(d.insight_id)}/status`,
               { status_id: 'st.wontfix', actor: S.actor, note });
    toast('已标记为不处理');
    await afterWrite(d.insight_id);
  });

  $('#dock').querySelectorAll('[data-untag]').forEach((x) => {
    x.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await post(`/api/insights/${encodeURIComponent(d.insight_id)}/tag`,

                 { axis: x.dataset.untag, value: x.dataset.v, op: 'remove', actor: S.actor });
      toast('已撤销标签');
      await afterWrite(d.insight_id);
    });
  });

  $('#dock').querySelectorAll('.addtag').forEach((sel) => {
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      await post(`/api/insights/${encodeURIComponent(d.insight_id)}/tag`,
                 { axis: sel.dataset.ax, value: sel.value, op: 'add', actor: S.actor });
      toast('已加标签');
      await afterWrite(d.insight_id);
    });
  });
}


async function afterWrite(id) {
  await refreshCounters();
  // 洞察池的抽屉可以从工作台打开（点摘要）。写完之后刷哪一页，要跟着当前页走 ——
  // 在工作台上重新 loadInsights() 会往一个不存在的 #list 里写，整条写入链就断了。
  if (S.page === 'workbench') await loadWorkbench();
  else if (S.page === 'pipeline') await loadOps();
  else await loadInsights();
  await openDetail(id, true);
}

function actLabel(a) {
  return { claim: '认领', status: '改状态', note: '写备注', tag: '改标签', severity: '改严重度', flag: '标记' }[a] || a;
}

// claim 事件的动词跟着语义走（§3.5.4 的对照表落到日志上）：
//   to == actor → 认领（自愿契约）；to 为空 → 退回未认领；
//   to != actor 且 from 为空 → 分配给；from 有值 → 转交给。
// 日志是写给人看的凭据，"家园 分配给 履约"和"家园 认领"必须是两句话——
// 出争议的时候"谁把什么推给了谁"比"现在归谁"更有用，所以转交要带上原负责人。
function evClaim(e) {
  const to = e.to_value || '', from = e.from_value || '';
  if (!to) return '<b>退回未认领</b>';
  if (to === e.actor) return from ? `<b>认领</b>（原 ${esc(from)}）` : '<b>认领</b>';
  return `<b>${from ? '转交给' : '分配给'}</b> ${esc(to)}${from ? `（原 ${esc(from)}）` : ''}`;
}

function fmtVal(e) {
  const f = e.from_value, t = e.to_value;
  const L = (v) => statusLabel(v) !== v ? statusLabel(v) : (valLabel('experience', v) !== v ? valLabel('experience', v) : v);
  if (e.action === 'status') return `：${L(f) || '—'} → ${L(t)}`;
  if (e.action === 'claim') return `：${f || '未认领'} → ${t}`;
  if (e.action === 'severity') return `：${f ? valLabel('severity', f) : '未识别'} → ${t ? valLabel('severity', t) : '未识别'}`;
  if (e.action === 'tag') return `：${valLabel('experience', t) !== t ? valLabel('experience', t) : t}`;
  return '';
}

function shortTime(s) {
  if (!s) return '';
  return String(s).replace('T', ' ').slice(5, 16);
}

// ---------------------------------------------------------------- 页面 5：跟进看板
//
// 为什么卡片是主题不是条目：354 条内容拖来拖去没有意义，
// 「前端首页这次改版」才是一个能排期、能验收、能对人负责的东西。
//
// 为什么不做拖拽：这个板子本身就是横向滚动容器，按下拖拽和滚动抢手势，
// 触控板上基本没法用；更关键的是状态流转在这里要带理由（「不处理」必须写一句），
// 拖拽收不到理由，最后一定退化成"拖过去再点开补一句"——比直接选还多一步。
// 用 <select> 反而键盘可用、触屏可用、还能顺手把改理由的入口一起带出来。

const FLAGS = [
  { k: 'blind_p0', cls: 'blind', lbl: 'P0 没人看过',
    why: '有 P0 未闭环，这张卡还没登记状态，可能还没人看过' },
  { k: 'orphan_p0', cls: 'orphan', lbl: 'P0 没落到人',
    why: '登记了状态，但还没有负责人' },
  { k: 'stale', cls: 'stale', lbl: '停滞',
    why: '停在推进态超过阈值天数没动过' },
  { k: 'reopened', cls: 'reopened', lbl: '修复后复发',
    why: '宣布修复/回帖之后又冒出了新的未闭环 P0' },
  { k: 'diverged', cls: 'diverged', lbl: '口径分叉',
    why: '体验域和追踪项登记的状态不一致' },
];

const FLAG_RANK = ['blind_p0', 'orphan_p0', 'stale', 'reopened', 'diverged'];
const themeId = (c) => `${c.kind}:${c.value}`;
const flagged = (c) => FLAG_RANK.some((k) => c[k]);

function allCards() {
  return (S.b.data ? S.b.data.lanes : []).reduce((a, ln) => a.concat(ln.cards), []);
}

function boardStatuses() {
  return (S.b.meta && S.b.meta.statuses) || S.meta.statuses || [];
}

async function renderBoardPage() {
  $('#main').innerHTML = `
    <div class="head">
      <div>
        <h1>跟进看板</h1>
        <div class="sub" id="blede">正在加载…</div>
      </div>
      <div class="rt" id="brt"></div>
    </div>
    <div class="boardbar" id="bbar"></div>
    <div class="board" id="board"><div class="empty">正在加载…</div></div>`;
  if (S.b.data) { renderBoardBar(); renderLanes(); }
  await loadBoard();
}

async function loadBoard() {
  syncHash('board');
  const p = new URLSearchParams();
  if (S.b.kind) p.set('kind', S.b.kind);
  // 口径跟着 URL 走：从看板点「未登记 8」过来时若换成当前口径算，
  // 那里的 8 和这里的 8 就不是同一批卡片 —— 两个页面都正常，只是尺子不同。
  if (S.version) p.set('version', S.version);
  p.set('include_empty', S.b.includeEmpty ? '1' : '0');
  try {
    const jobs = [get('/api/board?' + p.toString())];
    if (!S.b.meta) jobs.push(get('/api/board/meta'));
    const [data, meta] = await Promise.all(jobs);
    S.b.data = data;
    if (meta) S.b.meta = meta;
    renderBoardBar();
    renderLanes();
    if (S.pendingOpen) { const id = S.pendingOpen; S.pendingOpen = ''; openCard(id, true); }
    renderNav();
    const lede = $('#blede');
    if (lede) {
      const t = data.totals;
      const bits = [`<b>${t.themes}</b> 个主题`];
      if (t.unregistered) bits.push(`<b>${t.unregistered}</b> 个还没登记过状态`);
      if (t.blind_p0) bits.push(`<span style="color:var(--p0)">${t.blind_p0} 个有 P0 却没人看过</span>`);
      if (t.stale) bits.push(`<span style="color:var(--p1)">${t.stale} 个停滞超 ${data.stale_days} 天</span>`);
      lede.innerHTML = bits.join(' · ') + ` · 池内 ${esc(data.pool.total)} 条内容`;
    }
  } catch (e) {
    const b = $('#board');
    if (b) b.innerHTML = `<div class="empty"><b>看板加载失败</b>${esc(e.message)}</div>`;
  }
}

function renderBoardBar() {
  const el = $('#bbar');
  if (!el || !S.b.data) return;
  const owners = [...new Set(allCards().map((c) => c.owner || ''))].sort();
  const named = owners.filter(Boolean);
  const hasNone = owners.includes('');
  // 芯片上的数要跟"点下去会剩几张"一致，所以按**除状态以外**的筛选算。
  // 把状态也算进去的话，选了「待评估」之后其它泳道的数会全掉成 0 —— 芯片看着像失效了。
  const pool = visibleCards(true);
  const laneN = {};
  pool.forEach((c) => { laneN[c.lane] = (laneN[c.lane] || 0) + 1; });
  const lanes = S.b.data.lanes || [];

  el.innerHTML = `
    <label class="chk">主题类型
      <select id="bKind">
        <option value="">全部</option>
        ${(S.b.meta ? S.b.meta.kinds : [{ id: 'exp', label: '体验域' }, { id: 'trk', label: '追踪项' }])
          .map((k) => `<option value="${esc(k.id)}" ${S.b.kind === k.id ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}
      </select></label>
    <label class="chk">负责人
      <select id="bOwner">
        <option value="">全部</option>
        ${named.map((o) => `<option value="${esc(o)}" ${S.b.owner === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        ${hasNone ? `<option value="__none__" ${S.b.owner === '__none__' ? 'selected' : ''}>未认领</option>` : ''}
      </select></label>
    ${'' /* 状态这一格是为了让"从看板上点过来的筛选"看得见：筛了却看不出来筛了什么，
           看的人会把"只显示了 11 张卡"当成板子上就只有 11 张。
           做成多选是因为泳道筛选天生多值：看板上「待跟进 5」点过来就是 3 条泳道一起选，
           单选控件装不下它，只能显示成"全部"或者只落一条 —— 两种都是数字对不上。 */}
    <div class="bstatus"><span class="lb">状态</span>
      <span class="fchips" id="bStatus">
        ${lanes.map((ln) => `<span class="fchip ${S.b.status.includes(ln.lane_id) ? 'on' : ''}"
          data-lane="${esc(ln.lane_id)}" title="${esc(ln.hint || '')}">${esc(ln.label)}<span class="c">${laneN[ln.lane_id] || 0}</span></span>`).join('')}
        ${S.b.status.length ? '<span class="fchip clr" data-lane="__all__">全部</span>' : ''}
      </span></div>
    <label class="chk"><input type="checkbox" id="bFlag" ${S.b.onlyFlagged ? 'checked' : ''}> 只看有异常的</label>
    <label class="chk"><input type="checkbox" id="bEmpty" ${S.b.includeEmpty ? 'checked' : ''}> 含没有内容的主题</label>
    <span class="sp">
      <button class="btn sm" id="bReload">刷新</button>
    </span>`;

  $('#bKind').addEventListener('change', (e) => { S.b.kind = e.target.value; loadBoard(); });
  $('#bOwner').addEventListener('change', (e) => { S.b.owner = e.target.value; renderLanes(); });
  el.querySelectorAll('#bStatus .fchip').forEach((ch) => ch.addEventListener('click', () => {
    const lane = ch.dataset.lane;
    if (lane === '__all__') S.b.status = [];
    else S.b.status = S.b.status.includes(lane)
      ? S.b.status.filter((x) => x !== lane)
      : S.b.status.concat([lane]);
    // 芯片自己的选中态在这一层，所以两个都要重画：先画条、再画卡片（它顺带写 URL）。
    renderBoardBar();
    renderLanes();
  }));
  $('#bFlag').addEventListener('change', (e) => { S.b.onlyFlagged = e.target.checked; renderLanes(); });
  $('#bEmpty').addEventListener('change', (e) => { S.b.includeEmpty = e.target.checked; loadBoard(); });
  $('#bReload').addEventListener('click', loadBoard);
}

// `skipStatus` 只给芯片的计数用（见 renderBoardBar）。
function visibleCards(skipStatus) {
  const { kind, owner, onlyFlagged, status } = S.b;
  return allCards().filter((c) => {
    if (kind && c.kind !== kind) return false;
    if (owner === '__none__' && c.owner) return false;
    if (owner && owner !== '__none__' && c.owner !== owner) return false;
    // 泳道就是状态。看板上「未登记 11」那一格点过来就是按它筛 ——
    // 少了这一条，页面会显示全部 18 张卡，而看的人以为自己点的是 11。
    if (!skipStatus && status.length && !status.includes(c.lane)) return false;
    if (onlyFlagged && !flagged(c)) return false;
    return true;
  });
}

function renderLanes() {
  const el = $('#board');
  if (!el || !S.b.data) return;
  // 看板的筛选一半走服务端（类型 / 含空主题），一半在本地（负责人 / 状态 / 只看异常）。
  // URL 同步放在这里：两条路最后都汇到 renderLanes，放一处就不会漏。
  syncHash('board');
  const cards = visibleCards();

  // 计数在客户端重算：泳道头部显示的数字必须是"你现在看到的这几张"，
  // 而不是"全量里有多少"——后者会让人以为筛选没生效。
  // 筛了状态就只画这几条泳道。留着没选的那几条会变成一排"空"列 ——
  // 泳道顺序是推进漏斗，看的是"走到哪一步了"，不是"还有几列空着"。
  const shown = S.b.status.length
    ? S.b.data.lanes.filter((ln) => S.b.status.includes(ln.lane_id))
    : S.b.data.lanes;
  const lanes = shown.map((ln) => {
    const inLane = cards.filter((c) => c.lane === ln.lane_id);
    return {
      lane_id: ln.lane_id, label: ln.label, hint: ln.hint, cards: inLane,
      count: inLane.length,
      items: inLane.reduce((a, c) => a + c.total_items, 0),
      p0: inLane.reduce((a, c) => a + c.p0_open, 0),
      stale: inLane.filter((c) => c.stale).length,
    };
  });

  if (!cards.length) {
    el.innerHTML = `<div class="empty" style="flex:1"><b>这个筛选下没有主题</b>
      ${S.b.owner || S.b.kind || S.b.onlyFlagged || S.b.status.length
        ? '换个筛选条件看看，或者取消「只看有异常的」。' : ''}</div>`;
    return;
  }

  el.innerHTML = lanes.map((ln) => {
    // 空泳道默认展开；头上给一个「收起」，收成 48px 窄条（列名 + 0），再点展开。
    // 「未登记」永不收合 —— 它是这块板存在的理由（ADMIN-IA §5.3），空着也要让人看见"空"。
    const canCollapse = !ln.cards.length && ln.lane_id !== '__none__';
    if (canCollapse && S.b.collapsed.has(ln.lane_id)) {
      return `<div class="lane collapsed" data-lane="${esc(ln.lane_id)}" role="button" tabindex="0"
        title="${esc(ln.label)} · 这个筛选下没有主题，点击展开">
        <span class="vl">${esc(ln.label)}</span><span class="n">0</span></div>`;
    }
    const hot = ln.cards.some((c) => c.blind_p0 || c.orphan_p0);
    const meta = [];
    if (ln.items) meta.push(`<span>${ln.items} 条内容</span>`);
    if (ln.p0) meta.push(`<span class="warn">P0 ${ln.p0}</span>`);
    if (ln.stale) meta.push(`<span class="warn">停滞 ${ln.stale}</span>`);
    return `<div class="lane ${hot ? 'hot' : ''}" data-lane="${esc(ln.lane_id)}">
      <div class="lh">
        <div class="t"><b>${esc(ln.label)}</b><span class="n">${ln.count}</span>${
          canCollapse ? `<button type="button" class="lane-fold" data-collapse="${esc(ln.lane_id)}" title="收起这条空泳道">收起</button>` : ''}</div>
        <div class="m">${meta.join('')}</div>
        <div class="hint">${esc(ln.hint)}</div>
      </div>
      <div class="body">${ln.cards.length
        ? ln.cards.map(cardHtml).join('')
        : '<div class="empty-lane">空</div>'}</div>
    </div>`;
  }).join('');

  el.querySelectorAll('.lane.collapsed').forEach((ln) => {
    const open = () => { S.b.collapsed.delete(ln.dataset.lane); renderLanes(); };
    ln.addEventListener('click', open);
    ln.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  el.querySelectorAll('[data-collapse]').forEach((b) => {
    b.addEventListener('click', (ev) => { ev.stopPropagation(); S.b.collapsed.add(b.dataset.collapse); renderLanes(); });
  });
  el.querySelectorAll('.bcard').forEach((c) => {
    c.addEventListener('click', (ev) => {
      if (ev.target.closest('select')) return;   // 改状态不该顺手打开详情
      openCard(c.dataset.theme);
    });
  });
  el.querySelectorAll('select[data-st]').forEach((sel) => {
    sel.addEventListener('click', (ev) => ev.stopPropagation());
    sel.addEventListener('change', () => doThemeStatus(sel.dataset.st, sel.value, sel));
  });
}

function cardHtml(c) {
  const tid = themeId(c);
  const flags = FLAGS.filter((f) => c[f.k]).map((f) =>
    `<span class="flag ${f.cls}" title="${esc(f.why)}">${esc(f.lbl)}${f.k === 'reopened' ? ' ' + c.reopened_items : ''}</span>`)
    .join('');
  const unreg = (c.lane === '__none__' && !flags)
    ? '<span class="flag unreg" title="还没有人判过：要做，还是不做">未登记状态</span>' : '';

  const trks = (c.trackers || []).map((t) => {
    const mx = Math.max.apply(null, t.series.concat([1]));
    const spark = t.series.slice(-8).map((v) =>
      `<i style="height:${Math.max(2, Math.round(v / mx * 11))}px"></i>`).join('');
    const dir = t.trend === '恶化' ? 'up' : (t.trend === '好转' ? 'dn' : '');
    const title = [t.name, t.trend ? '走势' + t.trend : '', `本周 ${t.current} 条`,
                   t.alert ? '预警：' + (t.alert_reasons || []).join('；') : ''].filter(Boolean).join(' · ');
    return `<div class="trk" title="${esc(title)}">
      <span class="tn">${esc(t.name)}</span>
      ${t.trend ? `<span class="${dir}">${esc(t.trend)}</span>` : ''}
      <span class="spark">${spark}</span></div>`;
  }).join('');

  const opts = boardStatuses().map((s) =>
    `<option value="${esc(s.id)}" ${c.status_id === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('');

  return `<div class="bcard${c.owner ? '' : ' unowned'}" data-theme="${esc(tid)}">
    <div class="nm"><span>${esc(c.name)}</span><span class="kd">${esc(c.kind_label)}</span></div>
    ${flags || unreg ? `<div class="flags">${flags}${unreg}</div>` : ''}
    <div class="row">
      <span class="chip gray">${c.total_items} 条</span>
      ${c.p0_open
        // 有未闭环 P0 时不再另打严重度 chip —— 那和「P0 N」说的是同一件事
        ? `<span class="chip p0">P0 ${c.p0_open}</span>`
        : (c.severity ? `<span class="chip ${SEV_CLASS[c.severity] || 'gray'}">${esc(valLabel('severity', c.severity))}</span>` : '')}
    </div>
    <div class="row">
      ${c.owner
        ? `<span class="own"><i class="av" aria-hidden="true">${esc(c.owner.slice(0, 1))}</i>${esc(c.owner)}</span>`
        : '<span class="own none"><i class="av none" aria-hidden="true"></i>未认领</span>'}
      ${c.dwell_days ? `<span class="sm dim">· ${c.dwell_days} 天没动</span>` : ''}
    </div>
    ${c.sample ? `<div class="smp">${esc(c.sample)}</div>` : ''}
    ${trks}
    ${S.canWrite ? `<select class="stsel" data-st="${esc(tid)}">
        <option value="">— 改状态 —</option>${opts}</select>` : ''}
  </div>`;
}

async function doThemeStatus(tid, sid, sel) {
  const card = allCards().find((c) => themeId(c) === tid);
  if (!sid) return;
  // 「不处理」必须写理由，而且得是当下的理由。所以这里不直接提交 ——
  // 一律把人送进详情抽屉，理由是要写给人看的，塞进一个 prompt 里最后都会变成"不做了"三个字。
  if (sid === 'st.wontfix' && card && card.status_id !== 'st.wontfix') {
    toast('标为「不处理」要先写一句理由', true);
    if (sel) sel.value = card.status_id || '';
    return openCard(tid, true);
  }
  try {
    const r = await post(`/api/board/${encodeURIComponent(tid)}/status`,
                         { status_id: sid, actor: S.actor });
    toast('已改为 ' + statusLabel(sid)
      + (r.synced_trackers && r.synced_trackers.length
          ? `，${r.synced_trackers.length} 个追踪项一起更新` : ''));
    await loadBoard();
    if (S.b.detail && themeId(S.b.detail) === tid) await openCard(tid, true);
  } catch (e) {
    toast(e.message, true);
    await loadBoard();
  }
}

// ---------------------------------------------------------------- 卡片详情

async function openCard(tid, quiet) {
  try {
    const d = await get('/api/board/' + encodeURIComponent(tid));
    S.b.detail = d;
    drawCardDrawer(d);
    document.querySelectorAll('.bcard').forEach((c) =>
      c.classList.toggle('pick', c.dataset.theme === tid));
    // Dock 打开后板变窄，选中的卡可能滚出了横向视野；把它带回来。
    const pick = document.querySelector('.bcard.pick');
    if (pick && pick.scrollIntoView) pick.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } catch (e) {
    if (!quiet) toast(e.message, true);
  }
}

function drawCardDrawer(d) {
  const laneLabel = ((S.b.meta && S.b.meta.lanes) || []).find((l) => l.lane_id === d.lane);
  const statuses = boardStatuses();

  const acts = (d.next_actions || []).length
    ? `<ul class="nactions">${d.next_actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
    : '<div class="ctx" style="color:var(--tx3)">没有异常。</div>';

  const p0 = (d.p0_items || []).length
    ? `<div class="sect"><h3>未闭环 P0 <span class="sp">${d.p0_items.length} 条</span></h3>
        <div class="p0list">${d.p0_items.map((i) => `<div class="it">${esc(i.text)}
          <div class="u">${esc(i.time)} · ${i.like_count} 赞 · ${esc(i.owner || '未认领')}</div></div>`).join('')}</div></div>`
    : '';

  const trks = (d.trackers || []).length
    ? `<div class="sect"><h3>挂在这个主题上的追踪项</h3>
        ${d.trackers.map((t) => `<div class="ctx"><b>${esc(t.name)}</b>
          ${t.trend ? `走势 ${esc(t.trend)}` : ''} · 本周 ${t.current} 条 / ${t.unique_posts} 篇
          ${t.alert ? `<span style="color:var(--p0)">${iconSvg('alert', 14, 'inl')}${esc((t.alert_reasons || []).join('；'))}</span>` : ''}
          <div style="color:var(--tx3)">${esc(t.filter_desc || '')}</div></div>`).join('')}
        <div class="note" style="margin-top:8px">在这里改状态，追踪中心看到的是同一个。</div></div>`
    : '';

  const items = (d.items || []).length
    ? `<div class="sect"><h3>主题下的内容 <span class="sp">显示 ${d.items.length} / ${d.items_total} 条</span></h3>
        ${d.items.map((i) => `<div class="ctx" data-item="${esc(i.insight_id)}" style="cursor:pointer">
          ${esc(i.text)}<span style="color:var(--tx3)">（${esc(i.time)} · ${i.like_count} 赞 ·
          ${esc(i.owner || '未认领')} · ${esc(statusLabel(i.status_id))}）</span></div>`).join('')}</div>`
    : '<div class="sect"><h3>主题下的内容</h3><div class="ctx" style="color:var(--tx3)">这个主题下还没有内容。</div></div>';

  const evs = (d.events || []).map((e) => `<div class="ev">
      <span class="w">${esc(shortTime(e.at))}</span>
      <span class="b">${esc(e.actor || '')} <b>${esc(e.action === 'theme_status' ? '改主题状态' : e.action)}</b>
        ${e.from_value || e.to_value
          ? '：' + esc(statusLabel(e.from_value) || '未登记') + ' → ' + esc(statusLabel(e.to_value)) : ''}
        ${e.note ? ' · ' + esc(e.note) : ''}</span></div>`).join('')
    || '<div class="ctx" style="color:var(--tx3)">还没有操作记录。</div>';

  dockMount('theme', themeId(d), openCard, `
      <div class="dh">
        <div style="flex:1;min-width:0">
          <h2>${esc(d.name)}</h2>
          <div style="font-size: 13px;color:var(--tx3);margin-top:4px">
            ${esc(d.kind_label)} · 当前在「${esc(laneLabel ? laneLabel.label : d.status)}」
            ${d.updated_at ? ' · 上次改动 ' + esc(shortTime(d.updated_at)) : ' · 从没登记过状态'}
          </div>
        </div>
      </div>
      <div class="db">
        <div class="sect"><h3>下一步该做什么</h3>${acts}</div>
        <div class="kv" style="margin-bottom:18px">
          <dt>负责人</dt><dd>${esc(d.owner || '未认领')}
            ${d.owner_source === 'config' ? '<span style="color:var(--tx3)">（追踪项配置里预设的，还没有人正式认领）</span>' : ''}
            ${d.owner_source === 'none' && d.owner ? '<span style="color:var(--tx3)">（来源不明）</span>' : ''}</dd>
          <dt>条目</dt><dd>${d.total_items} 条（${d.unclaimed_share}% 还没在洞察池里认领）· ${d.p0_open} 条 P0 未闭环</dd>
        </div>
        ${p0}
        ${trks}
        ${items}
        <div class="sect"><h3>备注 <span class="sp">「不处理」必须写理由</span></h3>
          <textarea id="bnote" rows="3" style="width:100%"
            placeholder="为什么这么定：排到哪个版本、为什么不处理、和谁对齐过">${esc(d.note || '')}</textarea></div>
        <div class="sect"><h3>操作日志</h3>${evs}</div>
      </div>
      <div class="df">
        <select id="bst">
          <option value="" ${!d.status_id ? 'selected' : ''}>— 未登记 —</option>
          ${statuses.map((s) =>
            `<option value="${esc(s.id)}" ${d.status_id === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
        </select>
        <input type="text" id="bowner" value="${esc(d.owner || '')}" placeholder="负责人"
               style="width:96px" list="bownerlist">
        <datalist id="bownerlist">
          ${[...new Set([...(S.meta.owners || []), S.actor, d.owner].filter(Boolean))]
            .map((o) => `<option value="${esc(o)}"></option>`).join('')}
        </datalist>
        <button class="btn" id="bsave">保存</button>
        <button class="btn danger" id="bwont">不处理</button>
      </div>
  `);

  $('#dock').querySelectorAll('[data-item]').forEach((x) => {
    x.addEventListener('click', () => openDetail(x.dataset.item));
  });

  const save = async (status_id, forceNote) => {
    const raw = $('#bnote') ? $('#bnote').value.trim() : '';
    // 备注框里预填的是上一条备注。「不处理」要的是一句**当下**的理由，
    // 直接点按钮等于拿旧理由当新理由 —— 服务端会拒，这里先拦，别让人对着一个报错发愣。
    if (forceNote && d.status_id !== 'st.wontfix' && raw === (d.note || '').trim()) {
      toast(raw ? '请更新「不处理」的理由，框里还是上一条备注' : '先写一句为什么不处理', true);
      $('#bnote').focus();
      return;
    }
    const owner = $('#bowner').value.trim();
    const body = { status_id, actor: S.actor, note: raw };
    // owner 只在真的改过时才发：后端 None = 不动，"空串" = 清空，
    // 无条件发空串会把从追踪项继承来的负责人抹掉。
    if (owner !== (d.owner || '')) body.owner = owner;
    try {
      const r = await post(`/api/board/${encodeURIComponent(themeId(d))}/status`, body);
      toast('已保存'
        + (r.synced_trackers && r.synced_trackers.length
            ? `，${r.synced_trackers.length} 个追踪项一起更新` : ''));
      await loadBoard();
      await openCard(themeId(d), true);
    } catch (e) { toast(e.message, true); }
  };

  $('#bsave').addEventListener('click', () => {
    const sid = $('#bst').value;
    if (!sid) { toast('先选一个状态', true); return; }
    save(sid, false);
  });
  $('#bwont').addEventListener('click', () => save('st.wontfix', true));
}

// ---------------------------------------------------------------- 页面 1：工作台
//
// 和信息页的区别：信息页可以有很多行，工作台只能有几行 —— 超过一屏就不叫「今天该做什么」了。
// 所以整页是「一句话结论 + 四个数 + 两列待办」，目标是一屏内看完。
//
// 为什么每一行都带行内操作：需要跳三个页面才能认领，就没人认领（ADMIN-IA 定下的规矩）。
// 唯一必须跳走的是主题的「不处理」—— 它要写一句理由，而理由是写给人看的，
// 塞进一个 prompt 里最后都会退化成"不做了"三个字。
//
// 为什么整屏只发一个请求：优先级（口径漂移 > 采集停了 > P0 没人认领 > 我自己没判的 > 要拍板的主题）
// 是一句判断，不是五个数字的并置。让前端拿五个接口自己拼，这段判断就散进 UI 代码里了，
// 而它恰恰是这一页唯一有含量的部分。

async function renderWorkbenchPage() {
  $('#main').innerHTML = `
    <div class="head">
      <div>
        <h1>工作台</h1>
        <div class="sub" id="wblede">正在加载…</div>
      </div>
      <div class="rt" id="wbrt"></div>
    </div>
    <div id="wb"><div class="empty">正在加载…</div></div>`;
  // 有上一屏的数据就先画出来 —— 每次切回来都看一眼「正在加载」，而数据其实半秒就到，
  // 那一闪等于每次都在提醒人"这一页很慢"。第一次进来没缓存才会看到占位。
  if (S.wb) renderWorkbench();
  await loadWorkbench();
}

// 工作台每次换操作人都会重取整屏，慢请求盖掉快请求在这里是可见的错误（会显示上一个身份的待办）
let _wbSeq = 0;

async function loadWorkbench() {
  const seq = ++_wbSeq;
  try {
    const d = await get('/api/workbench?actor=' + encodeURIComponent(S.actor));
    if (seq !== _wbSeq) return;
    S.wb = d;
    // 只保留这一屏还列着的勾选：条目认领掉了就不该还算"已选"。
    const listed = new Set(((d.unclaimed_p0 && d.unclaimed_p0.items) || []).map((i) => i.insight_id));
    S.wbSel = new Set([...S.wbSel].filter((id) => listed.has(id)));
    renderWorkbench();
    renderNav();
  } catch (e) {
    const el = $('#wb');
    if (el) el.innerHTML = `<div class="empty"><b>工作台加载失败</b>${esc(e.message)}</div>`;
  }
}

// 导航角标要一个数，就只算一个数 —— 这个接口不查主题（见 workbench.summary 的说明）。
async function loadWbBadge() {
  try {
    // 三个轻量角标一起取。**都不查主题、不查列表、不重算影响面** ——
    // 挂整块 build() 等于每次导航都跑一遍主题聚合（18 个主题各查一次）
    // 或者把整库重打一遍标签，那是导航最不该付的代价。
    // 数据管道那个角标要说的是一件事：**有个作业在跑，或者有作业没跑成**。
    // 人切去别的页面干活，回来时不该靠记忆判断"那个采集跑完没有"。
    const [wb, ops, cfg, arc] = await Promise.all([
      get('/api/workbench/summary?actor=' + encodeURIComponent(S.actor)),
      get('/api/ops/summary'),
      get('/api/settings/summary'),
      get('/api/archive/summary'),
    ]);
    S.wbBadge = wb;
    S.opsBadge = ops;
    S.cfgBadge = cfg;
    S.arcBadge = arc;
    // 取到就得重画一次导航。少了这一句，认领完之后角标还挂着旧的 P0 数 ——
    // 而角标恰恰是"我这一下有没有生效"的第一反馈。顶栏的新鲜度点也吃这一份数据。
    renderNav();
    renderTopbar();
  } catch (e) { /* 角标刷不上不影响主流程 */ }
}

// 角标取数：优先用轻量接口的结果，没取到时退回整屏数据。
function wbUrgent() {
  const b = S.wbBadge || {};
  const w = S.wb || {};
  const p0 = b.unclaimed_p0 != null ? b.unclaimed_p0
    : (w.unclaimed_p0 ? w.unclaimed_p0.total : 0);
  const mine = b.mine_untriaged != null ? b.mine_untriaged
    : (w.mine ? w.mine.untriaged.total : 0);
  return { p0, mine };
}

function renderWorkbench() {
  const d = S.wb;
  const el = $('#wb');
  if (!el || !d) return;

  const h = d.headline || {};
  const mark = levelMark(h.level);

  const lede = $('#wblede');
  if (lede) {
    lede.innerHTML = `以「<b>${esc(d.actor || '我')}</b>」的身份看 · 生成于 ${esc((d.generated_at || '').replace('T', ' ').slice(5, 16))}`;
  }
  const rt = $('#wbrt');
  if (rt) {
    rt.innerHTML = `<button class="btn sm" id="wbReload">刷新</button>`;
  }

  // 口径漂移的明细只在真的有问题时展开。尺子不一致的时候，这一屏别的数字都不该被相信。
  const warns = (d.drift && d.drift.warnings) || [];
  const driftLines = warns.length
    ? `<div class="det">${warns.map((w) => '· ' + esc(w)).join('<br>')}</div>` : '';

  // 「今天先不管」：横幅收成一行，次日自动恢复。收的只是横幅 —— 下面的待办列表不动，
  // 该收的是"这句话今天不用再看"，不是"这些事今天不用做"。
  const today = new Date().toISOString().slice(0, 10);
  const snoozed = h.level && h.level !== 'ok' && localStorage.getItem('dd_wb_snooze') === today;
  const head = snoozed
    ? `<div class="wb-head snoozed">
        <div class="mk">${mark}</div>
        <div style="flex:1;min-width:0"><div class="tx">已收起到明天：${esc(h.text || '')}</div></div>
        <button type="button" class="lnk" id="wbUnsnooze">恢复</button>
      </div>`
    : `<div class="wb-head ${esc(h.level || 'ok')}">
        <div class="mk">${mark}</div>
        <div style="flex:1;min-width:0">
          <div class="tx">${esc(h.text || '')}</div>
          ${driftLines}
          ${h.kind === 'pipeline'
            ? '<div class="wb-jump"><a data-goto="pipeline">去数据管道看自检 →</a></div>' : ''}
        </div>
        ${h.level && h.level !== 'ok'
          ? '<button type="button" class="lnk" id="wbSnooze" title="今天不再显示这条横幅，明天恢复">今天先不管</button>' : ''}
      </div>`;
  el.innerHTML = `
    ${head}
    ${wbKpis(d)}
    <div class="wb-grid">
      <div>${wbLeftCol(d)}</div>
      <div>${wbRightCol(d)}</div>
    </div>`;

  if ($('#wbReload')) $('#wbReload').addEventListener('click', () => { loadWbBadge(); loadWorkbench(); });
  wireWorkbench();
}

function wbKpis(d) {
  const ns = d.north_star || {};
  const p0 = d.unclaimed_p0.total;
  const un = d.mine.untriaged;
  const mineP0 = un.by_severity['sev.p0'] || 0;
  const nd = d.themes.need_decision_total;
  const ndBlock = d.themes.need_decision.filter((t) => t.blocking).length;
  const f24 = d.fresh.windows.h24, f7 = d.fresh.windows.d7;

  const items = [
    { k: 'p0', lbl: '没人认领的 P0', val: p0, warn: p0 > 0,
      hint: p0 ? '' : '池子里没有没人管的 P0' },
    { k: 'mine', lbl: '等我分诊', val: un.total, warn: mineP0 > 0,
      hint: un.total ? `我名下还没判过的，其中 P0 ${mineP0} 条` : '我名下没有待分诊的' },
    { k: 'theme', lbl: '要拍板的主题', val: nd, warn: ndBlock > 0,
      hint: nd ? `有异常没人推动，其中 ${ndBlock} 个有 P0 却没人看过` : '没有卡住的主题' },
    { k: 'fresh', lbl: '新沉淀 · 近 24 小时', val: f24.total, warn: !!d.fresh.stale,
      hint: d.fresh.stale ? `超过 ${d.fresh.stale_threshold_hours} 小时没新内容了`
                          : `近 7 天 ${f7.total} 条，其中热点 ${f24.hot} 条` },
  ];

  const cards = items.map((it) => `
    <div class="kpi" data-wk="${it.k}" role="button" tabindex="0">
      <div class="lbl">${esc(it.lbl)}</div>
      <div class="val ${it.warn ? 'warn' : ''}">${esc(it.val)}</div>
      <div class="hint">${esc(it.hint)}</div>
    </div>`).join('');
  // 北极星连续三周为 0：整页变灰在规格里写的是"整页"，这里只灰数字那一排 ——
  // 该灰的是"别信这些数"，不是"别做这些事"（下面那些待办恰恰是唯一能把系统救回来的动作）。
  return `<div class="wb-kpis">${cards}</div>`;
}

function wbLeftCol(d) {
  const secs = [];

  // 1. 没人认领的 P0 —— 全页最该被点开的一块
  const p = d.unclaimed_p0;
  const pRest = p.total - p.items.length;
  // 勾选只认这一屏列出来的（"只选本页"，和洞察池同一条规矩 §12.6）；列表重取后旧勾选作废。
  const nSel = p.items.filter((i) => S.wbSel.has(i.insight_id)).length;
  secs.push(`<div class="wb-sec">
    <h2>没人认领的 P0 <span class="n${p.total ? ' p0' : ''}">${p.total}</span>
      <span class="sp">${p.items.length ? `
        <label class="chk"><input type="checkbox" id="wbAll" ${nSel && nSel === p.items.length ? 'checked' : ''}> 全选</label>
        <button class="btn sm" id="wbBulkClaim" ${nSel ? '' : 'disabled'}>认领已选给我${nSel ? ` (${nSel})` : ''}</button>
        <button class="btn sm" id="wbBulkAssign" ${nSel ? '' : 'disabled'}
          title="把这批 P0 分给别人（弹层里看得到每人负载），附一句理由">分配给…</button>`
        : '点摘要看原文，右边直接认领 / 改状态'}</span></h2>
    <div class="wb-body">
      ${p.items.length
        ? p.items.map((i) => wbItemRow(i, true)).join('')
          + (pRest > 0 ? `<div class="wb-more">还有 ${pRest} 条没列出来 ·
             <a data-goto="p0">去洞察池看全部 →</a></div>` : '')
        : wbClean('没有没人认领的 P0', '')}
    </div></div>`);

  // 2. 我名下。owner 是团队、使用者是人，所以这块多数时候是空的 —— 空了就整块不渲染，
  //    不让一个永远空着的模块占掉第一屏。
  const m = d.mine;
  if (m.untriaged.total || m.rolling.total) {
    const rest = m.untriaged.total - m.untriaged.items.length;
    secs.push(`<div class="wb-sec">
      <h2>我名下 · 还没判过 <span class="n">${m.untriaged.total}</span>
        <span class="sp">${m.rolling.total} 条在推进，今天不用动</span></h2>
      <div class="wb-body">
        ${m.untriaged.items.length
          ? m.untriaged.items.map((i) => wbItemRow(i, false)).join('')
          : '<div class="wb-more">没有待分诊的。</div>'}
        ${rest > 0 ? `<div class="wb-more">还有 ${rest} 条 ·
          <a data-goto="mine">去洞察池看全部 →</a></div>` : ''}
      </div></div>`);
  }

  return secs.join('');
}

function wbRightCol(d) {
  const secs = [];

  // 1. 需要拍板的主题（不按人过滤：这些卡的异常本身就意味着"没人管"）
  const t = d.themes.need_decision;
  const tRest = d.themes.need_decision_total - t.length;
  secs.push(`<div class="wb-sec">
    <h2>需要拍板的主题 <span class="n">${d.themes.need_decision_total}</span>
      </h2>
    <div class="wb-body">
      ${t.length ? t.map(wbThemeRow).join('')
        + (tRest > 0 ? `<div class="wb-more">还有 ${tRest} 个 ·
            <a data-goto="board">去跟进看板 →</a></div>` : '')
        : '<div class="wb-more">没有卡住的主题。</div>'}
    </div></div>`);

  // 2. 系统状态：北极星 + 采集新鲜度合成一张卡。它们回答的是同一个问题 ——
  //    "这套系统还活着吗"：北极星说"有没有人在用"，新鲜度说"有没有新东西进来"。
  //    以前是两块弱相关模块的堆叠，现在用分隔线分层，读的时候是一件事的两面。
  const f = d.fresh;
  const ns = d.north_star || {};
  const weeks = (ns.series || []).slice(-8);
  // 一整条 0 铺成八个小方块只会占掉三行，不如压成一行 —— 这一块要传达的就是"全是 0"。
  const strip = weeks.map((x) => `<span class="wk" title="${esc(x.week)}">${x.ticketed}</span>`).join('');
  const alive = !ns.dead && !f.stale;
  secs.push(`<div class="wb-sec" id="wbSys">
    <h2>系统状态
      <span class="sp ${alive ? '' : 'warn'}">${alive ? '正常' : (ns.dead ? '北极星连续三周为 0' : '采集可能已经停了')}</span></h2>
    <div class="wb-body pad">
      <div class="wb-sys-part">
        <div class="wb-sys-h">北极星</div>
        ${ns.dead
          ? `<div style="font-size: 13px;color:var(--p0)">连续三周为 0：这三周没有一条洞察被认领成工单。<br>
               <a data-goto="p0">去认领没人管的 P0 →</a></div>`
          : `<div style="font-size: 13px">这周 <b>${esc(ns.current || 0)}</b> 条洞察变成了有 owner 的工单。</div>`}
        <div class="wb-strip" title="${esc(ns.definition || '')}">${strip}</div>
        <div style="font-size: 12px;color:var(--tx3);margin-top:6px">最近 8 周，左旧右新</div>
      </div>
      <div class="wb-sys-part">
        <div class="wb-sys-h">采集新鲜度
          ${f.stale ? '<span style="color:var(--p0)">可能已经停了</span>' : ''}</div>
        <div class="wb-fresh">
          <div class="it"><b>${f.windows.h24.total}</b> <span class="u">近 24 小时</span></div>
          <div class="it"><b>${f.windows.d7.total}</b> <span class="u">近 7 天</span></div>
        </div>
        <div style="font-size: 13px;color:var(--tx3);margin-top:7px">
          最近一次新内容：${esc(f.latest_at || '—')}${f.stale_hours != null ? `（${Math.round(f.stale_hours)} 小时前）` : ''}
          · 共 ${f.seen_total} 条
        </div>
        ${f.stale ? `<div style="font-size: 13px;color:var(--p0);margin-top:6px">
          超过 ${f.stale_threshold_hours} 小时没有新内容，这一屏的数字可能停在那一刻。
          <a data-goto="pipeline">去数据管道看自检 →</a></div>` : ''}
      </div>
    </div></div>`);

  return secs.join('');
}

function wbItemRow(it, canClaim) {
  const sev = it.severity ? `<span class="chip ${SEV_CLASS[it.severity] || 'gray'}">${esc(valLabel('severity', it.severity))}</span>` : '';
  const statuses = boardStatuses();
  return `<div class="wb-row">
    ${canClaim ? `<input type="checkbox" class="wbsel" data-wbsel="${esc(it.insight_id)}" ${S.wbSel.has(it.insight_id) ? 'checked' : ''}>` : ''}
    <div class="body">
      <div class="sum" data-open="${esc(it.insight_id)}">${esc(it.text)}</div>
      <div class="meta">
        ${sev}
        <span>${it.item_type === 'post' ? '笔记' : '评论'}</span>
        <span>${esc(it.time)}</span>
        <span>${it.like_count} 赞</span>
        <span>${esc(it.owner || '未认领')}</span>
        <span>${esc(statusLabel(it.status_id))}</span>
      </div>
    </div>
    <div class="acts">
      ${canClaim ? `<button class="btn sm" data-claim="${esc(it.insight_id)}">认领</button>` : ''}
      <select data-st="${esc(it.insight_id)}">
        <option value="">— 改状态 —</option>
        ${statuses.map((s) => `<option value="${esc(s.id)}" ${it.status_id === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
      </select>
    </div>
  </div>`;
}

const WB_BAR = { blind_p0: 'blind', orphan_p0: 'orphan', stale: 'stale', reopened: 'reopened', diverged: 'diverged' };

function wbThemeRow(t) {
  const statuses = boardStatuses();
  // 原因用和跟进看板同一套 flag chip；以前是左边一道色条 + 整行红字，两处说同一件事
  const chips = (t.flags || []).map((k, i) =>
    `<span class="flag ${WB_BAR[k] || ''}">${esc((t.flag_labels || [])[i] || '')}</span>`).join('');
  const bits = [];
  if (t.dwell_days) bits.push(`停了 ${t.dwell_days} 天`);
  bits.push(`${t.total_items} 条内容`);
  if (t.p0_open) bits.push(`${t.p0_open} 条 P0 未闭环`);
  return `<div class="wb-theme" data-theme="${esc(t.theme_id)}">
    <div style="flex:1;min-width:0">
      <div class="nm">${esc(t.name)}
        <span class="kd">${esc(t.kind_label)}${t.owner ? ' · ' + esc(t.owner) : ' · 未认领'}</span></div>
      ${chips ? `<div class="flags">${chips}</div>` : ''}
      <div class="fl">${chips ? '' : '<span class="calm">没有异常</span> · '}${esc(bits.join(' · '))}</div>
    </div>
    <div class="rt">
      <select data-tst="${esc(t.theme_id)}">
        <option value="">改状态</option>
        ${statuses.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}
      </select>
    </div>
  </div>`;
}

function wbClean(big, sm) {
  return `<div class="wb-clean"><div class="big">${esc(big)}</div>${sm ? `<div class="sm">${esc(sm)}</div>` : ''}</div>`;
}

function wireWorkbench() {
  const root = $('#wb');
  if (!root) return;

  root.querySelectorAll('[data-open]').forEach((x) =>
    x.addEventListener('click', () => openDetail(x.dataset.open)));

  root.querySelectorAll('[data-claim]').forEach((b) =>
    b.addEventListener('click', () => wbClaim(b.dataset.claim)));

  root.querySelectorAll('[data-st]').forEach((sel) =>
    sel.addEventListener('change', () => {
      if (sel.value) wbSetStatus(sel.dataset.st, sel.value);
    }));

  root.querySelectorAll('[data-tst]').forEach((sel) =>
    sel.addEventListener('change', () => {
      if (sel.value) wbThemeStatus(sel.dataset.tst, sel.value, sel);
    }));

  root.querySelectorAll('.wb-theme').forEach((x) =>
    x.addEventListener('click', (ev) => {
      if (ev.target.closest('.rt')) return;   // 点状态下拉框不该把人踢到看板去
      openThemeOnBoard(x.dataset.theme);
    }));

  root.querySelectorAll('[data-goto]').forEach((a) =>
    a.addEventListener('click', () => wbGoto(a.dataset.goto)));

  // 四个 KPI 都是入口，不是终点：点进去是把洞察池/看板按这一格的口径筛好。
  root.querySelectorAll('[data-wk]').forEach((x) => {
    x.addEventListener('click', () => wbKpiClick(x.dataset.wk));
    x.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wbKpiClick(x.dataset.wk); }
    });
  });

  // P0 池的批量认领。勾选状态存在 S.wbSel，只改头部计数，不整屏重取。
  root.querySelectorAll('[data-wbsel]').forEach((cb) =>
    cb.addEventListener('change', () => {
      if (cb.checked) S.wbSel.add(cb.dataset.wbsel); else S.wbSel.delete(cb.dataset.wbsel);
      wbSyncSel();
    }));
  const all = $('#wbAll');
  if (all) all.addEventListener('change', () => {
    S.wb.unclaimed_p0.items.forEach((i) => { if (all.checked) S.wbSel.add(i.insight_id); else S.wbSel.delete(i.insight_id); });
    root.querySelectorAll('[data-wbsel]').forEach((cb) => { cb.checked = all.checked; });
    wbSyncSel();
  });
  const bulk = $('#wbBulkClaim');
  if (bulk) bulk.addEventListener('click', wbBulkClaim);

  // 批量分配：周会 triage 的入口（§3.5.4）。这里勾的全是未认领 P0，所以 mode 固定 assign。
  const bulkA = $('#wbBulkAssign');
  if (bulkA) bulkA.addEventListener('click', () => {
    const ids = [...S.wbSel];
    if (ids.length) openAssign({ mode: 'assign', ids, cur: '', origin: 'wb' });
  });

  const sn = $('#wbSnooze');
  if (sn) sn.addEventListener('click', () => {
    localStorage.setItem('dd_wb_snooze', new Date().toISOString().slice(0, 10));
    renderWorkbench();
  });
  const un = $('#wbUnsnooze');
  if (un) un.addEventListener('click', () => { localStorage.removeItem('dd_wb_snooze'); renderWorkbench(); });
}

function wbSyncSel() {
  const items = (S.wb && S.wb.unclaimed_p0 && S.wb.unclaimed_p0.items) || [];
  const n = items.filter((i) => S.wbSel.has(i.insight_id)).length;
  const btn = $('#wbBulkClaim');
  if (btn) { btn.disabled = !n; btn.textContent = `认领已选给我${n ? ` (${n})` : ''}`; }
  const asg = $('#wbBulkAssign');
  if (asg) asg.disabled = !n;
  const all = $('#wbAll');
  if (all) all.checked = !!n && n === items.length;
}

async function wbBulkClaim() {
  const ids = [...S.wbSel];
  if (!ids.length) return;
  const btn = $('#wbBulkClaim');
  if (btn) btn.disabled = true;
  try {
    // 和洞察池同一个接口、同一套"部分成功要报数"的口径（§12.4）。
    const r = await post('/api/insights/bulk', { ids, actor: S.actor, action: 'claim', owner: S.actor });
    S.wbSel = new Set((r.failures || []).map((f) => f.insight_id));   // 失败的留着选中，再点一次就是重试
    if (r.failed) toast(`${r.applied} 条已认领，${r.failed} 条失败：${(r.failures || []).slice(0, 2).map((f) => f.reason || f.error || '').join('；')}`, true);
    else toast(`${r.applied} 条已认领给 ${S.actor}`);
    await refreshCounters();
    await loadWorkbench();
  } catch (e) { toast(e.message, true); if (btn) btn.disabled = false; }
}

function wbKpiClick(k) {
  if (k === 'p0') {
    return wbGoInsights((f) => { f.severity = ['sev.p0']; f.owner = ['__none__']; f.only_open = true; });
  }
  if (k === 'mine') {
    return wbGoInsights((f) => { f.owner = [S.actor]; f.status = ['__none__', 'st.todo']; });
  }
  if (k === 'theme') { S.b.onlyFlagged = true; return go('board'); }
  return wbGoInsights();
}

function wbGoInsights(mut) {
  S.f = blankFilters();
  if (mut) mut(S.f);
  return go('insights');
}

function wbGoto(what) {
  if (what === 'board') { S.b.onlyFlagged = true; return go('board'); }
  // 采集停了的时候，工作台说"先看数据管道"——那个链接必须真的通到那一页，
  // 否则这句提示就是一句空话（这是页面 6 存在的直接理由）。
  if (what === 'pipeline') return go('pipeline');
  if (what === 'p0') return wbGoInsights((f) => { f.severity = ['sev.p0']; f.owner = ['__none__']; f.only_open = true; });
  if (what === 'mine') return wbGoInsights((f) => { f.owner = [S.actor]; f.status = ['__none__', 'st.todo']; });
  return wbGoInsights();
}

// 主题的明细只有看板有（泳道 + 挂载的追踪项 + 事件流）。这里不重造一个抽屉，
// 而是把人送到看板并把那张卡打开 —— 一处动作、一处真相，两个页面各说各话是之前踩过的坑。
async function openThemeOnBoard(tid) {
  await go('board');
  await openCard(tid);
}

async function wbClaim(id) {
  try {
    await post(`/api/insights/${encodeURIComponent(id)}/claim`, { owner: S.actor, actor: S.actor });
    toast('已认领给 ' + S.actor);
    // 先刷角标再整屏：角标是"这一下生效了没有"的第一反馈，顺序反了会闪一次旧数字。
    await refreshCounters();
    await loadWorkbench();
  } catch (e) { toast(e.message, true); }
}

async function wbSetStatus(id, sid) {
  try {
    await post(`/api/insights/${encodeURIComponent(id)}/status`, { status_id: sid, actor: S.actor });
    toast('状态已改为 ' + statusLabel(sid));
    await refreshCounters();
    await loadWorkbench();
  } catch (e) { toast(e.message, true); await loadWorkbench(); }
}

async function wbThemeStatus(tid, sid, sel) {
  // 「不处理」必须写理由，而理由是写给人看的 —— 一律送进看板的抽屉去写，
  // 不在工作台上开一个"就地输入理由"的小口子（那种地方最后都会变成"不做了"三个字）。
  if (sid === 'st.wontfix') {
    toast('标为「不处理」要先写一句理由，去跟进看板写', true);
    if (sel) sel.value = '';
    return openThemeOnBoard(tid);
  }
  try {
    const r = await post(`/api/board/${encodeURIComponent(tid)}/status`,
                         { status_id: sid, actor: S.actor });
    toast('已改为 ' + statusLabel(sid)
      + (r.synced_trackers && r.synced_trackers.length
          ? `，${r.synced_trackers.length} 个追踪项一起更新` : ''));
    await loadWorkbench();
  } catch (e) { toast(e.message, true); await loadWorkbench(); }
}

// ---------------------------------------------------------------- 页面 6：数据管道

// 这一页回答的不是"数据怎么样"，而是"这些数还作不作数"。
// 所以第一屏是自检结论，不是图表 —— 采集停了的时候，下面的图一个都不该被相信。
async function renderOpsPage() {
  stopOpsJobPoll();
  $('#main').innerHTML = `
    <div class="head">
      <div>
        <h1>数据管道</h1>
        <div class="sub" id="opslede">正在加载…</div>
      </div>
      <div class="rt" id="opsrt"></div>
    </div>
    <div id="ops"><div class="empty">正在加载…</div></div>`;
  if (S.ops) renderOps();
  await loadOps();
}

async function loadOps() {
  try {
    S.ops = await get('/api/ops');
    renderOps();
    // 作业一跑起来/一跑完，导航角标就该跟着变。不刷的话，人启动完采集切去看板，
    // 导航上那个「跑中」要等下一次别的原因触发刷新才会出现。
    loadWbBadge();
  } catch (e) {
    const el = $('#ops');
    if (el) el.innerHTML = `<div class="empty"><b>数据管道加载失败</b>${esc(e.message)}</div>`;
  }
}

function renderOps() {
  const d = S.ops;
  const el = $('#ops');
  if (!el || !d) return;

  const h = d.headline || {};
  const mark = levelMark(h.level);

  const lede = $('#opslede');
  if (lede) {
    lede.innerHTML = `生成于 ${esc((d.generated_at || '').replace('T', ' ').slice(5, 16))} · 共 ${esc(d.runs_total)} 次运行`;
  }
  const rt = $('#opsrt');
  if (rt) rt.innerHTML = '<button class="btn sm" id="opsReload">刷新</button>';

  // 顺序有讲究：结论 → 五张自检卡 → **紧接着**作业按钮（结论之下就是动作，中间不隔别的）
  // → 运行记录与数据量 → 抽样质检 → 没做的 → 危险区（默认折叠、红顶边，物理上离"待办"远一点）。
  el.innerHTML = `
    <div class="wb-head ${esc(h.level || 'ok')}">
      <div class="mk">${mark}</div>
      <div style="flex:1;min-width:0"><div class="tx">${esc(h.text || '')}</div></div>
    </div>
    ${opsChecks(d)}
    ${opsJobsBlock(d)}
    <div class="ops-grid" id="ops-runs">
      <div>${opsRunsBlock(d)}${opsInboxBlock(d)}</div>
      <div>${opsFreshBlock(d)}${opsVolumeBlock(d)}</div>
    </div>
    ${opsSamplesBlock(d)}
    ${opsTodoBlock(d)}
    ${opsRollbackBlock(d)}`;

  if ($('#opsReload')) $('#opsReload').addEventListener('click', loadOps);
  // 危险区手动展开过就记住：作业轮询会整页重画，不记的话它每两秒折回去一次。
  const dz = $('#opsRollback');
  if (dz) dz.addEventListener('toggle', () => { S.rb.expanded = !!dz.open; });
  bindOpsJobs();
  bindOpsSamples();
  bindRollback();
  // 有作业在跑就轮询。跑完之后 loadOps() 会重新渲染整页 ——
  // 因为作业改了数据，上面五项自检的结论也该跟着变（比如刚采完，新鲜度就不该再说"停了"）。
  if (d.job_current) startOpsJobPoll(); else stopOpsJobPoll();
}

// ---------------------------------------------------------------- 运行区
//
// 这一页以前只会诊断：它说「采集可能已经停了」，然后把人送去终端。
// 一个指出去就是死胡同的提示比不提示还糟。所以自检下面就是这一块：结论之上没有按钮，
// 等于让人自己想办法。
//
// 三条前端纪律（对应后端的三个决定）：
//  1. 正在跑的时候，**所有**按钮都禁用，并把在跑的是哪一个写出来 ——
//     不禁用的话，人点第二下会拿到 409，而那一刻的困惑（"我点错了吗"）完全可以避免。
//  2. 每个按钮都标出它要多久、要不要人在场、会写什么。一个要人守着十几分钟的按钮，
//     不该长得跟一个三秒钟的按钮一样。
//  3. 跑完自动整页刷新，不只刷这一块 —— 作业改了数据，自检的结论也该跟着变。
let _opsJobTimer = null;

function stopOpsJobPoll() {
  if (_opsJobTimer) { clearInterval(_opsJobTimer); _opsJobTimer = null; }
}

function startOpsJobPoll() {
  stopOpsJobPoll();
  _opsJobTimer = setInterval(async () => {
    // 换到别的页面之后那个节点就没了 —— 停掉轮询，别对着一个已经不在的 DOM 写。
    if (!$('#opsJobs')) { stopOpsJobPoll(); return; }
    try {
      const d = await get('/api/jobs');
      S.ops.jobs = d.jobs;
      S.ops.job_current = d.current;
      S.ops.job_kinds = d.kinds;
      const host = $('#opsJobs');
      if (host) host.outerHTML = opsJobsBlock(S.ops);
      bindOpsJobs();
      if (!d.current) { stopOpsJobPoll(); await loadOps(); }
    } catch (e) {
      // 轮询失败不弹窗：它每 2 秒来一次，弹一次就会盖满屏。
      // 页面上的"已跑 N 分钟"停住不动，本身就是信号。
    }
  }, 2000);
}

function opsJobsBlock(d) {
  const cur = d.job_current;
  const busy = !!cur;

  // 按钮跟着角色走：只读什么都不能跑；负责人不能跑接口标了 admin_only 的（全自动、采集）。
  // 点下去必然 403 的按钮不能是亮的：灰掉，并在按钮下面写一句找谁。
  const canRun = (k) => S.role === 'admin' || (S.canWrite && !k.admin_only);

  // 治理动作（登记发布 / 重算历史）由配置中心画，这里只画采集链路那几种；运行历史照常列。
  const shown = (d.job_kinds || []).filter((k) => k.where !== 'config');
  const kinds = shown.map((k) => {
    const meta = [`<span class="jm-d">${esc(k.duration)}</span>`];
    if (k.needs_human) meta.push('<span class="jm-h">需要人在场</span>');
    meta.push(`<span class="jm-w">会写：${esc(k.writes)}</span>`);
    const running = !!(cur && cur.kind === k.kind);
    const can = canRun(k);
    const tip = !can ? (S.canWrite ? '只有管理员能运行' : '当前角色不能运行作业')
      : busy ? '有作业在运行，等它结束再试' : '运行一次';
    return `<div class="ops-jobkind${busy ? ' busy' : ''}${running ? ' running' : ''}">
      <div class="jd">
        <div class="jn">${esc(k.title)}</div>
        <div class="jw">${esc(k.what)}</div>
        <div class="jm">${meta.join('')}</div>
      </div>
      <button class="btn sm${k.primary ? ' pri' : ''}" data-jobs="${esc(k.kind)}"${busy || !can ? ' disabled' : ''}
        title="${tip}">运行</button>
    </div>`;
  }).join('');

  const blocked = shown.filter((k) => !canRun(k));
  const noperm = !blocked.length ? ''
    : S.canWrite
      ? `<div class="ops-noperm">${blocked.map((k) => `「${esc(k.title)}」`).join('')}只有管理员能运行，当前角色 <code>${esc(S.role)}</code>。需要跑的话请联系管理员。</div>`
      : `<div class="ops-noperm">当前角色 <code>${esc(S.role)}</code> 不能运行作业。需要跑的话请联系管理员。</div>`;

  // 这里不写死「正在跑」—— 用接口给的 status_label，它跟着 stale 一起算。
  // 写死的结果是同一条卡住的作业：这行说"正在跑"、下面历史里说"可能卡住了"、
  // 自检里又说"没跑成"。一个字面三种说法，看的人只会更糊涂。
  let curBox = '';
  if (cur) {
    const p = cur.progress || {};
    const pct = typeof p.percent === 'number' ? Math.max(0, Math.min(100, p.percent)) : null;
    const stage = p.stage || '';
    const detail = p.detail || '';
    const recentLog = p.recent_log || '';

    curBox = `<div class="ops-cur${cur.stale ? ' stale' : ''}">
      <div class="ops-cur-top">
        <span class="dot"></span>
        <b>${esc(cur.status_label)}「${esc(cur.title)}」</b>
        <span class="ago">已跑 ${esc(cur.age_min)} 分钟</span>
        ${pct != null ? `<span class="ops-pbar-num">${pct}%</span>` : ''}
        <span class="ok2" style="margin-left:auto">${cur.stale ? '超过 45 分钟没结束，可能卡在扫码登录或网络' : '运行期间其他作业不可用'}</span>
      </div>
      ${pct != null ? `
      <div class="ops-pbar">
        <div class="ops-pbar-fill" style="width:${pct}%"></div>
      </div>` : ''}
      ${(stage || detail) ? `
      <div class="ops-cur-status">
        ${stage ? `<span class="ops-cur-stage">${esc(stage)}</span>` : ''}
        ${detail ? `<span class="ops-cur-detail">${esc(detail)}</span>` : ''}
      </div>` : ''}
      ${recentLog ? `<div class="ops-cur-live"><span class="lbl">实时日志：</span><code>${esc(recentLog)}</code></div>` : ''}
    </div>`;
  }

  const hist = (d.jobs || []).length
    ? d.jobs.map((j) => {
      const st = j.running ? (j.stale ? 'stale' : 'run') : (j.ok ? 'ok' : 'no');
      const tail = j.running ? `已 ${j.age_min} 分钟` : j.duration;
      const why = j.error || (j.actor ? `by ${j.actor}` : '');
      return `<div class="ops-jobitem">
        <div class="ops-jobrow" data-jobshow="${esc(j.job_id)}">
          <span class="at">${esc(j.at)}</span>
          <span class="sg">${esc(j.title)}</span>
          <span class="st ${st}">${esc(j.status_label)}</span>
          <span class="du">${esc(tail)}</span>
          <span class="ms" title="${esc(why)}">${esc(why)}</span>
          <span class="lk">看日志</span>
        </div>
        <div class="ops-joblog" data-joblog="${esc(j.job_id)}"></div>
      </div>`;
    }).join('')
    : '<div class="wb-more">还没有跑过作业。</div>';

  const why = '作业在后台运行，离开这个页面不会中断。\n'
    + '同一时间只能运行一个作业。跑作业的服务中途关掉或重启，没跑完的作业会标成「被打断」。';
  return `<div class="wb-sec" id="opsJobs">
    <h2>运行${infoI(why)} <span class="n">${(d.jobs || []).length}</span><span class="sp"></span></h2>
    <div class="wb-body pad">
      ${curBox}
      <div class="ops-jobkinds">${kinds}</div>
      ${noperm}
      <div class="ops-jobhist">${hist}</div>
    </div></div>`;
}

function bindOpsJobs() {
  document.querySelectorAll('[data-jobs]').forEach((b) => {
    b.addEventListener('click', () => runOpsJob(b.dataset.jobs, b));
  });
  document.querySelectorAll('[data-jobshow]').forEach((row) => {
    row.addEventListener('click', () => toggleJobLog(row.dataset.jobshow));
  });
}

async function runOpsJob(kind, btn) {
  const meta = (S.ops.job_kinds || []).find((k) => k.kind === kind) || {};
  const label = meta.title || kind;
  if (btn) { btn.disabled = true; btn.textContent = '启动中…'; }
  try {
    await post('/api/jobs', { kind });
    toast(meta.needs_human
      ? `已启动「${label}」。如果登录过期，需要有人在浏览器里扫码`
      : `已启动「${label}」`);
    await loadOps();
  } catch (e) {
    // 409 说的是"时机不对"，不是"参数错"。所以照原样把后端那句带在跑谁的提示打出来，
    // 不自己编一句"运行失败"——那会让人去检查自己点的东西有没有问题。
    toast(e.message, true);
    await loadOps();
  }
}

async function toggleJobLog(jobId) {
  const host = document.querySelector(`[data-joblog="${jobId}"]`);
  if (!host) return;
  if (host.dataset.open === '1') {
    host.innerHTML = '';
    host.dataset.open = '0';
    return;
  }
  host.dataset.open = '1';
  host.innerHTML = '<div class="ops-foot" style="margin:0">正在读日志…</div>';
  try {
    const j = await get('/api/jobs/' + encodeURIComponent(jobId));
    host.innerHTML = `<pre class="ops-log">${esc(j.log || '（这个作业没有留下输出）')}</pre>`
      + `<div class="ops-foot" style="margin:6px 0 0">`
      + (j.log_truncated ? '这里只显示最后一段输出。' : '')
      + `完整日志：<code>${esc(j.log_path || '—')}</code></div>`;
  } catch (e) {
    host.innerHTML = `<div class="ops-foot" style="margin:0">读日志失败：${esc(e.message)}</div>`;
  }
}

// 五项自检：五张并排的状态卡，一眼扫完。顺序即优先级（ops.py 里定的），所以不排序、不折叠。
// 每张卡：状态色顶边 + 一句结论 + 给出路的提示（hint）—— 报红必须给出路，这条不变。
function opsChecks(d) {
  const bad = d.checks.filter((c) => c.level !== 'ok').length;
  // since：这个状态从什么时候开始（check_log 只记翻转）。红了三天和红了三分钟不是一件事，
  // 所以红黄卡写"自 … 起报红"，绿卡写"自 … 起正常"。
  const sinceLine = (c) => {
    if (!c.since) return '';
    const word = c.level === 'ok' ? '正常' : (c.level === 'bad' ? '报红' : '报黄');
    const ago = c.since_hours == null ? '' : ` · ${fmtAgo(c.since_hours).replace('前', '')}`;
    return `<div class="since" title="${esc(c.since)}">自 ${esc(shortTime(c.since))} 起${word}${esc(ago)}</div>`;
  };
  const cards = d.checks.map((c) => {
    const m = levelMark(c.level, 14);
    return `<div class="ops-card ${esc(c.level)}">
      <div class="lb"><span class="mk">${m}</span><span class="nm">${esc(c.label)}</span></div>
      <div class="dt" title="${esc(c.detail)}">${esc(c.detail)}</div>
      ${c.hint ? `<div class="hn">${esc(c.hint)}</div>` : ''}
      ${sinceLine(c)}
    </div>`;
  }).join('');
  return `<div class="wb-sec" id="ops-checks">
    <h2>健康自检 ${bad ? `<span class="n">${bad}</span>` : ''}
      <span class="sp">${bad ? `共 ${d.checks.length} 项自检` : `${d.checks.length} 项全部正常`}</span></h2>
    <div class="ops-cards">${cards}</div>
  </div>`;
}

function opsRunsBlock(d) {
  const rows = d.runs.map((r) => {
    const flags = r.counters.map((c) =>
      `<span class="ct" title="${esc(c.label)}">${esc(c.label)}` +
      `<b>${c.v == null ? '—' : esc(c.v)}</b></span>`).join('');
    return `<div class="ops-run ${r.ok ? '' : 'fail'}">
      <span class="at">${esc(r.at)}</span>
      <span class="sg">${esc(r.stage_label)}</span>
      <span class="st ${r.ok ? 'ok' : 'no'}">${r.ok ? 'ok' : esc(r.status)}</span>
      <span class="cts">${flags || '<span class="ct none">不产生计数</span>'}</span>
      <span class="ms" title="${esc(r.message)}">${esc(r.message || '')}</span>
    </div>`;
  }).join('');
  const why = '「新增 / 去重 / 新增评论」只在采集、入库标准化和周期批处理这几步显示；打标这一步只显示「打标条数」。\n「—」表示这一次没有记录这个数，不代表 0。\n'
    + '白抓评论 = 评论数和上次一样的已有笔记下抓到的评论 / 这一次抓到的全部评论，也就是这一次本可以省掉的请求。评论数读不出来的笔记不计入，只在记录了这个数的采集行上显示。';
  return `<div class="wb-sec">
    <h2>运行日志${infoI(why)} <span class="n">${d.runs_total}</span>
      <span class="sp">最近 ${d.runs.length} 次</span></h2>
    <div class="wb-body pad">
      ${rows || '<div class="wb-more">还没有运行记录。</div>'}
    </div></div>`;
}

function opsFreshBlock(d) {
  const f = d.fresh, ing = d.ingest;
  const dedup = ing.dedup_pct == null ? '—' : ing.dedup_pct + '%';
  const why = '按入库时间计算，不看发布时间：今天才采到的旧帖也算新内容。和工作台的「采集新鲜度」是同一个数。';
  return `<div class="wb-sec">
    <h2>采集${infoI(why)}
      <span class="sp" ${f.stale ? 'style="color:var(--p0)"' : ''}>${
        f.stale ? '可能已经停了' : '在跑'}</span></h2>
    <div class="wb-body pad">
      <div class="wb-fresh">
        <div class="it"><b>${f.windows.h24.total}</b> <span class="u">近 24 小时</span></div>
        <div class="it"><b>${f.windows.d7.total}</b> <span class="u">近 7 天</span></div>
      </div>
      <div class="ops-kv">
        <span>最近一次新内容</span><b>${esc(f.latest_at || '—')}${
          f.stale_hours != null ? `（${Math.round(f.stale_hours)} 小时前）` : ''}</b>
        <span>累计采集轮数</span><b>${ing.runs}</b>
        <span>新增笔记 / 去重命中</span><b>${ing.posts_new} / ${ing.posts_dup}（命中率 ${dedup}）</b>
        <span>新增评论</span><b>${ing.comments_new}</b>
        <span>连续零新增</span><b>${d.streak.streak} 轮（阈值 ${d.streak.threshold}）</b>
      </div>
    </div></div>`;
}

function opsVolumeBlock(d) {
  const cov = d.coverage, dup = d.dup;
  const vols = d.volumes.map((v) =>
    `<span class="vs"><b>${esc(v.n)}</b>${esc(v.label)}</span>`).join('');
  const axes = cov.by_axis.map((a) =>
    `<span class="vs"><b>${esc(a.items)}</b>${esc(axisLabel(a.axis))}</span>`).join('');
  const miss = cov.by_type.filter((x) => x.untagged)
    .map((x) => `${esc(x.label)} ${x.untagged}`).join('、');
  const why = '打标覆盖只统计当前口径的标签。\n内容级重复只做统计、不告警：不同账号发同一段文字是正常现象。';
  return `<div class="wb-sec">
    <h2>数据量与质量${infoI(why)} <span class="sp">库文件 ${esc(d.db_size)}</span></h2>
    <div class="wb-body pad">
      <div class="ops-vols">${vols}</div>
      <div class="ops-kv">
        <span>打标覆盖（v${esc(cov.version)}）</span>
        <b class="${cov.untagged ? 'warn' : ''}">${cov.tagged}/${cov.total}（${cov.pct}%）${
          cov.untagged ? `，缺 ${miss}` : ''}</b>
        <span>各轴覆盖到的内容</span><b>${axes || '—'}</b>
        <span>内容级重复</span>
        <b>笔记 ${dup.post.dup_rows} 条（${dup.post.dup_pct}%）· 评论 ${
          dup.comment.dup_rows} 条（${dup.comment.dup_pct}%）</b>
      </div>
    </div></div>`;
}

function opsInboxBlock(d) {
  if (!d.inbox.length) {
    return `<div class="wb-sec">
      <h2>投放口 <span class="sp">空的</span></h2>
      <div class="wb-body pad">
        <div class="dim"><code>data/inbox/</code> 里没有待导入的文件。</div>
      </div></div>`;
  }
  const rows = d.inbox.map((f) => `<div class="ops-run">
      <span class="at">${esc(f.at)}</span>
      <span class="sg">${esc(f.name)}</span>
      <span class="cts">${esc(f.size)}</span>
    </div>`).join('');
  return `<div class="wb-sec">
    <h2>投放口 <span class="n">${d.inbox.length}</span>
      <span class="sp">待导入</span></h2>
    <div class="wb-body pad">${rows}
      <div class="ops-foot">这些文件还没导入。在上面「运行」里跑一次「打标 + 出报表」会先导入它们。</div>
    </div></div>`;
}

// 「还没做的」：空着就不画 —— "之前列在这里的都做完了"是写给维护者的话。有条目时列出来（每条带为什么），
// "为什么宁可不做"那段总论进 ⓘ。
function opsTodoBlock(d) {
  if (!d.not_implemented.length) return '';
  const rows = d.not_implemented.map((x) => `<div class="ops-todo">
      <div class="wt">${esc(x.what)}</div>
      <div class="wy">${esc(x.why)}</div>
    </div>`).join('');
  return `<div class="wb-sec">
    <h2>这一页还没做的 <span class="n">${d.not_implemented.length}</span>
      <span class="sp"></span></h2>
    <div class="wb-body pad">${rows}
    </div></div>`;
}

// ---------------------------------------------------------------- 危险区：回滚一次导入
//
// 这一块是整套系统里唯一会**真删用户数据**的地方，而且不可撤销。所以它的规矩比别处严一档：
//
//  1. **预览和执行分开**。批次列表跟着 /api/ops 一起来（一条聚合查询），
//     影响面必须单独请求 —— 选哪一批才算哪一批。没选中的批次不该在每次刷新时都被算一遍，
//     更不该让"打开这一页"变成一次全量扫描。
//  2. **两道闸，各管一件事**。一个勾选框问「你看清会删什么了吗」—— 它的字里带着**真实条数**
//     （从预览里取），所以它不是一个可以闭着眼勾的空框；一个输入框问「是哪一批」，
//     原样回填批次号，和后端的 confirm 是同一个东西。布尔确认拦不住手滑，
//     而这里的后果不可撤销 —— 值得两道。
//  3. **能撤 0 条时不给按钮**。点下去「成功删除 0 行」和「这批本来就没东西」
//     长得一模一样，可它们该做的事完全不同（后者说明这批早撤过了）。
//  4. **预览是"点开那一刻"的库**。执行时后端从头重算一遍，所以文案里写
//     「点开那一刻算的」，不写「这就是结果」—— 承诺一个会被重算的数字是在骗人。
//  5. **触发条件写清、后果写清、有多少条写清**。这一页别的按钮已经守这条规矩了，
//     一个删数据的按钮没有理由例外。
//
// 权限：预览不限角色（让人知道能撤什么，和让人有能力撤，是两件事），
// 执行只给管理员。后端有硬闸，前端这里只是**不画出那个按钮** ——
// 让人看到一个点下去必然 403 的按钮，是最差的一种交互。

const RB_WARN = {
  no_run: '运行记录', updated: '更新', missing: '已不在',
  blocked: '被挡住', already: '撤过一次', job_running: '有作业在跑',
};

// 后端几句说明里带 **强调**。先转义再换标记 —— 反过来就等于给注入开了一个口子。
function rbSay(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

const rbWhy = '回滚只删这一次导入新增的内容。已经有人认领、改过状态或打过人工标签的内容不删；这一批更新过的已有内容也不删。\n撤过的批次再点开，会显示这些行已经不在库里。\n执行时会按当时的数据重新计算一遍；预览里的数字是打开预览那一刻的。';

function opsRollbackBlock(d) {
  const rb = (d && d.rollback) || {};
  const batches = rb.batches || [];
  const un = rb.unrunnable || {};

  // 结果块。**名字不能叫 res 又在这里引用 res** —— 那是 `const` 的暂时性死区，
  // 会在"刚删完数据"的那一屏抛 ReferenceError，把整页打成「加载失败」。
  // 触发条件恰好是唯一需要它的时候：S.rb.result 有值。
  // 注意 node --check 查不出这个 —— 它只查语法，TDZ 是运行时的。
  const last = S.rb.result;
  const dl = (last && last.deleted) || {};
  const kp = (last && last.kept) || {};
  const res = last ? `<div class="rb-res">
      <b>上一次执行的结果</b>
      删掉笔记 ${dl.posts || 0}、评论 ${dl.comments || 0}，
      连带清掉标签 ${dl.tags || 0}、状态登记 ${dl.states || 0}、操作留痕 ${dl.events || 0}；
      另有 ${kp.blocked || 0} 条被挡住、${kp.updated || 0} 条是更新过的，都留着没动。
      这次操作记在运行日志 #${last.run_id}。
    </div>` : '';

  const rows = batches.map((b) => {
    const on = S.rb.batch === b.batch_id;
    // 状态只在"账本里记了 created"时才有意义。没有 created 的批次（只更新过、
    // 或者账本就是空的）不该显示成「可撤 0」—— 那读起来像"撤不出东西"，
    // 而它其实是"这一批没往库里写新行"，两件事该说不同的话。
    let st = '';
    let cls = '';
    if (b.rolled_back) {
      cls = 'done';
      st = b.remaining > 0
        ? `<span class="rb-st warn">已撤过 · 又冒出 ${b.remaining}</span>`
        : '<span class="rb-st done">已撤过</span>';
    } else if ((b.created || 0) === 0) {
      st = '<span class="rb-st none">没写新行</span>';
    } else if (b.remaining > 0) {
      // 这一列**必须能复现自身**：点开来看到的 tracked.created 就是这个数，
      // 而 deletable 只会更少（被挡住的那些）。所以这里说的是「库里还留着 N 条」，
      // 不是「可撤 N 条」—— 后者会和预览里那个更小的数打起来。
      st = `<span class="rb-st live">库里还留着 ${b.remaining} 条</span>`;
    } else {
      cls = 'gone';
      st = '<span class="rb-st none">已不在库里</span>';
    }
    return `<button class="rb-row${on ? ' on' : ''}${cls ? ' ' + cls : ''}"
      data-rbpick="${esc(b.batch_id)}" type="button">
      <span class="rb-at">${esc(b.at)}</span>
      <span class="rb-src">${esc(b.source || '—')}<i>${esc(b.stage || '')}</i></span>
      <span class="rb-bi mono">${esc(b.batch_id)}</span>
      <span class="rb-ct">新增 <b>${b.created || 0}</b><i>更新 ${b.updated || 0}</i></span>
      ${st}
    </button>`;
  }).join('');

  const unNote = un.total ? `<div class="rb-un">
      <b>另有 ${un.total} 次导入查不到账本，一律不可回滚</b>
      <div class="say">${rbSay(un.why || '')}</div>
      ${(un.items || []).length ? `<div class="list">${un.items.map((i) =>
        `<span>#${i.id} ${esc(i.at)} · ${esc(i.stage || '')} · 新增 ${
          i.posts_new || 0}/${
          i.comments_new || 0}</span>`).join('')}</div>` : ''}
    </div>` : '';

  // 默认折叠：它和「待办」只隔一条标题的时候，视觉上不够"危险"。
  // 但三种情况必须展开着：刚执行完（人得看见自己删了什么）、正在选批次 / 看预览、人自己点开过。
  const open = !!(S.rb.result || S.rb.batch || S.rb.preview || S.rb.expanded);
  return `<details class="wb-sec danger" id="opsRollback"${open ? ' open' : ''}>
    <summary class="h2 hot">危险区 · 回滚某次导入${infoI(rbWhy)}
      <span class="sp">${batches.length ? `最近 ${batches.length} 批` : '还没有可回滚的批次'}</span></summary>
    <div class="wb-body pad">
      ${res}
      <div class="rb-hint">${rbSay(rb.hint || '回滚不可撤销。撤之前先看清「会删哪些」和「哪些删不了」。')}</div>
      <div class="rb-list">${rows || '<div class="dim">还没有可回滚的导入。跑一次采集或导入后，这里会列出批次。</div>'}</div>
      ${unNote}
      <div id="rbPanel">${rbPanel()}</div>
    </div></details>`;
}

function rbPanel() {
  if (!S.rb.batch) {
    return '<div class="rb-empty">选上面一批，看它会删掉什么。</div>';
  }
  if (S.rb.busy === 'preview') return '<div class="rb-empty">正在算影响面…</div>';
  if (S.rb.err) {
    return `<div class="rb-empty bad"><b>算不出来</b>${esc(S.rb.err)}
      <div class="sm">这一批可能已经不在了，或者批次号不对。</div></div>`;
  }
  const p = S.rb.preview;
  if (!p) return '<div class="rb-empty">还没算出来。</div>';

  const de = p.deletable || {};
  const bl = p.blocked || {};
  const up = p.updated || {};
  const ca = p.cascade || {};
  const can = !!p.can_apply;

  const derive = ca.tags || ca.states || ca.events
    ? `，连带清掉标签 <b>${esc(ca.tags)}</b>、状态登记 <b>${esc(ca.states)}</b>、操作留痕 <b>${esc(ca.events)}</b>`
    : '';

  const verdict = can
    ? `<div class="rb-verdict bad">
        <div class="mk">${levelMark('bad')}</div>
        <div>
          <div class="tx">会删掉 <b>${esc(de.rows)}</b> 条内容（笔记 ${esc(de.posts)}、评论 ${
            esc(de.comments)}）${derive}。</div>
          ${(bl.rows || up.rows) ? `<div class="sm">另外 ${esc(bl.rows)} 条有其他人的操作记录、${
            esc(up.rows)} 条是这一批更新过的已有内容，<b>都不删</b>。</div>` : ''}
        </div></div>`
    : `<div class="rb-verdict ok">
        <div class="mk">${levelMark('none')}</div>
        <div><div class="tx">这一批撤不出东西。</div>
          <div class="sm">${esc(p.refuse || '')}</div></div></div>`;

  const warns = (p.warnings || []).map((w) => `<div class="rb-warn">
      <span class="k">${esc(RB_WARN[w.kind] || '注意')}</span>
      <span class="s">${rbSay(w.say)}</span></div>`).join('');

  const run = p.run;
  const runLine = run ? `<div class="rb-run">
      <span>这一次运行</span>
      <b class="mono">#${run.id} ${esc(run.at)}</b>
      <span>${esc(run.source || '')} · ${esc(run.stage || '')}${
        run.keyword ? ' · ' + esc(run.keyword) : ''}</span>
      <span class="msg" title="${esc(run.message)}">${esc(run.message || '')}</span>
    </div>` : `<div class="rb-run"><span>这一次运行</span>
      <b>查不到对应的运行记录</b></div>`;

  const items = (de.items || []).map((x) => `<div class="rb-item">
      <span class="t">${x.item_type === 'post' ? '笔记' : '评论'}</span>
      <span class="mono id">${esc(x.item_id)}</span>
      <span class="at">${esc((x.at || '').replace('T', ' ').slice(5, 16))}</span>
    </div>`).join('');

  const samp = (p.sample || []).map((s) => `<div class="rb-samp">
      <span class="ti">${esc(s.title || '（无标题）')}</span>
      <span class="ct">${esc(s.content || '')}</span>
    </div>`).join('');

  const blocked = (bl.items || []).map((x) => `<div class="rb-block">
      <div class="h"><span class="t">${x.item_type === 'post' ? '笔记' : '评论'}</span>
        <span class="mono id">${esc(x.item_id)}</span></div>
      ${(x.reasons || []).map((r) =>
        `<div class="r"><span class="lb">${esc(r.label)}</span>${esc(r.say)}</div>`).join('')}
    </div>`).join('');

  // 两道闸。第一道是勾选（字里带真实条数），第二道是原样回填批次号。
  // 输入框的 placeholder 就是批次号 —— 让人能复制，而不是照着 20 个字符打错三次。
  const gate = S.role !== 'admin'
    ? `<div class="rb-noperm">回滚只给管理员：预览谁都能看，只有管理员能执行。
        当前角色 <code>${esc(S.role)}</code>。</div>`
    : can ? `<div class="rb-gate">
        <label class="ck"><input type="checkbox" id="rbTick"${S.rb.tick ? ' checked' : ''}>
          <span>我知道这会删掉 <b>${esc(de.rows)}</b> 条内容${
            (ca.tags + ca.states + ca.events) ? `和连带的 <b>${
              ca.tags + ca.states + ca.events}</b> 行派生数据` : ''}，且不可撤销</span></label>
        <div class="row">
          <span class="lb">回填批次号</span>
          <input type="text" id="rbConfirm" autocomplete="off" spellcheck="false"
            placeholder="${esc(p.batch_id)}" value="">
          <button class="btn danger" id="rbApply" disabled>删除这些行</button>
        </div>
        <div class="hint">勾选上面的确认，并原样填一遍批次号，才能删除。</div>
      </div>`
    : '';

  return `<div class="rb-pv">
    ${verdict}
    ${warns}
    ${runLine}
    ${items || samp ? `<div class="rb-split">
      <div><div class="sub">会删掉的条目 <b>${esc(de.rows)}</b>${
        de.more ? `（下面列了 ${de.items.length} 条，还有 ${esc(de.more)} 条没列出来）` : ''}</div>
        <div class="rb-items">${items || '<div class="dim">（只有评论，或没取到标题）</div>'}</div></div>
      ${samp ? `<div><div class="sub">其中几篇</div>
        <div class="rb-samps">${samp}</div></div>` : ''}
    </div>` : ''}
    ${blocked ? `<div class="rb-blocks">
      <div class="sub">删不了的 <b>${esc(bl.rows)}</b>${
        bl.more ? `（列了 ${bl.items.length} 条，还有 ${esc(bl.more)} 条）` : ''}：有其他人的操作记录</div>
      ${blocked}
      <div class="note">要一起清掉，先撤回这些认领或人工标签，再回来重新预览。</div>
    </div>` : ''}
    ${gate}
  </div>`;
}

function bindRollback() {
  document.querySelectorAll('#ops [data-rbpick]').forEach((b) => {
    b.addEventListener('click', () => pickBatch(b.dataset.rbpick));
  });
  const tick = $('#rbTick');
  const conf = $('#rbConfirm');
  const apply = $('#rbApply');
  if (!apply) return;
  const gate = () => {
    const p = S.rb.preview || {};
    apply.disabled = !!S.rb.busy || !S.rb.tick
      || !conf || conf.value.trim() !== (p.batch_id || '');
  };
  if (tick) tick.addEventListener('change', () => { S.rb.tick = tick.checked; gate(); });
  if (conf) conf.addEventListener('input', gate);
  apply.addEventListener('click', rbApply);
  gate();
}

// 只重画危险区那一块。整页重画在这里是错的：批次列表一抖动，
// 人刚勾上的那个框和刚打了一半的批次号就没了 —— 而这是一页要人反复核对的东西。
function renderRb() {
  const host = $('#opsRollback');
  if (!host) return;
  host.outerHTML = opsRollbackBlock(S.ops || {});
  bindRollback();
}

async function pickBatch(batchId) {
  if (S.rb.batch === batchId && S.rb.preview && !S.rb.err) return;
  S.rb.batch = batchId;
  S.rb.tick = false;      // 换了批次，上一个"我看过了"的勾立刻作废
  S.rb.preview = null;
  S.rb.err = '';
  S.rb.result = null;
  S.rb.busy = 'preview';
  renderRb();
  try {
    S.rb.preview = await get('/api/rollback/preview?batch=' + encodeURIComponent(batchId));
  } catch (e) {
    S.rb.err = e.message;
  }
  S.rb.busy = '';
  renderRb();
}

async function rbApply() {
  const batch = S.rb.batch;
  const p = S.rb.preview || {};
  if (!batch || !p.batch_id) return;
  const btn = $('#rbApply');
  const conf = $('#rbConfirm');
  // 前端这道闸是"别让人误点"，不是"防住谁"。真正的闸在后端：
  // confirm 必须等于 batch_id，而且只有管理员能过。
  if (!conf || conf.value.trim() !== p.batch_id) { toast('批次号没对上', true); return; }
  if (btn) { btn.disabled = true; btn.textContent = '正在删…'; }
  S.rb.busy = 'apply';
  S.rb.err = '';
  try {
    const res = await post('/api/rollback/apply',
      { batch_id: batch, confirm: conf.value.trim() });
    S.rb.result = res;
    S.rb.busy = '';
    S.rb.tick = false;
    // 预览必须作废：它算的是"删之前"的库，留着它就会在刚刚删完的页面上
    // 继续写着"会删 5 条"。刚做完一件事的那一屏，写错一个字就是让人再删一次。
    S.rb.preview = null;
    S.rb.batch = '';
    toast(res.say || '已回滚');
    await loadOps();     // 整页刷：批次列表、运行日志、五项自检都会跟着变
  } catch (e) {
    S.rb.busy = '';
    S.rb.err = e.message;
    toast(e.message, true);
    renderRb();
  }
}

// ---------------------------------------------------------------- 标签准确率
//
// 这一块回答的是「打标这把尺子量得准不准」。覆盖率说不了这件事 ——
// 一个把三成内容打错标签的引擎，覆盖率和全对时**一模一样**：两个数都很好看，
// 而看板、趋势线、热点榜、跟进看板全都建立在这批标签上。
//
// 四条前端纪律（对应后端的四个决定）：
//  1. 点估计和区间必须并排。只写「92%」等于把抽样误差说成 0 ——
//     30 条全对的时候，Wilson 的下限其实只有 88.6%。
//  2. 判「错」和「说不清」必须**就地**写一句为什么。接口会拒（400），
//     但让按钮点下去才报错是糟糕的交互，所以这里先展开输入框再提交。
//  3. 抽样是一个**动作**，不是一个视图：点「抽一批」真的往库里写行。
//     所以按钮上写清会写什么，和上面「运行」区同一条规矩。
//  4. 抽完不重抽。还有没判完的时候，两个按钮分开站着 ——
//     「先判完」和「仍然抽一批（旧的留着）」是两种意图，不能合并成一个。
let _sampNote = null;        // {id, verdict}：正在就地写原因的那一条

const SAMP_CLASS = { ok: 'ok', bad: 'bad', unsure: 'unsure' };

function sampVerdictOf(sid) {
  const s = (S.ops && S.ops.samples) || {};
  const hit = (s.recent || []).find((x) => x.id === sid);
  return hit ? hit.verdict : null;
}

function sampLabel(v) {
  const s = (S.ops && S.ops.samples) || {};
  const hit = (s.verdicts || []).find((x) => x.id === v);
  return (hit && hit.label) || v;
}

const sampWhy = '每条样本是一个标签：判的是这个标签打得对不对，不是整条内容。\n准确率只衡量打上的标签对不对，漏标看覆盖率。\n判定不会修改标签；改判会留下记录。';

function opsSamplesBlock(d) {
  const s = d.samples;
  if (!s) return '';
  const con = s.conclusion || {};
  const mark = levelMark(con.level || 'none');

  // 分母（n）和样本总数（total）是两件事：待判的那些既不算对也不算错。
  const acc = s.accuracy == null ? '—' : s.accuracy + '%';
  const ci = (s.ci && s.ci.length === 2) ? s.ci[0] + '–' + s.ci[1] + '%' : '—';
  const nums = `<div class="samp-nums">
    <div class="samp-num${s.accuracy == null ? ' idle' : ''}">
      <b>${acc}</b><span>准确率</span><i>95% 区间 ${ci}</i></div>
    <div class="samp-num${s.n < s.min_n ? ' idle' : ''}">
      <b>${s.n}</b><span>判过的（分母）</span><i>够 ${s.min_n} 条才给结论</i></div>
    <div class="samp-num${s.unsure ? ' warn' : ''}">
      <b>${s.unsure}</b><span>说不清</span><i>不进分母，单独看</i></div>
    <div class="samp-num${s.unreviewed ? ' warn' : ''}">
      <b>${s.unreviewed}</b><span>待判</span><i>判完才计入</i></div>
  </div>`;

  const vc = s.value_coverage || {};
  const covLine = vc.total ? `<div class="ops-kv">
      <span>类目覆盖</span><b>${vc.sampled}/${vc.total}（${vc.pct}%）${
        (vc.biggest_untested || []).length
          ? `　量最大但还没测过的：${
              esc(axisLabel(vc.biggest_untested[0].axis))} ${
              esc(valLabel(vc.biggest_untested[0].axis, vc.biggest_untested[0].value))}（${
              vc.biggest_untested[0].tags} 条）`
          : ''}</b>
    </div>` : '';

  const bv = (s.by_value || []).map((x) => {
    const cls = x.accuracy < s.bad_accuracy ? 'bad'
      : x.accuracy < s.warn_accuracy ? 'warn' : '';
    const tail = [x.bad ? `错 ${x.bad}` : '', x.unsure ? `说不清 ${x.unsure}` : '']
      .filter(Boolean).join(' · ');
    return `<div class="samp-row ${cls}">
      <span class="ax">${esc(axisLabel(x.axis))}</span>
      <span class="vl">${esc(valLabel(x.axis, x.value))}</span>
      <span class="bar"><i style="width:${Math.max(2, Math.min(100, x.accuracy))}%"></i></span>
      <span class="pc">${x.accuracy}%</span>
      <span class="nn">n=${x.n}${tail ? ' · ' + esc(tail) : ''}</span>
    </div>`;
  }).join('');

  // 样本不足的**单列**：混进上面那张表会出现「某类目 100%（n=1）」，
  // 而它和"没测过"是一回事。
  const tf = (s.too_few || []).length ? `<div class="samp-tf">
      <b>样本不足（只报数，不给百分比）</b>${
        (s.too_few || []).map((x) => `<span>${
          esc(axisLabel(x.axis))} ${esc(valLabel(x.axis, x.value))} ${x.n} 条</span>`).join('')}
    </div>` : '';

  const bver = (s.by_version || []).length > 1 ? `<div class="ops-kv">
      <span>口径对照</span><b>${
        (s.by_version || []).map((v) => `v${esc(v.version)} ${
          v.accuracy == null ? '—' : v.accuracy + '%'}（n=${v.n}${
          v.unreviewed ? `，另 ${v.unreviewed} 待判` : ''}）${
          v.current ? ' ← 当前' : ''}`).join(' · ')}</b>
    </div>` : '';

  const canWrite = S.canWrite;
  const btns = (x, cur) => `<span class="samp-btns">${
    (s.verdicts || []).map((v) => `<button class="btn xs${
      v.id === cur ? ' on' : ''}" data-samp="${esc(v.id)}" data-sid="${x.id}"
      title="${esc(v.why)}"${canWrite ? '' : ' disabled'}>${esc(v.label)}</button>`).join('')
  }</span>`;

  const pend = (s.pending || []).map((x) => {
    const ed = _sampNote && _sampNote.id === x.id;
    return `<div class="samp-item${ed ? ' editing' : ''}">
      <div class="hdr">
        <span class="sid">#${x.id}</span>
        <span class="tag"><b>${esc(axisLabel(x.axis))}</b>${
          esc(valLabel(x.axis, x.value))}</span>
        <span class="sn">${esc(x.title || x.snippet || '')}</span>
        ${btns(x, null)}
      </div>
      ${ed ? sampNoteEditor(x.id, _sampNote.verdict) : ''}
    </div>`;
  }).join('');

  const rec = (s.recent || []).map((x) => {
    const ed = _sampNote && _sampNote.id === x.id;
    return `<div class="samp-item done${ed ? ' editing' : ''}">
      <div class="hdr">
        <span class="sid">#${x.id}</span>
        <span class="tag"><b>${esc(axisLabel(x.axis))}</b>${
          esc(valLabel(x.axis, x.value))}</span>
        <span class="vd ${esc(SAMP_CLASS[x.verdict] || '')}">${esc(x.verdict_label || '')}</span>
        <span class="sn">${esc(x.snippet || '')}</span>
        ${x.edits ? `<span class="ed">改过 ${x.edits} 次</span>` : ''}
        <span class="tm">${esc(x.reviewed_short || '')}</span>
        ${btns(x, x.verdict)}
      </div>
      ${ed ? sampNoteEditor(x.id, _sampNote.verdict) : ''}
    </div>`;
  }).join('');

  const drawBtn = `<button class="btn sm" id="sampDraw"${canWrite ? '' : ' disabled'}>
      抽 ${s.default_n} 条出来判</button>`;
  // 「先判完」和「仍然抽一批」是两种意图，不能合并成一个按钮 ——
  // 合并的结果是：想先判完的人点下去被拒（或者更糟，旧题被悄悄作废）。
  const forceBtn = s.unreviewed
    ? `<button class="btn sm ghost" id="sampDrawForce"${canWrite ? '' : ' disabled'}>
         仍然抽一批（那 ${s.unreviewed} 条旧的留着，不删）</button>` : '';

  return `<div class="wb-sec" id="opsSamples">
    <h2>标签准确率${infoI(sampWhy)} <span class="n">${s.total}</span><span class="sp"></span></h2>
    <div class="wb-body pad">
      <div class="samp-head ${esc(con.level || 'none')}">
        <div class="mk">${mark}</div>
        <div class="tx">${esc(con.text || '')}</div>
      </div>
      ${nums}
      ${covLine}
      ${bv ? `<div class="samp-table">${bv}</div>` : ''}
      ${tf}
      ${bver}
      <div class="samp-actions">${drawBtn}${forceBtn}</div>
      <div class="samp-list">
        ${s.pending.length
          ? `<div class="samp-cap">待判（${s.pending.length} 条）· 判「错」和「说不清」要写一句为什么</div>${pend}`
          : '<div class="wb-more">没有待判的样本。</div>'}
      </div>
      ${rec ? `<div class="samp-list"><div class="samp-cap">最近判过的</div>${rec}</div>` : ''}
    </div></div>`;
}

function sampNoteEditor(id, verdict) {
  const s = (S.ops && S.ops.samples) || {};
  const v = (s.verdicts || []).find((x) => x.id === verdict) || {};
  return `<div class="samp-note">
    <div class="q">判「${esc(v.label || verdict)}」要写一句为什么（${esc(v.why || '')}）</div>
    <input id="sampNoteText" autocomplete="off"
      placeholder="比如：这条其实是包装破损，不是配送问题">
    <button class="btn sm" id="sampNoteGo">提交</button>
    <button class="btn sm ghost" id="sampNoteCancel">取消</button>
  </div>`;
}

function rerenderSamples() {
  const host = $('#opsSamples');
  if (!host || !S.ops) return;
  host.outerHTML = opsSamplesBlock(S.ops);
  bindOpsSamples();
}

function bindOpsSamples() {
  const draw = $('#sampDraw');
  if (draw) draw.addEventListener('click', () => drawSamples(false, draw));
  const force = $('#sampDrawForce');
  if (force) force.addEventListener('click', () => drawSamples(true, force));
  document.querySelectorAll('[data-samp]').forEach((b) => {
    b.addEventListener('click', () => judgeSample(b.dataset.sid, b.dataset.samp));
  });
  const go = $('#sampNoteGo');
  if (go) {
    go.addEventListener('click', submitSampleNote);
    const inp = $('#sampNoteText');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitSampleNote(); });
    }
  }
  const cancel = $('#sampNoteCancel');
  if (cancel) cancel.addEventListener('click', () => { _sampNote = null; rerenderSamples(); });
}

async function drawSamples(force, btn) {
  const s = S.ops.samples || {};
  const label = force ? '仍然抽一批' : '抽一批';
  if (btn) { btn.disabled = true; btn.textContent = '抽样中…'; }
  try {
    const r = await post('/api/samples/draw', { n: s.default_n || 30, force: !!force });
    // 抽出来的是**库里的行**，不是每次打开页面现算的查询结果 ——
    // 否则"我已经判了 12 条"会在刷新之后指向另外 12 条。
    toast(`已抽 ${r.drawn} 条（${r.round_id}）`
      + (r.abandoned ? `；上一轮那 ${r.abandoned} 条仍留在待判列表里` : ''));
    _sampNote = null;
    await loadOps();
  } catch (e) {
    // 400 说的是"时机不对"（上一轮还没判完），所以原样把后端那句带出来，
    // 不自己编一句"抽样失败"—— 那会让人去检查自己点错了什么。
    toast(e.message, true);
    await loadOps();
  }
}

async function judgeSample(sid, verdict) {
  const id = Number(sid);
  if (sampVerdictOf(id) === verdict) {
    toast(`#${id} 已经判成「${sampLabel(verdict)}」了`);
    return;
  }
  if (verdict === 'ok') {
    // 「对」不需要理由：它的理由就是"没看出问题"。
    await postSampleReview(id, verdict, null);
    return;
  }
  // 错 / 说不清：先就地展开输入框。理由不是可选项 ——
  // 下次去改哪一条 hint，靠的就是这句话。
  _sampNote = { id: id, verdict: verdict };
  rerenderSamples();
}

async function submitSampleNote() {
  if (!_sampNote) return;
  const inp = $('#sampNoteText');
  const text = inp ? inp.value.trim() : '';
  if (!text) {
    toast('写一句为什么再提交，或者点「取消」', true);
    if (inp) inp.focus();
    return;
  }
  const note = _sampNote;
  _sampNote = null;
  await postSampleReview(note.id, note.verdict, text);
}

async function postSampleReview(id, verdict, note) {
  try {
    const r = await post('/api/samples/' + id + '/review',
      note == null ? { verdict: verdict } : { verdict: verdict, note: note });
    toast(`#${id} → ${r.verdict_label}`
      + (r.changed ? `（原来是「${sampLabel(r.from) || r.from}」，已留痕）` : ''));
    await loadOps();
  } catch (e) {
    toast(e.message, true);
    await loadOps();
  }
}

// ---------------------------------------------------------------- 页面 3：追踪中心
//
// 这一页回答的不是"这条线现在有多少条"，而是"这条线上的点，还是用同一把尺子量出来的吗"。
//
// 为什么它值得单独一页：分类体系改版之后，同一条趋势线上的两个点可能分别出自两把
// 不同的尺子。它不报错、不缺数、折线照样连得上 —— 只断在一个看不见的地方。
// 这一页的全部作用，就是把"换过尺子"从一件要翻旧周报才发现的事，变成屏幕上的一行字。
//
// 四条纪律：
//  1. 选了历史口径就必须一直提醒。人点进 v1.0 看完，回头会把那个数当成"现在的"——
//     所以只要不是当前口径，页头就挂一条提示，不靠人记性。
//  2. 状态和负责人只认宿主主题卡。锚定到单个体验域的追踪项，状态登记在那张体验域卡上，
//     它自己那一行可能是旧的。读和写都走宿主主题，否则追踪中心和看板各说各话。
//  3. 落盘快照和这一屏现算是两件事。快照是周一自动化跑的（可能是另一把尺子），
//     这一屏是按你选的尺子现算的。不说清哪个是哪个，"页面说 22、报表说 32"就会被当 bug。
//  4. 换尺子的差要**双向**报。只说"少了 10 条"等于让人去猜那 10 条去哪了；
//     说成"v1.0 下算首页推荐、v1.1 下算消息通知"，一句话就交代清楚了。

async function renderTrackersPage() {
  $('#main').innerHTML = `
    <div class="head">
      <div>
        <h1>追踪中心</h1>
        <div class="sub" id="trklede">正在加载…</div>
      </div>
      <div class="rt" id="trkrt"></div>
    </div>
    <div class="trkchips" id="trkchips"></div>
    <div class="trkbar" id="trkbar"></div>
    <div id="trkbanner"></div>
    <div id="trklist"><div class="empty">正在加载…</div></div>`;
  if (S.t.data) { renderTrkBar(); renderTrkChips(); renderTrkBanner(); renderTrkRows(); }
  await loadTrackers();
}

// 页头下的四个状态 chip。它们是"这一屏里哪几条线值得先看"的四种回答，单选、可取消；
// 在已装载的行上过滤（十来条线不值得为它多发一次请求），选中的写进 URL（view=）。
const TRK_VIEWS = [
  { id: 'alert',   label: '告警中',   test: (r) => !!r.alert,                       cls: 'alert' },
  { id: 'drift',   label: '口径变动', test: (r) => !!(r.drift && r.drift.changed) && !trkOtherEmpty(), cls: 'drift' },
  { id: 'unowned', label: '没负责人', test: (r) => !r.owner,                        cls: 'unowned' },
  { id: 'ok',      label: '正常',     test: (r) => !r.alert,                        cls: 'ok' },
];

function trkVisibleRows() {
  const rows = (S.t.data && S.t.data.rows) || [];
  const v = TRK_VIEWS.find((x) => x.id === S.t.view);
  return v ? rows.filter(v.test) : rows;
}

function renderTrkChips() {
  const el = $('#trkchips');
  if (!el || !S.t.data) return;
  const rows = S.t.data.rows || [];
  el.innerHTML = TRK_VIEWS.map((v) => {
    const n = rows.filter(v.test).length;
    return `<button type="button" class="fchip tv ${v.cls} ${S.t.view === v.id ? 'on' : ''}" data-view="${v.id}"
      ${n ? '' : 'disabled title="没有符合的追踪项"'}>${esc(v.label)}<span class="c">${n}</span></button>`;
  }).join('') + (S.t.view ? `<button type="button" class="fchip clr" data-view="">${iconSvg('x', 12)}取消</button>` : '');
  el.querySelectorAll('[data-view]').forEach((c) => c.addEventListener('click', () => {
    S.t.view = (c.dataset.view && S.t.view !== c.dataset.view) ? c.dataset.view : '';
    renderTrkChips();
    renderTrkRows();
    syncHash('trackers');
  }));
}

async function loadTrackers() {
  const t = S.t;
  syncHash('trackers');
  const p = new URLSearchParams();
  // 口径是全站共用的（S.version），不是这一页自己的 —— 从这里切成 v1.0 之后，
  // 去洞察池看到的也必须是 v1.0，否则"上一版是 12 条"这句话就没法复现。
  if (S.version) p.set('version', S.version);
  // other='0' 表示不做对照。默认给对照 —— 这一页的主要用途就是看换尺子的差。
  if (t.other === '0') p.set('compare', '0');
  if (t.owner) p.set('owner', t.owner);
  if (t.status) p.set('status', t.status);
  if (t.direction) p.set('direction', t.direction);
  if (t.q) p.set('q', t.q);
  p.set('sort', t.sort || 'alert');
  try {
    const jobs = [get('/api/trackers?' + p.toString())];
    if (!S.t.meta) jobs.push(get('/api/trackers/meta'));
    const [data, meta] = await Promise.all(jobs);
    S.t.data = data;
    if (meta) S.t.meta = meta;
    renderTrkBar();
    renderTrkChips();
    renderTrkBanner();
    renderTrkRows();
    if (S.pendingOpen) { const id = S.pendingOpen; S.pendingOpen = ''; openTracker(id, true); }
  } catch (e) {
    const el = $('#trklist');
    if (el) el.innerHTML = `<div class="empty"><b>追踪中心加载失败</b>${esc(e.message)}</div>`;
  }
}

function trkMeta() { return S.t.meta || {}; }

// 对照的那一版登记过、但库里一条标签都没有（从没按它打过标）：比出来全是「0 → N」，
// 那不是口径变动，是没有可比的数据。chip、徽章、页头都按「没法对照」说。
function verNoTags(v) {
  const x = (trkMeta().versions || []).find((m) => m.version === v);
  return !!(x && !x.tags);
}
function trkOtherEmpty() {
  const d = S.t.data;
  return !!(d && d.other_version && verNoTags(d.other_version));
}


// 版本号后面跟的那串字。两件事要分开说：**在跑的那把**（库里最近一次打标用的）
// 和**配置里写的那把**。两者不一致时页头会单独报，所以下拉里只要点到为止 ——
// 写全了会被 select 的宽度切掉半句，看起来像坏了。
function verSuffix(v) {
  if (v.is_active && v.is_config) return '（当前）';
  const bits = [];
  if (v.is_active) bits.push('在跑');
  if (v.is_config) bits.push('配置里');
  return bits.length ? `（${bits.join(' · ')}）` : '';
}

function renderTrkBar() {
  const el = $('#trkbar');
  if (!el || !S.t.data) return;
  const d = S.t.data;
  const m = trkMeta();

  const lede = $('#trklede');
  if (lede) {
    const tt = d.totals;
    const bits = [`<b>${tt.trackers}</b> 个追踪项`];
    if (tt.mentions) bits.push(`本周共 <b>${tt.mentions}</b> 条提及`);
    if (tt.alerts) bits.push(`<span style="color:var(--p0)">${tt.alerts} 个在告警</span>`);
    if (tt.unowned) bits.push(`${tt.unowned} 个没负责人`);
    // 「换过尺子」是这个页面的主角之一，页头就要提一句，不能只在列表里当徽章。
    // 说"涉及 N 条内容"而不是"差 N 条" —— 那个数是**归属变了的条目数**，
    // 不是两个口径的差（差可能是负的，也可能被别的条目抵消）。
    const noCmp = trkOtherEmpty();
    if (noCmp) {
      bits.push(`<span style="color:var(--tx3)">v${esc(d.other_version)} 在库里没有标签，没法对照</span>`);
    } else if (tt.drifted) {
      bits.push(`<span style="color:var(--p1-tx)">${tt.drifted} 个受口径变动影响（${
        tt.drift_items} 条内容换了归属）</span>`);
    }
    lede.innerHTML = bits.join(' · ')
      + ` · 口径 v${esc(d.version)}`
      + (d.other_version && !noCmp ? `（对照 v${esc(d.other_version)}）` : '');
  }

  const rt = $('#trkrt');
  if (rt) {
    rt.innerHTML = `<button class="btn sm" id="trkReload">刷新</button>`;
    $('#trkReload').addEventListener('click', loadTrackers);
  }

  // 口径开关在顶栏（全站一把尺子）。这里只留"对照"：它是这一页自己的问题。
  el.innerHTML = `
    <label class="chk">对照
      <select id="trkOther">
        <option value="" ${S.t.other !== '0' ? 'selected' : ''}>${
          d.other_version ? `与 v${esc(d.other_version)} 比` : '与另一版比'}</option>
        <option value="0" ${S.t.other === '0' ? 'selected' : ''}>不对照</option>
      </select></label>
    <span class="fsep"></span>
    <label class="chk">负责人
      <select id="trkOwner">
        <option value="">全部</option>
        ${(m.owners || []).map((o) =>
          `<option value="${esc(o)}" ${S.t.owner === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        <option value="__none__" ${S.t.owner === '__none__' ? 'selected' : ''}>未认领</option>
      </select></label>
    <label class="chk">状态
      <select id="trkStatus">
        <option value="">全部</option>
        ${(m.statuses || []).map((s) =>
          `<option value="${esc(s.id)}" ${S.t.status === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
        <option value="__none__" ${S.t.status === '__none__' ? 'selected' : ''}>没登记过</option>
      </select></label>
    <label class="chk">走势
      <select id="trkDir">
        <option value="">全部</option>
        ${(m.directions || []).map((x) =>
          `<option value="${esc(x)}" ${S.t.direction === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
      </select></label>
    <label class="chk">排序
      <select id="trkSort">
        ${(m.sorts || []).map((s) =>
          `<option value="${esc(s.id)}" ${(S.t.sort || 'alert') === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
      </select></label>
    <span class="sp">
      <input type="search" id="trkQ" value="${esc(S.t.q)}" placeholder="搜名字 / 条件 / 标签"
        style="width:150px">
    </span>`;

  $('#trkOther').addEventListener('change', (e) => { S.t.other = e.target.value; loadTrackers(); });
  $('#trkOwner').addEventListener('change', (e) => { S.t.owner = e.target.value; loadTrackers(); });
  $('#trkStatus').addEventListener('change', (e) => { S.t.status = e.target.value; loadTrackers(); });
  $('#trkDir').addEventListener('change', (e) => { S.t.direction = e.target.value; loadTrackers(); });
  $('#trkSort').addEventListener('change', (e) => { S.t.sort = e.target.value; loadTrackers(); });
  const q = $('#trkQ');
  let qt = null;
  q.addEventListener('input', () => {
    clearTimeout(qt);
    qt = setTimeout(() => { S.t.q = q.value.trim(); loadTrackers(); }, 320);
  });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); q.blur(); } });
}

// 页头那几条提示。这里只放「你现在看到的数是什么口径」这一类话 ——
// 它是这一页最容易被误读的地方，所以宁可占地方也要写在最上面。
function renderTrkBanner() {
  const el = $('#trkbanner');
  const d = S.t.data;
  if (!el || !d) return;
  const m = trkMeta();
  const cards = [];

  // 1.（已挪到顶栏）"看的是历史口径"现在由顶栏整站提示，这一页不再重复一条。

  // 2.（已挪到顶栏）配置和库里登记的口径对不上，是全站的问题：顶栏「口径有 N 处不一致」一处说。
  // 3. 换尺子的总账已经写在页头 lede 里（「N 条线换过尺子，涉及 M 条内容的归属」），这里不再重复一条横幅；
  //    只在"对照了另一把、却一条都没变"时说一句，那是 lede 里看不出来的。
  const tt = d.totals;
  if (d.other_version && !tt.drifted) {
    cards.push({ lv: 'ok', t: '分类改版没有影响这些追踪项',
      x: `v${esc(d.version)} 和 v${esc(d.other_version)} 两版口径下，各追踪项的条数完全一致。` });
  }

  // 4. 落盘快照 vs 这一屏现算。两个数说的是两件事，不说清就会被当成数字错了。
  const snap = d.snapshot || {};
  if (snap.version && snap.version !== d.version) {
    cards.push({ lv: 'note', t: '和周报的数字不同',
      x: `这一页按 v${esc(d.version)} 现算；周报快照按 `
        + `<b>v${esc(snap.version)}</b> 计算（${esc((snap.computed_at || '').slice(0, 16).replace('T', ' '))}），口径不同。` });
  }

  if (!cards.length) { el.innerHTML = ''; return; }
  el.innerHTML = cards.map((c) => `<div class="trknote ${c.lv}">
      <b>${esc(c.t)}</b><span>${c.x}</span></div>`).join('');
}

// Dock 里的趋势图。手写 SVG，不引库：一条线 12 个点，P0 周红点，本周在告警时套一个环，
// 基线均值一条虚线 —— 告警条件之一是"本周 ≥ 基线 × N"，把基线画出来，那个判断就看得见了。
// hover 出数走 <title>，零依赖里最便宜的提示。
function trkChart(d) {
  const ser = d.series || [];
  if (!ser.length) return '<div class="ctx" style="color:var(--tx3)">还没有走势数据。</div>';
  // viewBox 按抽屉里的实际宽度画（≈680）：以前是 440 被拉伸 1.5 倍，字和点跟着一起放大。
  const W = 680; const H = 190; const pl = 36; const pr = 14; const pt = 16; const pb = 30;
  const iw = W - pl - pr; const ih = H - pt - pb;
  const base = typeof d.baseline_mean === 'number' ? d.baseline_mean : null;
  const max = Math.max(1, ...ser.map((s) => s.mentions), base || 0);
  const x = (i) => pl + (ser.length === 1 ? iw / 2 : i / (ser.length - 1) * iw);
  const y = (v) => pt + ih - v / max * ih;
  const f = (n) => n.toFixed(1);
  const pts = ser.map((s, i) => `${f(x(i))},${f(y(s.mentions))}`);
  const area = `M${f(x(0))},${f(y(0))} L${pts.join(' L')} L${f(x(ser.length - 1))},${f(y(0))} Z`;
  const step = ser.length > 8 ? 2 : 1;
  const xl = ser.map((s, i) => (i % step === (ser.length - 1) % step)
    ? `<text class="xl" x="${f(x(i))}" y="${H - 6}" text-anchor="middle">${esc(s.short)}</text>` : '').join('');
  const dots = ser.map((s, i) => {
    const last = i === ser.length - 1;
    const tip = `${s.short} · ${s.mentions} 条${s.p0 ? ` · P0 ${s.p0}` : ''}${last ? ' · 本周' : ''}`;
    return `<g class="pt">${last && d.alert ? `<circle class="ring" cx="${f(x(i))}" cy="${f(y(s.mentions))}" r="7"/>` : ''}
      <circle class="${s.p0 ? 'p0' : ''}${last ? ' cur' : ''}" cx="${f(x(i))}" cy="${f(y(s.mentions))}" r="3.2"><title>${esc(tip)}</title></circle></g>`;
  }).join('');
  return `<svg class="trkchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ser.length} 周提及量走势">
    <line class="axis" x1="${pl}" y1="${f(y(0))}" x2="${W - pr}" y2="${f(y(0))}"/>
    <text class="yl" x="${pl - 6}" y="${f(y(max)) + 4}" text-anchor="end">${max}</text>
    <text class="yl" x="${pl - 6}" y="${f(y(0)) + 4}" text-anchor="end">0</text>
    ${base != null && base > 0 ? `<line class="base" x1="${pl}" y1="${f(y(base))}" x2="${W - pr}" y2="${f(y(base))}"/>
      <text class="bl" x="${W - pr}" y="${f(y(base)) - 3}" text-anchor="end">基线 ${base}</text>` : ''}
    <path class="area" d="${area}"/>
    <polyline class="line" points="${pts.join(' ')}"/>
    ${dots}
    ${xl}
  </svg>
  <div class="trkchart-legend"><i class="d p0"></i>P0 周　<i class="d cur"></i>本周${d.alert ? '　<i class="d ring"></i>在告警' : ''}${base ? '　<i class="d base"></i>基线均值' : ''}</div>`;
}

function trkSpark(series) {
  const mx = Math.max.apply(null, series.map((s) => s.mentions).concat([1]));
  return series.map((s) => {
    const h = Math.max(2, Math.round(s.mentions / mx * 22));
    const cls = s.p0 ? 'p0' : '';
    return `<i class="${cls}" style="height:${h}px" title="${esc(s.short)} · ${s.mentions} 条${
      s.p0 ? ' · P0 ' + s.p0 : ''}"></i>`;
  }).join('');
}

// 把口径差说成一句话。**方向必须按时序**：对照的可能是更早那把，也可能是更新那把。
// 直接写"差 +10"是没用的 —— 正负号在两种关系下含义正好相反（对照更早那把时，
// 正数表示"以前算得更多"；对照更新那把时，正数表示"新分类收编得更多"）。
// 所以一律排成年月顺序：先发生的那把 → 后发生的那把。这样只有一种读法。
function driftLine(thisVer, thisTotal, dr) {
  const chrono = dr.relation === 'next';   // 对照的是更新那把 → 这一屏反而在前
  const aV = chrono ? thisVer : dr.version, aN = chrono ? thisTotal : dr.total;
  const bV = chrono ? dr.version : thisVer, bN = chrono ? dr.total : thisTotal;
  const d = bN - aN;
  return { aV, aN, bV, bN, d,
    txt: `v${aV} 的 ${aN} 条 → v${bV} 的 ${bN} 条（${d > 0 ? '多' : '少'} ${Math.abs(d)} 条）` };
}

// 徽章只挂「差得多」的行：两版条数差 ≥ 较早那版的 100%，即翻倍或降到 0（较早那版是 0 条时，有差就算）。
// 差得少的照样算进页头计数和「口径变动」chip，只是不在行上挂徽章：十行都挂等于没挂。
const DRIFT_BADGE_RATIO = 1;
const driftBig = (L) => (L.aN ? Math.abs(L.d) / L.aN >= DRIFT_BADGE_RATIO : L.d !== 0);

// 换尺子的徽章文字。前缀那把版本用**时序在前**的那把 —— 写成 "v1.1 32→22"
// 会让人以为 32 是 v1.1 的数（实际是 v1.0 的）。
function driftBadge(r) {
  const dr = r.drift;
  if (!dr || !dr.changed || trkOtherEmpty()) return '';
  const L = driftLine(r.version, r.total, dr);
  if (!driftBig(L)) return '';
  return `<span class="flag drift" title="口径变动：v${L.aV} 算 ${L.aN} 条，v${L.bV} 算 ${L.bN} 条。差值来自分类改版把部分内容归到了别的主题，和产品表现无关">口径变动 v${esc(L.aV)} ${L.aN}→${L.bN}</span>`;
}

function renderTrkRows() {
  const el = $('#trklist');
  const d = S.t.data;
  if (!el || !d) return;
  const rows = trkVisibleRows();
  if (!rows.length) {
    el.innerHTML = `<div class="card"><div class="empty"><b>符合筛选的追踪项 · 0</b>
      换个负责人或状态${S.t.view ? '，或取消上方的状态筛选' : ''}。</div></div>`;
    return;
  }
  const statuses = trkMeta().statuses || [];
  const opts = statuses.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');

  el.innerHTML = `<div class="card">` + rows.map((r) => {
    const host = r.host || {};
    const onHost = host.kind === 'exp';
    const dirCls = r.direction === '上升' ? 'up' : (r.direction === '下降' ? 'dn' : '');
    // 告警徽章上写的是**触发条件**，不是"告警"两个字 —— 后者等于把标题又抄一遍。
    // 一条线为什么被顶到最前面，得在列表上就看得见。
    const reasons = r.alert_reasons || [];
    const alertBadge = reasons.length
      ? `<span class="flag alert" title="告警条件：${esc(reasons.join('；'))}">${esc(reasons[0])}</span>`
      : '';
    // 负责人从哪来。挂一个两字徽章而不是写一整句 —— 一整句会折行，
    // 把这一行撑高 18px，十行列表就成了高低不平的锯齿。详情在哪看得到。
    const srcMark = r.owner_source === 'config'
      ? '<span class="srcbadge" title="负责人是配置里预设的，还没有人正式认领">配置</span>'
      : (r.owner_source === 'none' && r.owner
        ? '<span class="srcbadge" title="负责人来源不明">?</span>' : '');
    const cur = r.current || {};
    // 状态那行只说状态本身。"还没人判过要做还是不做"曾经也在这里占一行 ——
    // 它和「从没登记过」是同一句话，重复一遍只会让行高不齐。
    const stTxt = r.status_id
      ? `${esc(statusLabel(r.status_id))}${r.updated_at ? ' · ' + esc(shortTime(r.updated_at)) : ''}`
      : '未登记状态';
    return `<div class="trkrow ${r.alert ? 'hot' : ''}" data-trk="${esc(r.id)}" role="button" tabindex="0" title="打开详情">
      <div class="c1">
        <div class="nm"><span class="t">${esc(r.name)}</span>
          ${r.direction ? `<span class="dir ${dirCls}">${esc(r.direction)}</span>` : ''}
          ${alertBadge}
          ${driftBadge(r)}
        </div>
        <div class="cond">${esc(r.filter_desc || '')}${
          (r.tags || []).length ? ' · ' + r.tags.map(esc).join('、') : ''}${
          // 「状态登记在哪张卡上」属于这条线的**定义**，和条件放同一行。
          // 单起一行会让十行列表有五种高度；而它和条件一样，是"这条线是什么"的一部分。
          onHost ? ` · <span class="onhost" title="这个追踪项对应体验域「${esc(host.name)}」，状态和负责人记在看板的「${esc(host.name)}」卡片上，在这里改会同步到那张卡">状态记在「${esc(host.name)}」卡上</span>` : ''}</div>
      </div>
      <div class="c2"><div class="spark2">${trkSpark(r.series)}</div>
        <div class="sp2" title="走势图覆盖最近 ${r.series.length} 周（${esc(r.series[0] ? r.series[0].short : '')}–${esc(r.series.length ? r.series[r.series.length - 1].short : '')}）">${
          r.peak && r.peak.mentions
            ? `峰值 ${esc(r.peak.short)} ${r.peak.mentions} 条` : '没有命中内容'}</div></div>
      <div class="c3">
        <div class="num"><b>${cur.mentions || 0}</b><span>本周</span></div>
        <div class="num"><b class="${
          r.delta_pct == null || !cur.mentions ? '' : (r.delta_pct > 0 ? 'up' : (r.delta_pct < 0 ? 'dn' : ''))}">${
          r.delta_pct == null || !cur.mentions ? '—' : (r.delta_pct > 0 ? '+' : '') + r.delta_pct + '%'}</b><span>环比</span></div>
        <div class="num"><b>${r.total}</b><span>累计</span></div>
        <div class="num"><b class="${cur.p0 ? 'up' : ''}">${cur.p0 || 0}</b><span>P0</span></div>
      </div>
      <div class="c4">
        <div class="ow ${r.owner ? '' : 'dim'}">${esc(r.owner || '未认领')}${srcMark}</div>
        <div class="st2 ${stClass(r.status_id)}">${stTxt}</div>
      </div>
      <div class="c5">
        ${S.canWrite ? `<select class="stsel" data-st="${esc(r.id)}">
          <option value="">— 改状态 —</option>${opts}</select>` : ''}
      </div>
    </div>`;
  }).join('') + `</div>`;

  // 整行就是入口（没有「看明细」按钮）：点行开 Dock；下拉和链接自己处理自己的点击。
  el.querySelectorAll('.trkrow').forEach((row) => {
    row.addEventListener('click', (ev) => {
      if (ev.target.closest('select') || ev.target.closest('button') || ev.target.closest('a')) return;
      openTracker(row.dataset.trk);
    });
    row.addEventListener('keydown', (ev) => {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === row) { ev.preventDefault(); openTracker(row.dataset.trk); }
    });
  });
  el.querySelectorAll('select[data-st]').forEach((sel) => {
    sel.addEventListener('click', (ev) => ev.stopPropagation());
    sel.addEventListener('change', () => doTrackerStatus(sel.dataset.st, sel.value, sel));
  });
}

async function doTrackerStatus(id, sid, sel) {
  if (!sid) return;
  const row = (S.t.data.rows || []).find((r) => r.id === id);
  // 「不处理」要一句当下的理由，和看板同一套规矩 —— 一律送进抽屉去写。
  if (sid === 'st.wontfix') {
    toast('标为「不处理」要先写一句理由', true);
    if (sel) sel.value = '';
    return openTracker(id, true, true);
  }
  try {
    const r = await post(`/api/trackers/${encodeURIComponent(id)}/status`,
                         { status_id: sid, actor: S.actor });
    const onHost = row && row.host && row.host.kind === 'exp';
    toast('已改为 ' + statusLabel(sid)
      + (onHost ? `，看板「${row.host.name}」卡片同步更新` : ''));
    await loadTrackers();
  } catch (e) { toast(e.message, true); await loadTrackers(); }
}

// ---------------------------------------------------------------- 追踪项详情

async function openTracker(id, quiet, focusNote) {
  try {
    const d = await get('/api/trackers/' + encodeURIComponent(id)
      + (S.version ? '?version=' + encodeURIComponent(S.version) : ''));
    S.t.detail = d;
    drawTrackerDrawer(d, focusNote);
    document.querySelectorAll('.trkrow').forEach((r) =>
      r.classList.toggle('pick', r.dataset.trk === id));
  } catch (e) {
    if (!quiet) toast(e.message, true);
  }
}

function drawTrackerDrawer(d, focusNote) {
  const alt = d.alt;
  const st = d.state || {};
  const statuses = trkMeta().statuses || S.meta.statuses || [];

  // 双尺子对照。分三层说：总账 → 这批条目在两把尺子下各算什么 → 逐条。
  let altHtml = '<div class="ctx" style="color:var(--tx3)">没有可对照的其他口径版本。</div>';
  if (alt) {
    const rel = alt.relation === 'next' ? '较新的版本' : '较早的版本';
    const df = alt.diff || {};
    const L = driftLine(d.version, d.total, alt);
    const head = verNoTags(alt.version)
      ? `<div class="trknote note" style="margin-bottom:9px"><b>没法对照：v${esc(alt.version)} 在库里没有标签</b>
          <span>下面列出的差异只说明 v${esc(alt.version)} 没打过标，不是分类改版造成的。</span></div>`
      : alt.changed
      ? `<div class="trknote drift" style="margin-bottom:9px"><b>口径变动：${L.txt}</b>
          <span>对照 <b>v${esc(alt.version)}</b>（${esc(rel)}）</span>${infoI('差值来自分类改版：部分内容被归到了别的主题，和产品表现无关。下面逐条列出这些内容。')}</div>`
      : `<div class="ctx">v${esc(alt.version)}（${esc(rel)}）下同样是 ${d.total} 条，这次分类改版没有影响这个追踪项。</div>`;

    let groups = '';
    if (alt.changed) {
      const fmt = (xs) => (xs || []).length
        ? xs.map(([n, c]) => `${esc(n)} ${c} 条`).join('、') : '—';
      groups += `<div class="ctx" style="margin-top:8px">这些内容在两个版本下的归属：
        <div>· v${esc(df.other_version)} 下算 <b>${fmt(df.exp_other)}</b></div>
        <div>· v${esc(df.this_version)} 下算 <b>${fmt(df.exp_this)}</b></div></div>`;

      // 双列对照：条目 │ 旧尺子下算什么 │ 新尺子下算什么。两列按时序排（先发生的那把在左），
      // 不按"这一屏 / 另一把"排 —— 对照的可能是更早的，也可能是更新的那把。
      const older = alt.relation === 'next'
        ? { v: df.this_version, key: 'exp_this' } : { v: df.other_version, key: 'exp_other' };
      const newer = alt.relation === 'next'
        ? { v: df.other_version, key: 'exp_other' } : { v: df.this_version, key: 'exp_this' };
      const cell = (x, k) => esc((x[k] || []).join(' / ') || '—');
      const gridOf = (label, arr) => (arr || []).length
        ? `<div class="ctx" style="margin-top:10px"><b>${esc(label)}</b></div>
          <div class="drift-grid">
            <div class="dg-h">条目</div><div class="dg-h">v${esc(older.v)} 归属</div><div class="dg-h">v${esc(newer.v)} 归属</div>
            ${arr.slice(0, 8).map((x) => `
              <div class="dg-t ditem" data-item="${esc(x.insight_id)}">${esc((x.text || '').slice(0, 60))}
                <div class="u">${x.like_count} 赞 · ${esc(x.item_type === 'comment' ? '评论' : '笔记')}${
                  x.sev_label ? ' · ' + esc(x.sev_label) : ''}</div></div>
              <div class="dg-v">${cell(x, older.key)}</div>
              <div class="dg-v">${cell(x, newer.key)}</div>`).join('')}
          </div>
          ${arr.length > 8 ? `<div class="u" style="color:var(--tx3)">…… 还有 ${arr.length - 8} 条</div>` : ''}`
        : '';
      groups += gridOf(`只在 v${df.other_version} 下计入`, df.left);
      groups += gridOf(`只在 v${df.this_version} 下计入`, df.joined);
    }
    altHtml = head + groups;
  }

  // 逐周明细。每周都给前 N 条原文 —— 光看一个数字没法判断"这周到底在骂什么"。
  const weekly = (d.weekly || []).map((w) => {
    const mx = Math.max.apply(null, (d.weekly || []).map((x) => x.mentions).concat([1]));
    const bar = '█'.repeat(Math.max(0, Math.round(w.mentions / mx * 18))) || '·';
    const items = (w.items || []).length
      ? (w.items || []).map((i) => `<div class="ditem" data-item="${esc(i.insight_id)}">
          ${esc((i.text || '').slice(0, 78))}
          <div class="u">${i.like_count} 赞 · ${esc(i.item_type === 'comment' ? '评论' : '笔记')}
            ${(i.exp || []).length ? ' · ' + i.exp.map((e) => esc(valLabel('experience', e))).join('/') : ''}
            ${i.sev ? ' · ' + esc(valLabel('severity', i.sev)) : ''}</div></div>`).join('')
      : '<div class="u" style="color:var(--tx3)">这一周没有命中的内容</div>';
    return `<div class="wk">
        <div class="wh"><b>${esc(w.short)}</b>
          <span class="m">提及 ${w.mentions} · 笔记 ${w.posts} / 评论 ${w.comments}${
            w.unique_posts ? ` · 涉及 ${w.unique_posts} 篇` : ''}${
            w.p0 ? ` · <span style="color:var(--p0)">P0 ${w.p0}</span>` : ''}</span>
          <span class="bar" aria-hidden="true">${bar}</span></div>
        ${items}
        ${w.items_total > (w.items || []).length
          ? `<div class="u" style="color:var(--tx3)">这一周共 ${w.items_total} 条，显示前 ${(w.items || []).length} 条</div>` : ''}
      </div>`;
  }).join('') || '<div class="ctx" style="color:var(--tx3)">没有逐周数据。</div>';

  const evs = (d.events || []).map((e) => `<div class="ev">
      <span class="w">${esc(shortTime(e.at))}</span>
      <span class="b">${esc(e.actor || '')} <b>${esc(e.action === 'theme_status' ? '改状态' : e.action)}</b>
        ${e.from_value || e.to_value
          ? '：' + esc(statusLabel(e.from_value) || '未登记') + ' → ' + esc(statusLabel(e.to_value)) : ''}
        ${e.note ? ' · ' + esc(e.note) : ''}</span></div>`).join('')
    || `<div class="ctx" style="color:var(--tx3)">${
      st.registered ? '还没有操作记录。' : '从没登记过状态。'}</div>`;

  const snap = d.snapshot || {};
  const snapLine = !snap.version
    ? '还没有周报快照。'
    : (snap.version === d.version
        ? ''
        : `周报快照按 <b>v${esc(snap.version)}</b> 计算（${esc((snap.computed_at || '').slice(0, 16).replace('T', ' '))}），和这一页口径不同，数字不一致属正常。`);
  const breaks = d.snapshot_uniform ? '' : `<div class="ctx" style="color:var(--p1);margin-top:5px">
      ${iconSvg('alert', 14, 'inl')}周报快照中途换过口径（分两次保存），和任何单一版本都对不上：
      ${(d.snapshot_breaks || []).map((b) => esc(b.note)).join('；')}</div>`;

  dockMount('tracker', d.id, openTracker, `
      <div class="dh">
        <div style="flex:1;min-width:0">
          <h2>${esc(d.name)}</h2>
          <div style="font-size: 13px;color:var(--tx3);margin-top:4px">
            ${esc(d.filter_desc || '')} · 口径 v${esc(d.version)}
            ${d.host && d.host.kind === 'exp'
              ? ` · 状态记在「${esc(d.host.name)}」卡上` : ''}
          </div>
        </div>
      </div>
      <div class="db">
        <div class="kv" style="margin-bottom:16px">
          <dt>负责人</dt><dd>${esc(d.owner || '未认领')}
            ${d.owner_source === 'config' ? '<span style="color:var(--tx3)">（配置里预设的，还没有人正式认领）</span>' : ''}
            ${d.owner_source === 'none' && d.owner ? '<span style="color:var(--tx3)">（来源不明）</span>' : ''}</dd>
          <dt>状态</dt><dd>${esc(statusLabel(d.status_id))}${
            d.updated_at ? `　上次改动 ${esc(shortTime(d.updated_at))}${
              st.dwell_days ? `（${st.dwell_days} 天前）` : ''}` : '　从没登记过'}</dd>
          <dt>本周 / 累计</dt><dd>${d.current ? d.current.mentions : 0} 条 / ${d.total} 条
            ${d.current && d.current.p0 ? `· <span style="color:var(--p0)">P0 ${d.current.p0}</span>` : ''}</dd>
        </div>

        <div class="sect"><h3>${(d.series || []).length} 周走势
            <span class="sp">${d.alert ? `告警：${esc((d.alert_reasons || []).join('；'))}` : `基线均值 ${d.baseline_mean == null ? '—' : d.baseline_mean} 条 / 周`}</span></h3>
          ${trkChart(d)}</div>

        <div class="sect"><h3>口径对照 <span class="sp">按 v${esc(d.version)} 算</span></h3>
          ${altHtml}
          ${snapLine || breaks ? `<div class="note" style="margin-top:10px">${snapLine}${breaks}</div>` : ''}
        </div>

        <div class="sect"><h3>逐周明细</h3>${weekly}</div>

        <div class="sect"><h3>状态时间线</h3>${evs}</div>

        <div class="sect"><h3>备注 <span class="sp">「不处理」必须写理由</span></h3>
          <textarea id="trknote" rows="3" style="width:100%"
            placeholder="为什么这么定：排到哪个版本、为什么不处理、和谁对齐过">${esc(d.note || '')}</textarea></div>
      </div>
      <div class="df">
        <select id="trkst">
          <option value="" ${!d.status_id ? 'selected' : ''}>— 未登记 —</option>
          ${statuses.map((s) =>
            `<option value="${esc(s.id)}" ${d.status_id === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
        </select>
        <input type="text" id="trkowner" value="${esc(d.owner || '')}" placeholder="负责人"
               style="width:96px" list="trkownerlist">
        <datalist id="trkownerlist">
          ${[...new Set([...(trkMeta().owners || []), S.actor, d.owner].filter(Boolean))]
            .map((o) => `<option value="${esc(o)}"></option>`).join('')}
        </datalist>
        <button class="btn" id="trksave">保存</button>
        <button class="btn danger" id="trkwont">不处理</button>
      </div>
  `);

  $('#dock').querySelectorAll('[data-item]').forEach((x) => {
    x.addEventListener('click', () => openDetail(x.dataset.item));
  });

  const save = async (status_id, forceNote) => {
    const raw = $('#trknote') ? $('#trknote').value.trim() : '';
    // 备注框里预填的是上一条备注。「不处理」要的是**当下**的理由，
    // 内容没改过就拦下 —— 服务端也会拒，这里先拦，别让人对着报错发愣。
    if (forceNote && d.status_id !== 'st.wontfix' && raw === (d.note || '').trim()) {
      toast(raw ? '请更新「不处理」的理由，框里还是上一条备注' : '先写一句为什么不处理', true);
      $('#trknote').focus();
      return;
    }
    const owner = $('#trkowner').value.trim();
    const body = { status_id, actor: S.actor, note: raw };
    // owner 只在真的改过时才发：None = 不动，空串 = 清空。
    // 无条件发空串会把从配置继承来的负责人抹掉。
    if (owner !== (d.owner || '')) body.owner = owner;
    try {
      const r = await post(`/api/trackers/${encodeURIComponent(d.id)}/status`, body);
      toast('已保存' + (r.theme_id ? `，同步到「${(d.host || {}).name || r.theme_id}」卡片` : ''));
      await loadTrackers();
      await openTracker(d.id, true);
    } catch (e) { toast(e.message, true); }
  };

  $('#trksave').addEventListener('click', () => {
    const sid = $('#trkst').value;
    if (!sid) { toast('先选一个状态', true); return; }
    save(sid, false);
  });
  $('#trkwont').addEventListener('click', () => save('st.wontfix', true));
  if (focusNote) { const n = $('#trknote'); if (n) n.focus(); }
}

// ---------------------------------------------------------------- 页面 2：本周看板
//
// 这一页回答「这段时间发生了什么」——是一段横切面，要能被翻着看。
// 工作台回答「今天该我做什么」（一次判断，一屏，不筛不翻页）；
// 洞察池 / 看板回答「这批东西归谁管、走到哪一步」（查询）。
//
// **每个数字都带着它自己的筛选条件**（`to`），这是这一页存在的真正理由：
// 「P0 有 7 条」如果点不动，看的人只会记住 7，而不会去做那 7 件事。
// `to` 是后端给的**语义**（这个数对应哪批东西），URL 长什么样是路由层的事 ——
// 分开的好处是同一个数既能点、也能被测试断言（tests/test_dashboard.py）。
//
// 它是只读页，两条刻意的"不做"写在数据里（not_done）再由页面渲染出来：
// 不做批量认领（洞察池已经有一整套，这里再做一份必然分叉），
// 不做 PNG 导出（零依赖是底线）。让"没做"和"忘了做"长得不一样。

async function renderWeeklyPage() {
  $('#main').innerHTML = `
    <div class="head">
      <div>
        <h1 id="wkh1">本周看板</h1>
        <div class="sub" id="wklede">正在加载…</div>
      </div>
      <div class="rt" id="wkrt"></div>
    </div>
    <div id="wk"><div class="empty">正在加载…</div></div>`;
  if (S.w.data) renderWeekly();
  await loadDashboard();
}

let _wkLoading = false;

async function loadDashboard() {
  if (_wkLoading) return;
  _wkLoading = true;
  syncHash('weekly');

  const btn = $('#wkReload');
  const daysSel = $('#wkDays');
  const lede = $('#wklede');
  const el = $('#wk');

  if (btn) { btn.disabled = true; btn.textContent = '加载中…'; }
  if (daysSel) daysSel.disabled = true;
  if (lede) lede.innerHTML = '<span class="sp">正在加载看板数据…</span>';
  if (el) el.style.opacity = '0.5';

  const p = new URLSearchParams();
  p.set('days', S.w.days);
  if (S.version) p.set('version', S.version);
  try {
    S.w.data = await get('/api/dashboard?' + p.toString());
    renderWeekly();
  } catch (e) {
    if (el) el.innerHTML = `<div class="empty"><b>看板加载失败</b>${esc(e.message)}</div>`;
  } finally {
    _wkLoading = false;
    const curEl = $('#wk');
    if (curEl) curEl.style.opacity = '';
    const curBtn = $('#wkReload');
    if (curBtn) { curBtn.disabled = false; curBtn.textContent = '刷新'; }
    const curDays = $('#wkDays');
    if (curDays) curDays.disabled = false;
  }
}

const wkTo = (to) => (to ? ` data-to="${esc(JSON.stringify(to))}"` : '');
// 可点的地方必须一眼看得出来。一个看起来像普通文字/普通行的入口，
// 等于没有入口 —— 而"每个数都能点"正是这一页的卖点。
const wkClick = (to) => (to ? ' clickable' : '');

function wkDelta(v, cur) {
  if (v === null || v === undefined) return '<span class="delta flat">无环比</span>';
  // 本窗口一条都没有：是没数据，不是「降了 100%」，更不是好转
  if (cur === 0) return '<span class="delta flat">—</span>';
  const cls = v > 0 ? 'up' : v < 0 ? 'dn' : 'flat';
  const mark = v > 0 ? iconSvg('arrowUp', 12) : v < 0 ? iconSvg('arrowDown', 12) : '—';
  return `<span class="delta ${cls}">${mark}${v > 0 ? '+' : ''}${v}%</span>`;
}

// 和 report.py 的 _heat_color 同一套色阶。静态看板、后台看板、周报
// 说的必须是同一件事 —— 换个地方看就换个颜色，人会以为数据变了。
function heatColor(v, max) {
  if (!v || !max) return { bg: 'var(--sur)', fg: 'var(--tx3)' };
  const r = v / max;
  // 四档全走 Geist 红阶：100 → 300 → 500 → 700；字色跟着底走，700 实心上用白字。
  if (r >= 0.75) return { bg: 'var(--red-700)', fg: 'var(--white)' };
  if (r >= 0.5) return { bg: 'var(--red-500)', fg: 'var(--red-1000)' };
  if (r >= 0.25) return { bg: 'var(--red-300)', fg: 'var(--red-900)' };
  return { bg: 'var(--red-100)', fg: 'var(--red-900)' };
}

// 专注模式：区块右上角 ⤢，展开成全宽（交叉热力图 14 列尤其需要），Esc 或再点一次退出。
const WK_FOCUS_BTN = `<button type="button" class="focus-btn" data-focus="1" title="展开成全宽（Esc 退出）">${
  iconSvg('maximize', 14, 'i-max')}${iconSvg('minimize', 14, 'i-min')}</button>`;

function wkSec(title, body, right, id) {
  return `<div class="sec"${id ? ` id="${esc(id)}"` : ''}><h2>${esc(title)}${right ? `<span class="sp">${right}</span>` : '<span class="sp"></span>'}${WK_FOCUS_BTN}</h2>
    ${body}</div>`;
}

function wkUnfocus() {
  const f = document.querySelector('#wk .sec.focused');
  if (!f) return false;
  f.classList.remove('focused');
  const bd = document.getElementById('wkFocusBackdrop');
  if (bd && bd.remove) bd.remove();
  return true;
}

function wkBindFocus(root) {
  root.querySelectorAll('[data-focus]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const sec = b.closest ? b.closest('.sec') : null;
    if (!sec) return;
    if (sec.classList.contains('focused')) { wkUnfocus(); return; }
    wkUnfocus();
    sec.classList.add('focused');
    const bd = document.createElement('div');
    bd.id = 'wkFocusBackdrop'; bd.className = 'focus-backdrop';
    bd.addEventListener('click', wkUnfocus);
    document.body.appendChild(bd);
  }));
}

function renderWeekly() {
  const d = S.w.data;
  const el = $('#wk');
  if (!el || !d) return;

  const lede = $('#wklede');
  if (lede) {
    // 标题跟着窗口走。一个叫「本周」却按 28 天算的页面，和把 v1.1 的指纹挂在
    // v1.0 的报表上是同一类错：数字都对，尺子名不对。所以标题用后端给的那个
    // （PAGE_TITLES 和实际天数同源），不在前端再拼一份。
    const h1 = $('#wkh1');
    if (h1) h1.textContent = d.title;
    // 只写这一页自己的视图参数（窗口）。分类体系版本在顶栏，上期窗口和采集源是元数据，不影响看数。
    lede.innerHTML = `窗口 ${esc(d.window.start)} → ${esc(d.window.end)}（${esc(d.window.label)}）`;
  }
  const rt = $('#wkrt');
  if (rt) {
    // 口径开关在顶栏（全站一把尺子）。窗口是这一页自己的视图设置，留在这里。
    rt.innerHTML = `
      <label class="chk">窗口
        <select id="wkDays">
          ${(d.options.windows || []).map((w) => `<option value="${w.days}"
            ${d.window.days === w.days ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}
        </select></label>
      <button class="btn sm" id="wkReload">刷新</button>`;
  }

  // Bento：全宽纵排改成有主次的网格。模块一个不少，只是排法变了：
  //   KPI → [热力榜 2/3 | 跟进状态 1/3] → 交叉热力图（14 个品类线确实要全宽）
  //   → [情绪 | 严重度 | 新增高频词] → [疑似已改善 | P0 预览] → 导出与"这页没做什么"
  // 「跟进状态」从原来的三连里提出来放到热力榜旁边：它点去的是看板，和热力榜同属"问题在哪"。
  el.innerHTML = [
    `<section id="wk-kpi">${wkKpis(d)}</section>`,
    `<div class="wk-hot-row">${wkHot(d)}${wkDistBlock('wk-status', '跟进状态（主题级）', d.status)}</div>`,
    `<section id="wk-cross">${wkCross(d)}</section>`,
    `<div class="grid3">
      ${wkDistBlock('wk-dist', '情绪分布', d.sentiment)}
      ${wkDistBlock('wk-sev', '严重度分布', d.severity)}
      ${wkWordBlock('wk-words', '新增高频词', d.rising, 'rising')}
    </div>`,
    `<div class="grid2">
      ${wkWordBlock('wk-resolved', '疑似已改善', d.resolved, 'resolved')}
      <section id="wk-p0">${wkP0(d)}</section>
    </div>`,
    `<section id="wk-export">${wkFoot(d)}</section>`,
  ].join('');
  wkBindFocus(el);

  // 换窗口 = 换一整批数（本期和上期都变），所以整屏重取，不局部刷新。
  // 换口径同理 —— 这两个都不是"筛选一下当前这一屏"。
  $('#wkDays').addEventListener('change', (e) => { S.w.days = +e.target.value; loadDashboard(); });
  $('#wkReload').addEventListener('click', loadDashboard);

  el.querySelectorAll('[data-to]').forEach((x) => {
    x.addEventListener('click', (ev) => {
      // 行里还有别的可点东西（原帖链接、KPI 里那半格「评论」数），
      // 谁离点击处更近谁处理 —— 否则点在「评论 12」上会先跳评论、再被外面那层
      // 覆盖成「全部」。
      if (ev.target.closest('a[href]')) return;
      if (ev.target.closest('[data-to]') !== x) return;
      goto(JSON.parse(x.dataset.to));
    });
  });
  el.querySelectorAll('[data-open]').forEach((x) => {
    x.addEventListener('click', () => openDetail(x.dataset.open));
  });
}

// 一个大数字 + 一句话，取代五张 KPI 卡（DESIGN.md：一页一个大数字，其余数字进句子）。
// 数一个没少，每个数照旧能点（data-to），点了带着筛选条件去洞察池。
function wkKpis(d) {
  const [lead, ...rest] = d.kpis || [];
  if (!lead) return '';
  const num = (v, to, warn) => `<b class="${wkClick(to).trim()}${warn ? ' warn' : ''}"${wkTo(to)}>${esc(v)}</b>`;
  const seg = (k) => {
    const second = k.second === undefined ? '' : ` / ${num(k.second, k.second_to)}`;
    const dl = k.delta === null || k.delta === undefined ? '' : ` ${wkDelta(k.delta)}`;
    return `<span class="seg" title="${esc(k.hint)}">${esc(k.label)} ${num(k.value, k.to, k.key === 'p0' && k.value)}${second} ${esc(k.unit)}${dl}</span>`;
  };
  return `<div class="wk-lead">
    <span class="big${wkClick(lead.to)}"${wkTo(lead.to)} title="${esc(lead.hint)}">${esc(lead.value)}<span class="unit">${esc(lead.unit)}</span></span>
    <div class="txt">
      <div class="l1">${esc(lead.label)}${lead.prev === undefined ? '' : ` · 上期 ${esc(lead.prev)}`} · ${wkDelta(lead.delta, lead.value === 0 ? 0 : undefined)}</div>
      <div class="l2">${rest.map(seg).join('<i class="sepdot">·</i>')}</div>
    </div>
  </div>`;
}

function wkHot(d) {
  if (!d.exp_stats.length) {
    return wkSec('痛点热力榜', '<div class="empty">这个窗口内没有数据。先跑一次采集。</div>', '', 'wk-hot');
  }
  const max = Math.max(...d.exp_stats.map((e) => e.heat), 1);
  const rows = d.exp_stats.map((e, i) => {
    const pct = Math.round(e.heat / max * 100);
    const cls = pct >= 60 ? 'hot' : pct >= 30 ? 'mid' : '';
    const samples = e.samples.slice(0, 2)
      .map((sm) => `<div class="sm">${esc(String(sm.text || '').slice(0, 72))}</div>`).join('')
      || '<div class="sm" style="color:var(--tx3)">本窗口无新增样本</div>';
    return `<tr class="rowlink"${wkTo(e.to)}>
      <td class="num" style="color:var(--tx3)">${i + 1}</td>
      <td><b>${esc(e.label)}</b></td>
      <td class="num">${e.mentions}</td>
      <td class="num">${e.p0 ? `<span class="chip p0">${e.p0}</span>` : '<span class="sm">—</span>'}</td>
      <td class="num">${esc(e.heat)}</td>
      <td class="num">${wkDelta(e.delta, e.mentions)}</td>
      <td style="width:88px"><div class="bar ${cls}"><i style="width:${pct}%"></i></div></td>
      <td>${samples}</td>
    </tr>`;
  }).join('');
  const body = `<table>
    <thead><tr><th></th><th>体验域</th><th class="num">提及</th><th class="num">P0</th>
    <th class="num">热度</th><th class="num">环比</th><th>强度</th><th>样本</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  return wkSec('痛点热力榜', body, '', 'wk-hot');
}

function wkCross(d) {
  const rows = d.cross.rows, cols = d.cross.cols;
  const cells = {};
  let max = 0;
  d.cross.cells.forEach((c) => {
    cells[`${c.exp}|${c.cat}`] = c;
    if (c.n > max) max = c.n;
  });
  if (!rows.length || !cols.length) {
    return wkSec('体验域 × 品类线', '<div class="empty">这个窗口内没有带标签的内容，交叉分布画不出来。</div>');
  }
  const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const body = rows.map((r) => {
    const tds = cols.map((c) => {
      const from = cells[`${r.value}|${c.value}`] || { n: 0, to: null };
      const n = from.n || 0;
      const to = from.to || null;
      const col = heatColor(n, max);
      return `<td class="${wkClick(to).trim()}"${wkTo(to)}
        style="background:${col.bg};color:${col.fg}"
        title="${esc(r.label)} × ${esc(c.label)}：${n} 条">${n || ''}</td>`;
    }).join('');
    return `<tr><th class="rowh">${esc(r.label)}</th>${tds}</tr>`;
  }).join('');
  const legend = `<div class="legend" style="margin:8px 0 0">
    <span><i style="background:var(--red-100)"></i>低</span>
    <span><i style="background:var(--red-300)"></i>中</span>
    <span><i style="background:var(--red-500)"></i>较高</span>
    <span><i style="background:var(--red-700)"></i>高</span>
    <span class="sp">点格子 = 同时按体验域和品类线筛</span></div>`;
  const table = `<table class="hm"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody>
    </table>${legend}`;
  return wkSec('体验域 × 品类线', `<div class="bd pad">${table}</div>`);
}

// 一块分布（情绪 / 严重度 / 跟进状态）。id 给锚点用。
function wkDistBlock(id, title, rows, note) {
  if (!rows.length) return `<div class="sec" id="${esc(id)}"><h2>${esc(title)}<span class="sp"></span>${WK_FOCUS_BTN}</h2>
    <div class="empty">这个窗口内没有数据</div></div>`;
  const total = rows.reduce((a, r) => a + r.n, 0) || 1;
  const body = rows.map((r) => `<div class="dist-row"${wkTo(r.to)}>
    <span class="nm">${esc(r.label)}</span>
    <span class="n">${r.n}</span>
    <span class="bar"><i style="width:${Math.round(r.n / total * 100)}%"></i></span>
  </div>`).join('');
  return `<div class="sec" id="${esc(id)}"><h2>${esc(title)}${note ? `<span class="sp">${esc(note)}</span>` : '<span class="sp"></span>'}${WK_FOCUS_BTN}</h2>
    <div class="bd">${body}</div></div>`;
}

// 一块词群（新增高频词 / 疑似已改善）。
function wkWordBlock(id, title, items, mode, note) {
  const chips = items.length ? `<div class="words">${items.map((w) => {
    const hot = mode === 'rising' ? ' hot' : ' dn';
    const badge = mode === 'rising' ? esc(`+${w.count - w.prev}`) : iconSvg('arrowDown', 12, 'arw');
    const tip = mode === 'rising'
      ? `本窗口 ${w.count} 次，上期 ${w.prev} 次`
      : `上期 ${w.prev} 次，本窗口 ${w.count} 次`;
    return `<span class="wchip${hot}"${wkTo(w.to)} title="${esc(tip)}">
      <b>${badge}</b>${esc(w.word)}</span>`;
  }).join('')}</div>` : '<div class="empty" style="padding:20px">无</div>';
  return wkSec(title, `<div class="bd pad">${chips}</div>`, note, id);
}

function wkP0(d) {
  if (!d.p0.count) {
    return wkSec('P0 阻断问题', '<div class="empty">这个窗口内没有 P0 级问题。</div>');
  }
  const rows = d.p0.items.map((it) => `<div class="p0row" data-open="${esc(it.insight_id)}">
    <div style="flex:0 0 auto">${(it.exp.length ? it.exp : ['未归类'])
      .slice(0, 2).map((x) => `<span class="chip p1">${esc(x)}</span>`).join('')}</div>
    <div class="tx">${esc(String(it.text || '').slice(0, 110))}</div>
    <div class="mt">${esc(it.type === 'post' ? '笔记' : '评论')} · ${esc(it.age_days)} 天前
      ${it.url ? ` · <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">原帖${EXT_ICON}</a>` : ''}</div>
  </div>`).join('');
  const more = d.p0.count > d.p0.shown
    ? `<div class="bd" style="padding:9px 13px;border-top:1px solid var(--bd)">
        <span class="btn sm"${wkTo(d.p0.to)}>还有 ${d.p0.count - d.p0.shown} 条 · 去洞察池看全部未认领的 P0 →</span>
      </div>`
    : `<div class="bd" style="padding:9px 13px;border-top:1px solid var(--bd)">
        <span class="btn sm"${wkTo(d.p0.to)}>去洞察池只看这批 →</span>
      </div>`;
  return wkSec(`P0 阻断问题 · 前 ${d.p0.shown} 条预览`,
    `<div class="bd">${rows}</div>${more}`);
}

// 导出。放在最后，因为它不是"现在该看的数"。
// 「刻意没做的」清单（d.not_done：PNG 导出 / 这页批量认领 / 覆盖体验域可点）不再画 —— 那是写给维护者的，
// 载荷里照留（命令行和文档用）。
function wkFoot(d) {
  const ex = d.exports || {};
  const links = [
    ex.dashboard_html ? `<a href="${esc(ex.dashboard_html)}" target="_blank">静态看板 HTML${EXT_ICON}</a>` : '',
    ex.weekly_md ? `<a href="${esc(ex.weekly_md)}" target="_blank">周报 Markdown${EXT_ICON}</a>` : '',
  ].filter(Boolean);
  const body = `<div class="bd pad">
    <div class="ro-line">${links.join('<br>') || '<span class="sm">还没有生成过看板和周报文件。</span>'}</div>
  </div>`;
  return wkSec('导出', body);
}

// ---------------------------------------------------------------- 页面 7：配置中心
//
// 这一页回答的是「**改了会怎样**」。改本身在子路由里做（#config?edit=taxonomy|trackers|keywords，
// 见下面「页面 7b」），登记发布 / 重算历史在「动手」做成后台作业 —— 三者都只给管理员，
// 都有闸门（2026-09-22 拍板：用闸门 + 留痕替代"没有按钮"）。POST /api/settings 仍回 405，写走 PUT /api/settings/edit/<kind>。
//
// 四条刻意的取舍：
//  1. **整屏一个请求**（/api/settings）。"该不该发布、这次改动危险不危险"这段判断
//     只能写在一处；让前端拿五个接口自己拼，这段判断就会散进 UI 代码里。
//  2. **试算单独一个请求**。它随人改条件反复请求 —— 塞进整屏里等于每拨一下下拉
//     就把整库重打一遍标。它的条件也**不进 URL**：那是"如果这样配呢"的推演，
//     不是"我现在在看哪批内容"，写进 URL 会让转发出去的链接带着一组没生效过的条件。
//  3. **「失去全部标签」永远最显眼**。它比"标签变了"严重得多：那批内容会落进
//     洞察池的「未分类」，按体验域永远筛不到 —— 看起来就像这条内容不存在。
//  4. **只读角色看到的数字和别的角色完全一样**。这一页显示的是配置和聚合数字，
//     没有一句用户原话（后端为此把配置里的说明字段都改名叫 *_note，让开 `_redact`
//     里那张"可能是原话"的名单）。按角色藏的只有动作：「编辑」入口和「动手」的按钮只给管理员。

async function renderConfigPage() {
  if (S.cfg.editKind) return renderCfgEditorPage(S.cfg.editKind);
  $('#main').innerHTML = `
    <div class="head">
      <div>
        <h1>配置中心</h1>
        <div class="sub" id="cfglede">正在加载…</div>
      </div>
      <div class="rt" id="cfgrt"></div>
    </div>
    <div id="cfg"><div class="empty">正在加载…</div></div>`;
  if (S.cfg.data) renderConfig();
  await loadConfig();
}

async function loadConfig() {
  try {
    S.cfg.data = await get('/api/settings');
    // 每次重新读配置都把试算结果丢掉：配置变了，上一次那个"12 条"就不作数了，
    // 留在屏幕上会变成一个**看起来仍然有效**的旧结论。
    S.cfg.test = null;
    S.cfg.testFrom = '';
    S.cfg.diff2 = null;
    S.cfg.from = '';
    S.cfg.to = '';
    // 上一次发起的作业跑完了就不再跟；结果那一行留到这次重画（让人看见"跑完了"），再下一次重取才清。
    if (S.cfg.job && S.cfg.job.status !== 'running') {
      if (S.cfg.job._shown) S.cfg.job = null; else S.cfg.job._shown = true;
    }
    // 「已保存」提示条同样只活一次重取：保存回来那次重取带着它，再点「重新读配置」就没了。
    if (S.cfg.justSaved) {
      if (S.cfg.justSaved._shown) S.cfg.justSaved = null; else S.cfg.justSaved._shown = true;
    }
    renderConfig();
  } catch (e) {
    const el = $('#cfg');
    if (el) el.innerHTML = `<div class="empty"><b>配置中心加载失败</b>${esc(e.message)}</div>`;
  }
}

// 这一页有两种状态，一套页面：**平时**（配置 = 登记 = 库里口径）一屏说完"一切正常"，
// Diff / 影响面 / 动手全部收成一行；**改了之后**才把它们撑开。判据都来自数据：
//   hasDiff = 有可比对象且内容不同；showImpact = hasDiff 或重算出来真有影响（换标 / 掉标 / 跳变）；
//   actionable = 登记 / 重算轮到了哪一颗。
// 解释实现的长文（Tagger / item_matches / 单飞锁 / 指纹算法）一律进标题旁的 ⓘ —— 那是写给维护者的。
// 两列：左 = 问题链（Diff → 影响面 → 动手）+ 追踪项（试算器是它的抽屉：点一行 = 拿去试算）；右 = 参考（状态卡、关键词）。
// 追踪项放左列是为了两列平时差不多高。
function cfgState(d) {
  const diff = d.diff || {};
  const imp = d.impact;
  const a = d.actions;
  const hasDiff = !!(diff.base && !diff.identical);
  const showImpact = hasDiff || !!(imp && (imp.retagged || imp.lost_all || (imp.trackers || []).length));
  const actionable = !!(a && (a.publish.can || a.retag.can));
  return { hasDiff, showImpact, actionable, quiet: !hasDiff && !showImpact && !actionable };
}

// ⓘ：把"为什么这么算"收进 title。没有交互、没有 JS，悬停即读；键盘用户 Tab 到它也能读到（title 在焦点上也显示）。
const infoI = (text) => `<span class="ii" tabindex="0" role="note" title="${esc(text)}">${iconSvg('info', 14)}</span>`;

function renderConfig() {
  const d = S.cfg.data;
  const el = $('#cfg');
  if (!el || !d) return;

  const c = d.conclusion || {};
  const mark = levelMark(c.level);
  const st = d.status;
  const cs = cfgState(d);

  const lede = $('#cfglede');
  if (lede) {
    lede.innerHTML = `v${esc(st.config_version)} · ${st.registered ? '已登记' : '<b>没登记</b>'}`
      + ` · 数据口径 v${esc(st.active_version)}`
      + (st.released_at ? ` · 最近登记 ${esc(st.released_at.slice(0, 10))}` : '');
  }
  const rt = $('#cfgrt');
  if (rt) rt.innerHTML = `${cfgRoleTag(d)}<button class="btn sm" id="cfgReload">重新读配置</button>`;

  // 刚从编辑器保存回来：一次性提示条（保存 ≠ 发布）。常驻的流程说明没人看第二遍。
  const saved = S.cfg.justSaved;
  const savedBar = saved ? `<div class="ro-banner ok">已保存 <code>${esc(CFG_EDIT_META[saved.kind].file)}</code>（留了备份），<b>还没发布</b>。
      下面的 Diff 和影响面已按新文件算好，确认后到「动手」登记发布、重算历史。</div>` : '';

  el.innerHTML = `
    ${savedBar}
    <div class="wb-head ${esc(c.level || 'ok')}">
      <div class="mk">${mark}</div>
      <div style="flex:1;min-width:0">
        <div class="tx">${esc(c.text || '')}</div>
        ${c.also ? `<div class="tx" style="margin-top:5px">${esc(c.also)}</div>` : ''}
        ${cfgNextLine(d, cs)}
      </div>
    </div>
    ${cs.showImpact ? cfgImpactKpis(d) : ''}
    <div class="ops-grid">
      <div><section id="cfg-diff">${cfgDiffBlock(d)}</section>${cs.showImpact ? cfgImpactDetail(d) : ''}<section id="cfg-act">${cfgActionsBlock(d)}</section>${cfgTrackersBlock(d)}</div>
      <div><section id="cfg-status">${cfgStatusBlock(d)}</section>${cfgKeywordsBlock(d)}</div>
    </div>`;

  const reload = $('#cfgReload');
  if (reload) reload.addEventListener('click', loadConfig);
  bindCfg();
}

// 页头的角色 ⓘ：这一页按角色藏的只有动作（编辑 / 登记 / 重算只给管理员），看的东西人人一样。
function cfgRoleTag(d) {
  const roles = ((d.roles && d.roles.roles) || []);
  const me = roles.find((r) => r.id === S.role) || roles.find((r) => r.label === S.role);
  const tip = roles.map((r) => `${r.label}：看 ${r.sees}；写 ${r.writes}`).join('\n')
    + (d.roles && d.roles.explain ? '\n' + d.roles.explain : '');
  return `<span class="cfg-role">当前角色 <b>${esc(me ? me.label : S.role)}</b>${infoI(tip)}</span>`;
}

// 结论条的第二行「接下来」：只在有事可做时出现。平时结论条就一句话 ——
// 以前的四步步骤条在平时是把那句话拆成四份复述，改了之后又是 KPI / Diff / 动作卡之外的第四处重复。
// 这一行把"改了多少 → 影响多大 → 该做什么"串成一句，末尾链到「动手」。
function cfgNextLine(d, cs) {
  if (cs.quiet) return d.conclusion && d.conclusion.hint ? `<div class="det">${esc(d.conclusion.hint)}</div>` : '';
  const diff = d.diff || {};
  const imp = d.impact;
  const a = d.actions || {};
  const parts = [];
  if (cs.hasDiff) parts.push(`${cfgDiffCount(diff)} 处改动`);
  else if (!diff.base) parts.push('还没有可比对象');
  if (cs.showImpact && imp) {
    const bits = [`${imp.retagged || 0} 条会换标`];
    if (imp.lost_all) bits.push(`<b class="bad">${imp.lost_all} 条失去全部标签</b>`);
    if ((imp.trackers || []).length) bits.push(`${imp.trackers.length} 条追踪项跳变`);
    parts.push(bits.join('、'));
  }
  if (a.publish && a.publish.can) parts.push(a.publish.mode === 'first' ? '待登记' : `待登记为 v${esc(a.publish.next_version)}`);
  else if (a.retag && a.retag.can) parts.push('待重算历史');
  return `<div class="det next">${parts.join(' · ')}
    <a data-cfgscroll="cfg-act" title="滚到「动手」">去动手 →</a></div>`;
}

// 改动数 = 删 + 加 + 改。只数 changed 的话，删掉一个类目会显示「0 处改动」。
const cfgDiffCount = (diff) => { const s = diff.summary || {}; return (s.removed || 0) + (s.added || 0) + (s.changed || 0); };

// ---- 影响面：一排四个数 ----

function cfgImpactKpis(d) {
  const imp = d.impact;
  if (!imp) {
    // 这一条是**防线**，不是功能：整屏请求默认就算影响面，走不到这里。
    // 但接口确实允许 `?impact=0` 跳过，而跳过时 impact 是 null ——
    // 万一日后有人改成按需加载，这里必须说"没算"，绝不能拿 0 顶上去：
    // 0 是有含义的（配置改了但一条都没动），它和"没算"长得一模一样。
    return `<div class="wb-sec"><h2>影响面预估
      <span class="sp">这次没算</span></h2>
      <div class="wb-body pad"><div class="cfg-none">
        这次没有计算影响面：下面的预估不是 0，是<b>还没算</b>。
        点右上角「重新读配置」会一起算出来。
      </div></div></div>`;
  }
  const total = imp.items || 0;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const lostCls = imp.lost_all ? 'warn' : '';
  return `
    <div class="wb-kpis">
      <div class="kpi"><div class="lbl">会换标</div>
        <div class="val">${imp.retagged}</div>
        <div class="hint">占 ${pct(imp.retagged)}%，${total} 条里的</div></div>
      <div class="kpi"><div class="lbl">一条都不动</div>
        <div class="val">${imp.unchanged}</div>
        <div class="hint">标签和现在完全一致</div></div>
      <div class="kpi${imp.lost_all ? ' hot pulse' : ''}"><div class="lbl">失去全部标签</div>
        <div class="val ${lostCls}">${imp.lost_all}</div>
        <div class="hint">${imp.lost_all ? '在洞察池里按体验域筛不到' : '没有内容会变成没标签'}</div></div>
      <div class="kpi"><div class="lbl">追踪项跳变</div>
        <div class="val ${imp.trackers.length ? 'warn' : ''}">${imp.trackers.length}</div>
        <div class="hint">${imp.trackers.length ? '明细见下方' : '没有追踪项会跳变'}</div></div>
    </div>`;
}

function cfgImpactDetail(d) {
  const imp = d.impact;
  if (!imp) return '';
  const st = d.status;

  if (imp.empty_library) {
    return `<div class="wb-sec"><h2>影响面明细</h2>
      <div class="wb-body pad"><div class="note" style="margin:0">
      库里还没有任何标签：还没开始打标，不是「一条都没动」。
      先在数据管道里跑一次「打标 + 出报表」，这里才会有数。
      </div></div></div>`;
  }

  const axes = imp.per_axis.map((ax) => `
    <div class="cfg-axis">
      <div class="nm">${esc(ax.label)}</div>
      <div class="bd">
        <span class="dm">−${ax.removed}</span><span class="dp">+${ax.added}</span>
        <span class="it">涉及 ${ax.items} 条内容</span>
      </div>
    </div>`).join('');

  const trks = imp.trackers.map((t) => `
    <div class="cfg-trk">
      <div class="nm">${esc(t.name)}<span class="ow">${esc(t.owner)}</span></div>
      <div class="nm2">
        <b>${t.before}</b><span class="ar">→</span><b>${t.after}</b>
        <span class="dl ${t.delta < 0 ? 'down' : 'up'}">${t.delta > 0 ? '+' : ''}${t.delta}</span>
      </div>
    </div>`).join('');

  const ex = imp.examples.map((e) => `
    <div class="cfg-ex"><code>${esc(e.item_type)}:${esc(e.item_id)}</code>
      <span class="was">原来 ${esc(e.was.join('、'))}</span></div>`).join('');

  const how = `按工作区这份配置把 ${imp.items} 条内容重新打了一遍标，和库里 v${imp.base_version} 的标签逐条比较，结果和正式重算一致。用时 ${imp.elapsed_ms}ms。`
    + (imp.llm_enabled ? '\n只按规则计算，不含大模型打标：大模型每次的结果可能不同，这里只看改配置带来的变化。' : '');
  return `<div class="wb-sec"><h2>影响面明细${infoI(how)}
    <span class="sp">重算了 ${imp.items} 条，和库里 v${esc(imp.base_version)} 逐条比${imp.method === 'rule' ? ' · 只用规则' : ''}</span></h2>
    <div class="wb-body pad">
      ${axes || '<div class="cfg-none">没有任何轴的标签会变。</div>'}
      ${trks ? `<h3 class="cfg-h3">会跳变的追踪项（按全库算）</h3>${trks}` : ''}
      ${ex ? `<h3 class="cfg-h3">失去全部标签的例子</h3>${ex}
        <div class="note" style="margin:8px 0 0">只列前 ${imp.examples.length} 条，完整名单在洞察池按「未分类」筛。
        先补词根，或者确认这批内容本来就不该被提到。</div>` : ''}
    </div></div>`;
}

// ---- Diff：工作区 vs 最近登记的那份 ----

function cfgDiffBlock(d) {
  const diff = d.diff;
  const base = diff.base;
  const why = '内容指纹只看分类内容（轴、类目、打分），不看版本号和日期。改了内容却没升版本号时，指纹会变。';
  return `<div class="wb-sec"><h2>Diff 预览${infoI(why)}
    <span class="sp">${base ? esc(base.label) + ' → 工作区' : '没有可比对象'}</span>${cfgEditBtn('taxonomy')}</h2>
    <div class="wb-body pad">
      ${!base
        ? `<div class="note" style="margin:0">${esc(diff.explain || '')}</div>`
        : (diff.identical
          ? `<div class="cfg-same">内容没变：工作区这份和已登记的 ${esc(base.label)} 是同一套分类。</div>`
          : cfgDiffAxes(diff))}
    </div></div>`;
}

function cfgDiffAxes(diff) {
  const s = diff.summary;
  const bits = [];
  if (s.removed) bits.push(`删了 ${s.removed} 个类目`);
  if (s.added) bits.push(`加了 ${s.added} 个类目`);
  if (s.changed) bits.push(`改了 ${s.changed} 个（其中 ${s.hint_only} 个只改了词根）`);
  const axes = diff.axes.map((ax) => `
    <div class="cfg-dax">
      <div class="nm">${esc(ax.label)}<code>${esc(ax.axis)}</code>
        ${ax.axis_new ? '<span class="bdg new">新增轴</span>' : ''}
        ${ax.axis_gone ? '<span class="bdg gone">整轴删除</span>' : ''}</div>
      ${(ax.axis_changes || []).map((ch) => `<div class="cfg-ch">轴字段 <code>${esc(ch.field)}</code>
        ：${esc(String(ch.from))} → ${esc(String(ch.to))}</div>`).join('')}
      ${ax.removed.map((x) => `<div class="cfg-ch del">− <code>${esc(x.id)}</code> ${esc(x.label || '')}</div>`).join('')}
      ${ax.added.map((x) => `<div class="cfg-ch add">+ <code>${esc(x.id)}</code> ${esc(x.label || '')}</div>`).join('')}
      ${ax.changed.map((c) => `<div class="cfg-ch mod">
        ~ <code>${esc(c.id)}</code> ${esc(c.label || '')}
        ${c.hint_only ? '<span class="bdg hint">只改了词根</span>' : ''}
        ${c.changes.map((ch) => ch.field === 'hints'
          ? `<div class="hx">词根 去掉 ${esc((ch.removed || []).join('、') || '—')} / 加上 ${esc((ch.added || []).join('、') || '—')}</div>`
          : `<div class="hx">${esc(ch.field)}：${esc(String(ch.from))} → ${esc(String(ch.to))}</div>`).join('')}
      </div>`).join('')}
    </div>`).join('');

  return `<div class="cfg-sum">${esc(bits.join('、') || '有改动')}</div>
    ${s.hint_only ? `<div class="cfg-warn">有 ${s.hint_only} 个类目只改了词根：类目数不变，但分类内容已经变了，
      历史趋势会受影响。登记时在说明里写清楚。</div>` : ''}
    ${axes}`;
}

function cfgDiff2Block() {
  const dz = S.cfg.diff2;
  if (!dz) return '';
  if (dz.error) return `<div class="cfg-warn">${esc(dz.error)}</div>`;
  const s = dz.summary;
  return `<div class="cfg-rel2">
    <div class="hd">两个已登记版本之间：<b>${esc(dz.base.label)}</b> → <b>${esc(dz.head.label)}</b>${infoI('对比两个已登记版本。想看口径变动后哪些内容换了归属，去追踪中心；想看工作区和已登记版本的差别，看上面的 Diff 预览。')}
      <button class="btn sm" data-cfgdiff2close="1">收起</button></div>
    ${s.added || s.removed || s.changed
      ? cfgDiffAxes(dz)
      : '<div class="cfg-same">这两个版本的内容完全一致。</div>'}
  </div>`;
}

// ---- 状态卡 ----

function cfgStatusBlock(d) {
  const st = d.status;
  const fixes = st.fixes.map((f) => `
    <div class="cfg-fix">
      <div class="fo">${esc(f.for)}</div>
      <div class="fw">${esc(f.why)}</div>
      <div class="fc"><a data-cfgscroll="cfg-act" title="滚到「动手」">去动手 →</a></div>
    </div>`).join('');

  const vers = st.tag_versions.map((v) => `
    <div class="cfg-tv${v.current ? ' cur' : ''}">
      <b>v${esc(v.version)}</b>
      <span>${v.tags} 条标签 / ${v.items} 条内容</span>
      <span class="at">${esc((v.first_at || '').slice(5, 16).replace('T', ' ') || '—')} 起</span>
    </div>`).join('');

  // 已登记的版本从 Diff 块挪到这里：版本是"状态"，Diff 只回答"差在哪"。
  // 当前版本那颗「与最新比」不画 —— 点了只会回一句"已经是最新的"。
  const rels = st.releases_list || [];
  const releaseRows = rels.map((r) => `
    <div class="cfg-rel${r.current ? ' cur' : ''}">
      <b>v${esc(r.version)}</b>
      <span class="at">${esc((r.released_at || '').replace('T', ' ').slice(0, 16) || '—')}</span>
      <span class="nt">${esc(r.release_note || '（没有写说明）')}</span>
      ${r.current ? '<span class="bdg">当前</span>' : `<button class="btn sm" data-cfgdiff="${esc(r.version)}">与最新比</button>`}
    </div>`).join('');

  return `<div class="wb-sec"><h2>状态卡
    <span class="sp">${st.ok ? '三者一致' : st.warnings.length + ' 条告警'}</span></h2>
    <div class="wb-body pad">
      <div class="kv cfg-kv">
        <dt>配置版本</dt><dd>v${esc(st.config_version)}
          ${st.registered ? '' : '<span class="bdg gone">没登记</span>'}</dd>
        <dt>内容指纹</dt><dd><code>${esc(st.fingerprint)}</code></dd>
        <dt>数据口径</dt><dd>v${esc(st.active_version)}
          ${st.active_version === st.config_version ? '（和配置一致）'
            : '<span class="bdg gone">落后于配置，标签还是旧标准算的</span>'}</dd>
        <dt>已登记</dt><dd>${st.releases} 个版本
          ${st.released_at ? '· 最近 ' + esc(st.released_at.replace('T', ' ').slice(0, 16)) : ''}</dd>
      </div>
      <h3 class="cfg-h3">库内标签口径</h3>
      ${vers || '<div class="cfg-none">库里一条标签都没有。</div>'}
      ${fixes ? `<h3 class="cfg-h3">该做什么</h3>${fixes}` : ''}
      <details class="cfg-fold" id="cfgRelFold"${S.cfg.relOpen ? ' open' : ''}>
        <summary>已登记的版本 <span class="ct">${rels.length} 个</span></summary>
        ${releaseRows || '<div class="cfg-none">还没有登记过任何版本。</div>'}
        <div id="cfgDiff2">${cfgDiff2Block()}</div>
      </details>
    </div></div>`;
}

// ---- 试算 ----

function cfgTestBlock(d) {
  const why = '判定规则和追踪中心相同，按最近 7 天滚动窗口统计，试算结果和追踪中心一致。条件里的类目写错时，报错显示在最上面。';
  return `<details class="cfg-fold" id="cfgTestBlock"${S.cfg.testOpen ? ' open' : ''}><summary>试算一组条件${infoI(why)}
    <span class="sp">${S.cfg.test ? `${S.cfg.test.matched} 条命中` : ''}</span></summary>
    <div class="cfg-testbody">
      <div id="cfgTestForm">${cfgTestForm()}</div>
      <div id="cfgTestOut">${cfgTestOut()}</div>
    </div></details>`;
}

function cfgTestForm() {
  const axes = (S.meta && S.meta.axes) || [];
  const f = S.cfg.testF;
  const rows = axes.map((ax) => {
    const sel = f[ax.id] || [];
    const chips = (ax.values || []).map((v) => `
      <span class="fchip${sel.includes(v.id) ? ' on' : ''}" data-cfgax="${esc(ax.id)}"
        data-cfgval="${esc(v.id)}" title="${esc(v.id)}">${esc(v.label)}</span>`).join('');
    return `<div class="fgroup"><label>${esc(ax.label)}</label>
      <div class="fchips">${chips}</div></div>`;
  }).join('');

  return `<div class="cfg-form">
    ${rows}
    <div class="fmeta">
      <label class="chk">多轴
        <select id="cfgMatch">
          <option value="all"${S.cfg.match === 'all' ? ' selected' : ''}>同时满足（all）</option>
          <option value="any"${S.cfg.match === 'any' ? ' selected' : ''}>满足其一（any）</option>
        </select></label>
      <label class="chk">窗口
        <select id="cfgWeeks">
          ${[4, 8, 12, 26].map((w) => `<option value="${w}"${S.cfg.weeks === w ? ' selected' : ''}>最近 ${w} 周</option>`).join('')}
        </select></label>
      <span class="sp">
        <button class="btn sm" id="cfgTestClear">清空条件</button>
      </span>
    </div>
  </div>`;
}

function cfgTestOut() {
  const t = S.cfg.test;
  if (!t) {
    return '<div class="cfg-none">还没试算。</div>';
  }
  const cond = Object.entries(t.filter || {})
    .map(([ax, vs]) => `${axisLabel(ax)} ${vs.map((v) => valLabel(ax, v)).join(' / ')}`)
    .join('，') || '（没有条件）';
  const from = S.cfg.testFrom ? (cfgTrackerList().find((x) => x.id === S.cfg.testFrom) || {}).name : '';
  const probs = (t.problems || []).map((p) => `<div class="cfg-prob">${iconSvg('xCircle', 14, 'inl')}${esc(p)}</div>`).join('');
  const strip = (t.by_week || []).map((w) => `<div class="wk" title="${esc(w.week)}">${w.n}</div>`).join('');
  // 一条都没命中时**照印一排 0**，不藏起来：试算最该看清的恰恰是这个 0。
  return `
    ${probs}
    <div class="cfg-tres">
      <div class="big"><b>${t.matched}</b><span>条命中 / 共 ${t.items_total} 条</span></div>
      <div class="sub">其中 P0 ${t.p0} 条 · 口径 v${esc(t.version)} · ${esc(t.scope)}</div>
      <div class="cond">${from ? `条件来自「${esc(from)}」：` : '条件：'}${esc(cond)}（${esc(t.match)}）</div>
      <div class="win">${esc(t.window_label)}</div>
    </div>
    <div class="wb-strip">${strip}</div>`;
}

// ---- 关键词 / 追踪项 / 角色 ----

function cfgKeywordsBlock(d) {
  const kw = d.keywords;
  const FOLD = 6;
  const groups = kw.groups.map((g) => {
    const open = !!(S.cfg.kwOpen && S.cfg.kwOpen[g.name]);   // 词组的键是 name（brand / pain / …）
    const shown = open ? g.terms : g.terms.slice(0, FOLD);
    const more = g.terms.length - shown.length;
    return `
    <div class="cfg-kw">
      <div class="nm">${esc(g.label)}${g.pinned ? '<span class="bdg">固定</span>' : ''}
        <span class="ct">${g.terms.length} 个</span>${g.desc ? infoI(g.desc) : ''}</div>
      <div class="tm">${shown.map((t) => `<span class="chip gray">${esc(t)}</span>`).join('')}
        ${more > 0 ? `<button type="button" class="fchip clr" data-kwmore="${esc(g.name)}">…还有 ${more} 个</button>`
          : (open && g.terms.length > FOLD ? `<button type="button" class="fchip clr" data-kwmore="${esc(g.name)}">收起</button>` : '')}</div>
    </div>`;
  }).join('');
  // 采集边界收成一行；那句"不要调高"和"不在页面上改"进 ⓘ —— 它是底线，不是这页的主角。
  const rules = (kw.rules || []).map((r) => `<span class="cfg-rule1">${esc(r.label)} <b>${esc(r.value)}</b></span>`).join('<span class="dot">·</span>');
  const rulesWhy = (kw.rules_note ? kw.rules_note + '\n' : '') + '采集边界关系到账号安全，页面上不能改。';
  return `<div class="wb-sec"><h2>关键词
    <span class="sp">${kw.groups.length} 组 · ${kw.groups.reduce((n, g) => n + g.terms.length, 0)} 个词 · v${esc(kw.version || '—')}${kw.updated_at ? ' · ' + esc(kw.updated_at) : ''}</span>${cfgEditBtn('keywords')}</h2>
    <div class="wb-body pad">
      ${groups || '<div class="cfg-none">关键词表是空的。</div>'}
      ${rules ? `<h3 class="cfg-h3">采集边界${infoI(rulesWhy)}</h3><div class="cfg-rules">${rules}</div>` : ''}
    </div></div>`;
}

function cfgTrackersBlock(d) {
  const tk = d.trackers;
  const why = '想确认新加的追踪项和已有的是不是一回事：点一行，把它的条件填进下面的试算里跑一次；也可以自己点选条件试算。';
  // 整行可点 = 把条件填进抽屉；被载入的那一行高亮，改了 chip 之后高亮取消（算的已经不是那条线了）。
  const rows = tk.trackers.map((t) => `
    <div class="cfg-trkrow${t.id === S.cfg.testFrom ? ' on' : ''}" data-cfgload="${esc(t.id)}" role="button" tabindex="0" title="把这条的条件填进试算">
      <div class="nm">${esc(t.name)}<span class="ow">${esc(t.owner)}</span>
        <span class="mt">${esc(t.match)}</span><span class="go">试算 →</span></div>
      <div class="cd">${Object.entries(t.filter).map(([ax, vs]) =>
        `${esc(axisLabel(ax))} ${vs.map((v) => esc(valLabel(ax, v))).join(' / ')}`).join('，')}</div>
    </div>`).join('');
  return `<div class="wb-sec" id="cfgTrackers"><h2>追踪项${infoI(why)}
    <span class="sp">${tk.count} 条</span>${cfgEditBtn('trackers')}</h2>
    <div class="wb-body pad">
      ${rows || '<div class="cfg-none">还没有追踪项。</div>'}
      ${cfgTestBlock(d)}
    </div></div>`;
}

// ---- 第 ④ 步：动手。两条治理动作，做成后台作业（有锁、有日志、有留痕）。
// 闸门：只给管理员；登记发布必填一句说明 + 勾选确认；不可点时按钮灰掉并写明为什么。
// 这一块替代了「只读 / 没有按钮」那条底线（2026-09-22 拍板）。

function cfgActionsBlock(d) {
  const a = d.actions;
  if (!a) return '';
  const st = d.status;
  const cur = S.cfg.job;   // 正在跟的作业（这一页发起的）
  const jobLine = cur ? `<div class="cfg-job ${esc(cur.status || 'running')}">
      <span class="dot"></span>
      <b>${esc(cur.title || '')}</b>
      <span>${cur.status === 'running' ? (cur.progress && cur.progress.stage ? esc(cur.progress.stage) : '正在跑…') : esc(cur.status_label || cur.status || '')}</span>
      ${cur.status !== 'running' && cur.job_id ? `<a data-goto="pipeline" title="去数据管道看这次运行的完整日志">看日志 →</a>` : ''}
    </div>` : '';
  const p = a.publish; const r = a.retag;
  const why = '配置改了还没登记时，「登记发布」可用；登记好了但库里的标签还是旧口径时，「重算历史」可用。两者都在后台运行，同一时间只能运行一个作业，跑完这一页会自动刷新。';
  const admin = S.role === 'admin';
  const busy = !!(cur && cur.status === 'running');

  // 都不用动：一行说完。别画两张灰卡 —— 那是"改了之后"的形态。
  if (!p.can && !r.can) {
    return `<div class="wb-sec"><h2>动手${infoI(why)} <span class="sp">没什么要动</span></h2>
      <div class="wb-body pad">${jobLine}
        <div class="cfg-quiet">${iconSvg('checkCircle', 14, 'inl')}${esc(p.why)}；${esc(r.why)}${admin ? '' : '（登记 / 重算只给管理员）'}。</div>
      </div></div>`;
  }

  if (!admin) {
    return `<div class="wb-sec"><h2>动手${infoI(why)} <span class="sp">${p.can ? '待登记发布' : '待重算历史'}</span></h2>
      <div class="wb-body pad">${jobLine}
        <div class="note" style="margin:0">${esc(p.can ? p.why : r.why)}。这一步只给<b>管理员</b>（当前角色：${esc(S.role)}），请联系管理员处理。</div>
      </div></div>`;
  }

  // 轮到哪颗展开哪张卡；没轮到的那颗一行 why。
  const pubCard = p.can ? `
    <div class="cfg-act ready">
      <div class="t">登记发布 <span class="chip ${p.mode === 'bump' ? 'p1' : 'gray'}">${p.mode === 'first' ? `首次 · v${esc(p.next_version)}` : `升到 v${esc(p.next_version)}`}</span></div>
      <div class="w">${esc(p.why)}</div>
      <label class="lb">这次改了什么（会写进登记表）
        <input type="text" id="cfgPubNote" maxlength="120" placeholder="比如：无障碍拆成字号 / 步骤 / 长辈模式" ${busy ? 'disabled' : ''}></label>
      <label class="chk"><input type="checkbox" id="cfgPubTick" ${busy ? 'disabled' : ''}>
        <span>我知道这会登记一个<b>不可变快照</b>${p.mode === 'bump' ? `，并把配置文件里的版本号改成 v${esc(p.next_version)}` : ''}</span></label>
      <button class="btn pri" id="cfgPublish" ${busy ? 'disabled' : ''}>登记发布</button>
    </div>` : `<div class="cfg-act dim"><div class="t">登记发布</div><div class="w">${esc(p.why)}</div></div>`;
  const retCard = r.can ? `
    <div class="cfg-act ready">
      <div class="t">重算历史 <span class="chip p1">v${esc(st.active_version)} → v${esc(st.config_version)}</span></div>
      <div class="w">${esc(r.why)}</div>
      <label class="chk"><input type="checkbox" id="cfgRetagTick" ${busy ? 'disabled' : ''}>
        <span>我知道这会用 v${esc(st.config_version)} 重算<b>全部历史标签</b>（旧版本标签保留，几十秒）</span></label>
      <button class="btn pri" id="cfgRetag" ${busy ? 'disabled' : ''}>重算历史</button>
    </div>` : `<div class="cfg-act dim"><div class="t">重算历史</div><div class="w">${esc(r.why)}</div></div>`;

  return `<div class="wb-sec"><h2>动手${infoI(why)} <span class="sp">改了 → 先登记 → 再重算</span></h2>
    <div class="wb-body pad">
      ${jobLine}
      <div class="cfg-acts">${pubCard}${retCard}</div>
    </div></div>`;
}

let _cfgJobTimer = null;

async function cfgRunAction(kind) {
  const params = {};
  if (kind === 'publish') {
    const note = ($('#cfgPubNote') && $('#cfgPubNote').value || '').trim();
    if (!note) { toast('先写一句「这次改了什么」，它会写进登记表', true); if ($('#cfgPubNote')) $('#cfgPubNote').focus(); return; }
    if (!($('#cfgPubTick') && $('#cfgPubTick').checked)) { toast('先勾上确认', true); return; }
    params.note = note;
  } else if (!($('#cfgRetagTick') && $('#cfgRetagTick').checked)) { toast('先勾上确认', true); return; }
  const btn = $(kind === 'publish' ? '#cfgPublish' : '#cfgRetag');
  if (btn) { btn.disabled = true; btn.textContent = '启动中…'; }
  try {
    const job = await post('/api/jobs', { kind, params, actor: S.actor });
    S.cfg.job = job;
    toast(`已启动「${job.title}」`);
    cfgRepaintActions();
    loadWbBadge();
    cfgPollJob();
  } catch (e) {
    toast(e.message, true);
    cfgRepaintActions();
  }
}

// 跟这一页发起的作业：2 秒一问，跑完整页重取 —— 状态卡 / Diff / 影响面 / 步骤条全都会变。
function cfgPollJob() {
  clearTimeout(_cfgJobTimer);
  const cur = S.cfg.job;
  if (!cur || cur.status !== 'running') return;
  _cfgJobTimer = setTimeout(async () => {
    try {
      const j = await get('/api/jobs/' + encodeURIComponent(cur.job_id));
      S.cfg.job = j;
      if (j.status === 'running') { cfgRepaintActions(); cfgPollJob(); return; }
      toast(j.status === 'ok' ? `「${j.title}」跑完了` : `「${j.title}」没跑成，看日志`, j.status !== 'ok');
      await loadConfig();
      loadWbBadge();
    } catch (e) { cfgPollJob(); }
  }, 2000);
}

function cfgRepaintActions() {
  const sec = document.getElementById('cfg-act');
  if (!sec || !S.cfg.data) return;
  sec.innerHTML = cfgActionsBlock(S.cfg.data);
}

// 区块标题右侧的「编辑」入口：只给管理员画（非管理员那里连按钮都没有，不做一个点下去 403 的按钮）。
function cfgEditBtn(kind) {
  if (S.role !== 'admin') return '';
  return `<button type="button" class="btn sm" data-cfgedit="${kind}" title="打开${esc(CFG_EDIT_META[kind].title)}编辑器">编辑</button>`;
}

// ---- 交互 ----
//
// 用**事件委托**绑在 #cfg 上，而不是每次重画再去 querySelectorAll 挨个 addEventListener。
// 后者有两个必然后果：一是重画一次就多绑一层（点一下 chip 触发两次 toggle，
// 表现是"点了没反应"，而且不报错）；二是要记着在每个重画入口调用绑定函数，
// 漏一个就是"这块点不动"。委托之后，重画多少次都只有一套监听。

function bindCfg() {
  const host = $('#cfg');
  // #cfg 这个节点在同一次导航里是同一个 #main.innerHTML 的产物；
  // 换页会重建它，所以这个标记天然跟着生命周期走，不需要手动清。
  if (!host || host.dataset.cfgBound) return;
  host.dataset.cfgBound = '1';

  host.addEventListener('click', (ev) => {
    const ax = ev.target.closest('[data-cfgax]');
    if (ax) return onCfgAxisChip(ax.dataset.cfgax, ax.dataset.cfgval);
    const load = ev.target.closest('[data-cfgload]');
    if (load) return onCfgLoadTracker(load.dataset.cfgload);
    const df = ev.target.closest('[data-cfgdiff]');
    if (df) return loadCfgDiff(df.dataset.cfgdiff);
    if (ev.target.closest('[data-cfgdiff2close]')) {
      S.cfg.diff2 = null;
      const box = $('#cfgDiff2');
      if (box) box.innerHTML = '';
      return;
    }
    if (ev.target.closest('#cfgTestClear')) {
      S.cfg.testF = {}; S.cfg.match = 'all'; S.cfg.test = null;
      cfgTestDetach();
      repaintCfgTestForm();
      return;
    }
    if (ev.target.closest('#cfgReload')) return loadConfig();
    const sc = ev.target.closest('[data-cfgscroll]');
    if (sc) { const t = document.getElementById(sc.dataset.cfgscroll); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const km = ev.target.closest('[data-kwmore]');
    if (km) {
      S.cfg.kwOpen = S.cfg.kwOpen || {};
      S.cfg.kwOpen[km.dataset.kwmore] = !S.cfg.kwOpen[km.dataset.kwmore];
      const sec = km.closest('.wb-sec');
      if (sec && 'outerHTML' in sec) sec.outerHTML = cfgKeywordsBlock(S.cfg.data);
      return;
    }
    const ed = ev.target.closest('[data-cfgedit]');
    if (ed) return go('config', { edit: ed.dataset.cfgedit });
    if (ev.target.closest('#cfgPublish')) return cfgRunAction('publish');
    if (ev.target.closest('#cfgRetag')) return cfgRunAction('retag');
    const gt = ev.target.closest('[data-goto]');
    if (gt) return go(gt.dataset.goto);
  });

  // 折叠块的开合记在状态里：整页重画（重新读配置 / 作业跑完）不该把人刚展开的试算器又合上。
  // toggle 不冒泡，用捕获。
  host.addEventListener('toggle', (ev) => {
    if (ev.target.id === 'cfgTestBlock') S.cfg.testOpen = ev.target.open;
    if (ev.target.id === 'cfgRelFold') S.cfg.relOpen = ev.target.open;
  }, true);
  host.addEventListener('keydown', (ev) => {
    const row = ev.target.closest && ev.target.closest('.cfg-trkrow[data-cfgload]');
    if (row && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); onCfgLoadTracker(row.dataset.cfgload); }
  });

  host.addEventListener('change', (ev) => {
    if (ev.target.id === 'cfgMatch') { S.cfg.match = ev.target.value; cfgTestDetach(); runCfgTest(); }
    if (ev.target.id === 'cfgWeeks') {
      S.cfg.weeks = parseInt(ev.target.value, 10) || 12;
      runCfgTest();
    }
  });
}

function onCfgAxisChip(ax, v) {
  const cur = S.cfg.testF[ax] || [];
  S.cfg.testF[ax] = cur.includes(v) ? cur.filter((x) => x !== v) : cur.concat([v]);
  if (!S.cfg.testF[ax].length) delete S.cfg.testF[ax];
  cfgTestDetach();
  repaintCfgTestForm();
  runCfgTest();
}

// 改了条件 = 算的已经不是那条追踪项了：「条件来自」和行高亮一起解除。
function cfgTestDetach() {
  if (!S.cfg.testFrom) return;
  S.cfg.testFrom = '';
  document.querySelectorAll('#cfgTrackers .cfg-trkrow.on').forEach((r) => r.classList.remove('on'));
}

// 只重画追踪项块（行高亮 + 抽屉），不整页重渲染。
function cfgRepaintTrackers() {
  const sec = document.getElementById('cfgTrackers');
  if (sec && S.cfg.data && 'outerHTML' in sec) sec.outerHTML = cfgTrackersBlock(S.cfg.data);
}

// 「载入已有追踪项」和「拿去试算」是同一件事：把那组条件填进试算器。
// 两者都**覆盖**当前条件（不是追加）—— 载入一条追踪项的意思是"看这条的条件"，
// 追加会得到两条追踪项的并集，那是个谁也没定义过的东西。
function onCfgLoadTracker(id) {
  const t = cfgTrackerList().find((x) => x.id === id);
  if (!t) return;
  S.cfg.testF = {};
  Object.entries(t.filter || {}).forEach(([ax, vs]) => { S.cfg.testF[ax] = vs.slice(); });
  S.cfg.match = t.match || 'all';
  S.cfg.testFrom = id;     // 结果里写明「条件来自」，那一行高亮
  S.cfg.testOpen = true;   // 抽屉平时折着；拿一条去试算时得先把它打开
  cfgRepaintTrackers();
  runCfgTest();
  const box = $('#cfgTestBlock');
  if (box) { box.open = true; if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

// 只重画试算那一块（保留滚动位置），不整页重渲染 —— 整页重渲染会让
// 每次点 chip 都把屏幕弹回顶部，而人正在连着点第五个条件。
function repaintCfgTestForm() {
  const form = $('#cfgTestForm'), out = $('#cfgTestOut');
  if (form) form.innerHTML = cfgTestForm();
  if (out) out.innerHTML = cfgTestOut();
  cfgTestSummary();
}

// 折叠块合着的时候也能看见上一次的结果：summary 右侧那句跟着试算结果变。
function cfgTestSummary() {
  const sp = document.querySelector('#cfgTestBlock summary .sp');
  if (sp) sp.textContent = S.cfg.test ? `${S.cfg.test.matched} 条命中` : '';
}

async function runCfgTest() {
  const p = new URLSearchParams();
  Object.entries(S.cfg.testF).forEach(([ax, vs]) => { if (vs.length) p.set(ax, vs.join(',')); });
  p.set('match', S.cfg.match);
  p.set('weeks', S.cfg.weeks);
  const seq = ++S.cfg.seq;   // 防慢请求盖快请求：连点五个 chip 会有五个请求在飞
  const out = $('#cfgTestOut');
  try {
    const t = await api('GET', '/api/settings/test?' + p.toString());
    if (seq !== S.cfg.seq) return;
    S.cfg.test = t;
  } catch (e) {
    if (seq !== S.cfg.seq) return;
    // 接口报错（轴名/值写错、窗口不对）在这里也要如实显示，
    // 否则屏幕上是上一组条件的旧结果 —— 一个**看起来已经更新过**的错数字。
    S.cfg.test = { filter: S.cfg.testF, match: S.cfg.match, weeks: S.cfg.weeks,
                   matched: 0, items_total: 0, p0: 0, by_week: [], scope: '库内全部内容',
                   version: '?', window_label: '', problems: [e.message] };
  }
  if (out) out.innerHTML = cfgTestOut();
  cfgTestSummary();
}

async function loadCfgDiff(version) {
  const latest = ((S.cfg.data.status.releases_list || [])[0] || {}).version;
  const host = $('#cfgDiff2');
  if (!latest || version === latest) {
    S.cfg.diff2 = { error: `v${version} 已经是最新的登记版本，没有第二份可比。` };
    if (host) host.innerHTML = cfgDiff2Block();
    return;
  }
  S.cfg.relOpen = true;
  if (host) host.innerHTML = '<div class="cfg-none">正在比对…</div>';
  try {
    S.cfg.diff2 = await api('GET', `/api/settings/diff?from=${encodeURIComponent(version)}`
      + `&to=${encodeURIComponent(latest)}`);
  } catch (e) {
    // 版本号写错要让接口那句话原样透出来（"没有 v9.9 这个已登记版本"和
    // "登记表和快照不同步了"是两句不同的话，前端不该把它们揉成一句"加载失败"）。
    S.cfg.diff2 = { error: e.message };
  }
  if (host) host.innerHTML = cfgDiff2Block();
}

// 轴名 / 值名的中文一律走全局那两个（`axisLabel` / `valLabel`，都是读 /api/meta）——
// 页面里不写死任何一个分类体系的值，这一页也不例外。
// 这里只补一个"追踪项列表"，因为它的来源是 /api/settings（带 filter），
// 而 /api/meta 的 trackers 只有名字 —— 试算要把条件填进去，没有 filter 就做不到。
function cfgTrackerList() {
  return ((S.cfg.data && S.cfg.data.trackers && S.cfg.data.trackers.trackers) || []);
}

// ---------------------------------------------------------------- 页面 7b：配置编辑器（#config?edit=…）
//
// 配置中心的子路由。三个**结构化**编辑器（分类体系 / 追踪项 / 关键词），不是 JSON 文本框。
// 危险由闸门化解，而不是"没有按钮"：只给管理员 · id 锁定 · 引用校验（服务端）·
// 分类体系保存前**必须**预览影响面 · 服务端备份 · 乐观锁（文件指纹）· **保存 ≠ 发布**。
// 保存之后回配置中心：状态卡会报「内容改了但没登记」，「动手」的登记发布亮起 —— 那是方案 A 的接口。
//
// 状态都在 S.cfg.edit 里：{ kind, doc, base, fingerprint, rules, loadedAt, axis, previewHash, preview, hits, errors, saving, conflict }。
//  - base 是加载时那份文档的 JSON 串；dirty = JSON.stringify(doc) !== base（纯函数 cfgEditDirty）。
//  - previewHash 是上一次预览时文档的 JSON 串；文档再改 → 保存按钮重新灰掉（分类体系）。
//  - 文档的字段直接由控件上的 data-ep（路径，'/' 分隔）写回：一份数据、一套委托监听，重画多少次都不重复绑。

const CFG_EDIT_META = {
  taxonomy: { title: '分类体系', file: 'config/taxonomy.json', preview: '预览影响面',
              hint: '改类目的名字、说明和词根；体验域、品类线、人群场景可以增删类目，其余三个轴只能改名字和说明。<b>保存前必须预览影响面</b>。' },
  trackers: { title: '追踪项', file: 'config/trackers.json', preview: '试算全部',
              hint: '改告警默认值和每条追踪项的名字 / 负责人 / 条件；可以增删追踪项。条件里的值必须是分类体系里现有的类目。' },
  keywords: { title: '关键词', file: 'config/keywords.json', preview: '',
              hint: '改五个词组的词条（增删、自动去重）。词组本身和采集边界（抓取频率 / 上限）不在这里改，采集边界关系到账号安全。' },
};

async function renderCfgEditorPage(kind) {
  const meta = CFG_EDIT_META[kind];
  $('#main').innerHTML = `
    <div id="cfgEditPage">
    <div class="head">
      <div>
        <h1><button type="button" class="btn sm ghost" id="cfgEditBack" title="回配置中心（有未保存的改动会先问一句）">← 配置中心</button> 编辑${esc(meta.title)}</h1>
        <div class="sub" id="cfgEditLede">正在加载…</div>
      </div>
      <div class="rt" id="cfgEditRt"></div>
    </div>
    <div id="cfgEditor"><div class="empty">正在加载…</div></div>
    </div>`;
  bindCfgEditor();
  if (S.role !== 'admin') {
    $('#cfgEditLede').textContent = '只给管理员';
    $('#cfgEditor').innerHTML = `<div class="empty"><b>编辑配置只给管理员</b>
      当前角色是 ${esc(S.role)}，请联系管理员修改 <code>${esc(meta.file)}</code>。
      配置中心页照常能看改动的影响。</div>`;
    return;
  }
  if (S.cfg.edit && S.cfg.edit.kind === kind) { renderCfgEditor(); return; }
  await loadCfgEditor(kind);
}

async function loadCfgEditor(kind) {
  try {
    const r = await get('/api/settings/edit/' + encodeURIComponent(kind));
    const axes = Object.keys((r.doc && r.doc.axes) || {});
    S.cfg.edit = { kind, doc: r.doc, base: JSON.stringify(r.doc), fingerprint: r.fingerprint, rules: r.rules || {},
                   loadedAt: new Date(), axis: axes[0] || '', previewHash: '', preview: null,
                   hits: {}, errors: [], saving: false, conflict: false };
    renderCfgEditor();
  } catch (e) {
    const el = $('#cfgEditor');
    if (el) el.innerHTML = `<div class="empty"><b>编辑器加载失败</b>${esc(e.message)}</div>`;
  }
}

// ---- 纯函数：脏 / 哈希 / 改动数 ----

const cfgEditHash = (doc) => JSON.stringify(doc);

function cfgEditDirty() {
  const e = S.cfg.edit;
  return !!e && cfgEditHash(e.doc) !== e.base;
}

// 改动数只求"给人一个感觉"：按 id 比类目 / 追踪项，按词条比词组。
function cfgEditChanges() {
  const e = S.cfg.edit;
  if (!e) return 0;
  const base = JSON.parse(e.base);
  const byId = (items) => Object.fromEntries((items || []).filter((x) => x && x.id).map((x) => [x.id, JSON.stringify(x)]));
  const diffIds = (a, b) => {
    const A = byId(a), B = byId(b);
    let n = 0;
    for (const k of Object.keys(A)) { if (!(k in B)) n++; else if (A[k] !== B[k]) n++; }
    for (const k of Object.keys(B)) if (!(k in A)) n++;
    return n;
  };
  if (e.kind === 'taxonomy') {
    let n = 0;
    for (const ax of Object.keys(e.doc.axes || {})) n += diffIds((e.doc.axes[ax] || {}).items, ((base.axes || {})[ax] || {}).items);
    return n;
  }
  if (e.kind === 'trackers') {
    return (JSON.stringify(e.doc.defaults) !== JSON.stringify(base.defaults) ? 1 : 0) + diffIds(e.doc.trackers, base.trackers);
  }
  let n = 0;
  for (const [k, g] of Object.entries(e.doc.groups || {})) {
    const a = new Set((g && g.terms) || []), b = new Set((((base.groups || {})[k]) || {}).terms || []);
    for (const t of a) if (!b.has(t)) n++;
    for (const t of b) if (!a.has(t)) n++;
  }
  return n;
}

// 按 '/' 分隔的路径读写文档：'axes/experience/items/3/label'。数组下标按数字取。
function cfgEdGet(path) {
  let o = S.cfg.edit.doc;
  for (const k of path.split('/')) { if (o == null) return undefined; o = o[Array.isArray(o) ? +k : k]; }
  return o;
}
function cfgEdSet(path, value) {
  const parts = path.split('/');
  let o = S.cfg.edit.doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const key = Array.isArray(o) ? +k : k;
    if (o[key] == null) o[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    o = o[key];
  }
  const last = parts[parts.length - 1];
  o[Array.isArray(o) ? +last : last] = value;
}

// ---- 渲染 ----

function renderCfgEditor() {
  const e = S.cfg.edit;
  const el = $('#cfgEditor');
  if (!e || !el) return;
  const meta = CFG_EDIT_META[e.kind];
  const lede = $('#cfgEditLede');
  if (lede) {
    lede.innerHTML = `改的是 <code>${esc(meta.file)}</code>`
      + ` · 加载于 ${esc(e.loadedAt.toTimeString().slice(0, 5))} · <b>保存不发布</b>`;
  }
  const rt = $('#cfgEditRt');
  if (rt) rt.innerHTML = '<button type="button" class="btn sm" id="cfgEditReload" title="放弃本地改动，重新读文件">重新加载</button>';
  el.innerHTML = `
    <div class="ro-banner">${meta.hint} 保存只写文件并留一份备份，<b>还不算发布</b>：保存后回配置中心「动手」登记发布、重算历史。</div>
    <div id="cfgEditErrs">${cfgEditErrsBlock()}</div>
    <div id="cfgEditBody">${cfgEditBody()}</div>
    <div id="cfgEditPrev">${cfgEditPrevBlock()}</div>
    ${cfgEditBar()}`;
}

function cfgEditErrsBlock() {
  const e = S.cfg.edit;
  const errs = (e && e.errors) || [];
  if (!errs.length) return '';
  return `<div class="cfg-ederrs">${errs.map((x) => `<div class="cfg-prob">${iconSvg('xCircle', 14, 'inl')}${esc(x)}</div>`).join('')}</div>`;
}

function cfgEditBody() {
  const e = S.cfg.edit;
  if (e.kind === 'taxonomy') return cfgEditorTaxonomy();
  if (e.kind === 'trackers') return cfgEditorTrackers();
  return cfgEditorKeywords();
}

// 动作条（sticky 底部）。「保存」的可点条件：有改动 · 没在存 · 没撞车 ·
// 分类体系还要求"预览过且预览之后没再改、预览没报错"。
function cfgEditBar() {
  const e = S.cfg.edit;
  const meta = CFG_EDIT_META[e.kind];
  const dirty = cfgEditDirty();
  const n = dirty ? cfgEditChanges() : 0;
  const busy = e.saving;
  const previewed = e.previewHash && e.previewHash === cfgEditHash(e.doc) && e.preview && !(e.preview.errors || []).length;
  const canSave = dirty && !busy && !e.conflict && (e.kind !== 'taxonomy' || previewed);
  let st, cls = '';
  if (e.conflict) {
    st = `文件在你加载之后被别人改过，这份改动不能直接覆盖。<button type="button" class="btn sm" id="cfgEditReloadC">重新加载（放弃本地改动）</button>`; cls = 'bad';
  } else if (!dirty) st = '没有改动';
  else if (e.kind === 'taxonomy' && !previewed) { st = `未保存 · ${n} 处改动 · <b>先预览影响面</b>再保存`; cls = 'warn'; }
  else st = `未保存 · ${n} 处改动`;
  return `<div class="cfg-editbar">
    <button type="button" class="btn" id="cfgEditDiscard" ${dirty && !busy ? '' : 'disabled'}>放弃改动</button>
    <span class="st ${cls}">${st}</span>
    <span class="sp">
      ${meta.preview ? `<button type="button" class="btn" id="cfgEditPreview" ${busy || e.conflict || (e.kind === 'taxonomy' && !dirty) ? 'disabled' : ''}>${esc(meta.preview)}</button>` : ''}
      <button type="button" class="btn pri" id="cfgEditSave" ${canSave ? '' : 'disabled'}>${busy ? '保存中…' : '保存'}</button>
    </span>
  </div>`;
}

function cfgEditRepaintBar() {
  const bar = document.querySelector('#cfgEditor .cfg-editbar');
  if (bar && 'outerHTML' in bar) bar.outerHTML = cfgEditBar();
  // 预览过之后又改了草稿：预览块变灰（"这是改之前算的"）。
  const prev = $('#cfgEditPrev');
  if (prev) prev.innerHTML = cfgEditPrevBlock();
}

function cfgEditRepaintBody() {
  const body = $('#cfgEditBody');
  if (body) body.innerHTML = cfgEditBody();
  const errs = $('#cfgEditErrs');
  if (errs) errs.innerHTML = cfgEditErrsBlock();
  cfgEditRepaintBar();
}

// chip 编辑器：× 删、回车 / 逗号加、重复自动去掉。所有词表类字段（hints / tags / terms）共用。
function cfgEdChips(path, arr, label, ph) {
  return `<div class="cfg-edchips"><span class="lb">${esc(label)}</span>
    <div class="cs">${(arr || []).map((h, j) => `<span class="chip gray">${esc(h)}<button type="button" class="x"
        data-edrm="${esc(path)}" data-edidx="${j}" aria-label="删掉 ${esc(h)}" title="删掉">${iconSvg('x', 12)}</button></span>`).join('')}
      <input type="text" class="add" data-edadd="${esc(path)}" placeholder="${esc(ph || '回车添加')}" maxlength="60">
    </div></div>`;
}

// ---- 分类体系 ----

function cfgEditorTaxonomy() {
  const e = S.cfg.edit;
  const doc = e.doc;
  const base = JSON.parse(e.base);
  const rules = e.rules;
  const structural = new Set(rules.structural_axes || []);
  const weightAxes = new Set(rules.weight_axes || []);
  const axes = Object.keys(doc.axes || {});
  if (!axes.includes(e.axis)) e.axis = axes[0] || '';
  const ax = e.axis;
  const spec = (doc.axes || {})[ax] || {};
  const items = spec.items || [];
  const baseItems = Object.fromEntries((((base.axes || {})[ax] || {}).items || []).map((x) => [x.id, JSON.stringify(x)]));
  const prefix = (rules.prefix || {})[ax] || ax.slice(0, 3);
  const hasHints = ax !== 'status' && (structural.has(ax) || items.some((it) => Array.isArray(it.hints)));
  const hasDesc = structural.has(ax) || items.some((it) => 'desc' in it);

  const side = axes.map((a) => {
    const s = doc.axes[a] || {};
    const its = s.items || [];
    const bIts = ((base.axes || {})[a] || {}).items || [];
    const chg = JSON.stringify(its) !== JSON.stringify(bIts);
    return `<button type="button" class="cfg-edax ${a === ax ? 'on' : ''} ${chg ? 'chg' : ''}" data-edax="${esc(a)}">
      <span class="nm">${esc(s.label || a)}${chg ? ' <span class="dt" title="有改动">●</span>' : ''}</span>
      <span class="ct">${its.length} 个类目</span>
      <span class="lk">${structural.has(a) ? '可增删' : '锁定：只能改字'}</span></button>`;
  }).join('');

  const rows = items.map((it, i) => {
    const p = `axes/${ax}/items/${i}`;
    const isNew = !(it.id in baseItems);
    const chg = !isNew && baseItems[it.id] !== JSON.stringify(it);
    return `<div class="cfg-editem ${chg ? 'chg' : ''} ${isNew ? 'new' : ''}">
      <div class="hd"><code class="id">${esc(it.id)}</code>
        ${isNew ? '<span class="bdg new">新</span>' : '<span class="lock" title="id 是标签表的键，建立之后不能改">id 锁定</span>'}
        <span class="sp">${structural.has(ax) ? `<button type="button" class="btn sm ghost danger" data-eddel="${i}" title="删掉这个类目（预览会告诉你多少条内容会失去标签）">删除</button>` : ''}</span></div>
      <div class="cfg-edrow">
        <label>名字<input type="text" data-ep="${p}/label" value="${esc(it.label || '')}" maxlength="30"></label>
        ${weightAxes.has(ax) ? `<label>权重（热度公式用）<input type="number" data-ep="${p}/weight" data-eptype="num" value="${esc(it.weight == null ? '' : it.weight)}" min="0" max="10" step="1"></label>` : ''}
      </div>
      ${hasDesc ? `<label class="cfg-edfull">说明<input type="text" data-ep="${p}/desc" value="${esc(it.desc || '')}" maxlength="120" placeholder="这个类目管什么（给打标的人看）"></label>` : ''}
      ${hasHints ? cfgEdChips(`${p}/hints`, it.hints || [], '词根（内容里出现这些词就打上这个标）', '加一个词，回车') : ''}
    </div>`;
  }).join('');

  const newForm = structural.has(ax) ? `
    <div class="cfg-ednew" id="cfgEdNew">
      <b>+ 新类目</b>
      <input type="text" id="cfgEdNewLabel" placeholder="名字，比如：长辈模式" maxlength="30">
      <input type="text" id="cfgEdNewSlug" placeholder="slug：小写字母开头，a-z 0-9 -" maxlength="31" spellcheck="false">
      <span class="idp">id = <code id="cfgEdNewId">${esc(prefix)}.…</code></span>
      <button type="button" class="btn sm" id="cfgEdNewAdd">加进${esc(spec.label || ax)}</button>
    </div>` : `<div class="note" style="margin:6px 0 0">${esc(spec.label || ax)}的 id（${items.slice(0, 3).map((x) => x.id).join('、')}…）在状态、权重和情绪分档里都有用到，不能增删，只能改名字和说明。</div>`;

  return `<div class="cfg-ed">
    <aside class="cfg-edaxes">${side}</aside>
    <div class="cfg-editems">
      <div class="cfg-edaxhead"><b>${esc(spec.label || ax)}</b><code>${esc(ax)}</code>
        <span class="sp">${structural.has(ax) ? 'id 一旦建立就锁定；删类目前先预览' : 'id 被代码引用：不能增删'}</span></div>
      ${rows || '<div class="cfg-none">这个轴没有类目。</div>'}
      ${newForm}
    </div></div>`;
}

// ---- 追踪项 ----

const CFG_ED_DEFAULT_FIELDS = [
  ['history_weeks', '看多少周', '周'],
  ['baseline_weeks', '基线周数', '周（必须 < 看多少周）'],
  ['min_mentions_for_alert', '告警最少提及', '条'],
  ['alert_delta_pct', '环比涨幅阈值', '%'],
  ['alert_baseline_ratio', '基线倍数阈值', '倍'],
];

function cfgEditorTrackers() {
  const e = S.cfg.edit;
  const doc = e.doc;
  const base = JSON.parse(e.base);
  const ranges = (e.rules.defaults) || {};
  const d = doc.defaults || {};
  const defs = CFG_ED_DEFAULT_FIELDS.map(([k, label, unit]) => {
    const r = ranges[k] || [];
    return `<label>${esc(label)}<input type="number" data-ep="defaults/${k}" data-eptype="num"
      value="${esc(d[k] == null ? '' : d[k])}" ${r.length ? `min="${r[0]}" max="${r[1]}"` : ''} step="${k === 'alert_baseline_ratio' ? '0.1' : '1'}">
      <span class="rg">${esc(unit)}${r.length ? ` · ${r[0]}–${r[1]}` : ''}</span></label>`;
  }).join('');
  const defChg = JSON.stringify(d) !== JSON.stringify(base.defaults || {});

  const axes = (S.meta && S.meta.axes) || [];
  const owners = [...new Set([...((S.meta && S.meta.owners) || []), ...(doc.trackers || []).map((t) => t.owner)].filter(Boolean))];
  const baseT = Object.fromEntries((base.trackers || []).map((t) => [t.id, JSON.stringify(t)]));

  const cards = (doc.trackers || []).map((t, i) => {
    const p = `trackers/${i}`;
    const isNew = !(t.id in baseT);
    const chg = !isNew && baseT[t.id] !== JSON.stringify(t);
    const filt = t.filter || {};
    const frows = axes.map((ax) => {
      const sel = filt[ax.id] || [];
      return `<div class="fgroup"><label>${esc(ax.label)}</label><div class="fchips">${(ax.values || []).map((v) => `
        <span class="fchip${sel.includes(v.id) ? ' on' : ''}" data-edfi="${i}" data-edfax="${esc(ax.id)}" data-edfval="${esc(v.id)}" title="${esc(v.id)}">${esc(v.label)}</span>`).join('')}</div></div>`;
    }).join('');
    // 条件里引用了分类体系里没有的值（比如类目刚被删）：照样列出来，标红，能点掉。
    const unknown = Object.entries(filt).flatMap(([axId, vs]) => {
      const ax = axes.find((a) => a.id === axId);
      return (vs || []).filter((v) => !ax || !(ax.values || []).some((x) => x.id === v)).map((v) => [axId, v]);
    });
    const unk = unknown.length ? `<div class="fgroup"><label class="bad">找不到的值</label><div class="fchips">${unknown.map(([axId, v]) => `
        <span class="fchip on bad" data-edfi="${i}" data-edfax="${esc(axId)}" data-edfval="${esc(v)}" title="分类体系里没有这个 id，点一下去掉">${esc(axId)}=${esc(v)}${iconSvg('x', 12)}</span>`).join('')}</div></div>` : '';
    return `<div class="cfg-edcard ${chg ? 'chg' : ''} ${isNew ? 'new' : ''}">
      <div class="hd"><code>${esc(t.id)}</code>
        ${isNew ? '<span class="bdg new">新</span>' : '<span class="lock" title="id 是追踪项的键，建立之后不能改">id 锁定</span>'}
        <span class="sp">
          <button type="button" class="btn sm" data-edtest="${i}" title="按这条的条件算过去 12 周命中多少条（和追踪中心的算法一致）">试算</button>
          <button type="button" class="btn sm ghost danger" data-edtdel="${i}">删除</button></span></div>
      <div class="cfg-edrow">
        <label>名字<input type="text" data-ep="${p}/name" value="${esc(t.name || '')}" maxlength="40"></label>
        <label>负责人<input type="text" data-ep="${p}/owner" value="${esc(t.owner || '')}" list="cfgEdOwners" placeholder="空 = 未认领" maxlength="20"></label>
        <label>多轴<select data-ep="${p}/match">
          <option value="all"${(t.match || 'all') === 'all' ? ' selected' : ''}>同时满足（all）</option>
          <option value="any"${t.match === 'any' ? ' selected' : ''}>满足其一（any）</option></select></label>
      </div>
      <label class="cfg-edfull">说明<input type="text" data-ep="${p}/desc" value="${esc(t.desc || '')}" maxlength="160" placeholder="这条线盯的是什么、为什么重要"></label>
      ${cfgEdChips(`${p}/tags`, t.tags || [], '标签（追踪中心的角标）', '加一个标签，回车')}
      <div class="cfg-edfilter"><span class="lb">条件（至少一条）</span>${frows}${unk}</div>
      <div class="cfg-edhit" id="cfgEdHit${i}">${cfgEdHitText(t.id)}</div>
    </div>`;
  }).join('');

  return `
    <datalist id="cfgEdOwners">${owners.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>
    <div class="wb-sec ${defChg ? 'chg' : ''}"><h2>告警默认值 <span class="sp">所有追踪项共用 · 越界保存时会被拒</span></h2>
      <div class="wb-body pad cfg-eddefs">${defs}
        ${d.note ? `<div class="note">${esc(d.note)}</div>` : ''}</div></div>
    <div class="cfg-edtrks">${cards || '<div class="cfg-none">还没有追踪项。</div>'}</div>
    <div class="cfg-ednew" id="cfgEdNew">
      <b>+ 新追踪项</b>
      <input type="text" id="cfgEdNewLabel" placeholder="名字，比如：长辈模式可用性" maxlength="40">
      <input type="text" id="cfgEdNewSlug" placeholder="slug：小写字母开头，a-z 0-9 -" maxlength="31" spellcheck="false">
      <span class="idp">id = <code id="cfgEdNewId">trk.…</code></span>
      <button type="button" class="btn sm" id="cfgEdNewAdd">加一条</button>
    </div>`;
}

function cfgEdHitText(id) {
  const h = S.cfg.edit.hits[id];
  if (!h) return '';
  if (h.problems && h.problems.length) return `<span class="bad">${iconSvg('xCircle', 14, 'inl')}${esc(h.problems.join('；'))}</span>`;
  return `过去 ${esc(h.weeks || 12)} 周命中 <b>${h.matched}</b> 条（P0 ${h.p0} 条）· 口径 v${esc(h.version)}`;
}

// ---- 关键词 ----

function cfgEditorKeywords() {
  const e = S.cfg.edit;
  const doc = e.doc;
  const base = JSON.parse(e.base);
  const order = e.rules.groups || Object.keys(doc.groups || {});
  const cards = order.filter((k) => (doc.groups || {})[k]).map((k) => {
    const g = doc.groups[k];
    const bg = (base.groups || {})[k] || {};
    const chg = JSON.stringify(g.terms || []) !== JSON.stringify(bg.terms || []);
    return `<div class="cfg-edcard ${chg ? 'chg' : ''}">
      <div class="hd"><b>${esc(g.label || k)}</b><code>${esc(k)}</code><span class="ct">${(g.terms || []).length} 个</span></div>
      ${g.desc ? `<div class="ds">${esc(g.desc)}</div>` : ''}
      ${cfgEdChips(`groups/${k}/terms`, g.terms || [], '词条', '加一个词，回车')}
    </div>`;
  }).join('');
  const cr = doc.collection_rules || {};
  const rules = Object.entries(cr).filter(([k]) => k !== 'note').map(([k, v]) => `
    <div class="cfg-rule"><span><code>${esc(k)}</code></span><b>${esc(Array.isArray(v) ? v.join(' – ') : String(v))}</b></div>`).join('');
  return `<div class="cfg-edkws">${cards}</div>
    <div class="wb-sec" style="margin-top:12px"><h2>采集边界 <span class="sp">只读 · 不在编辑器里改</span></h2>
      <div class="wb-body pad">${rules}
        ${cr.note ? `<div class="cfg-warn" style="margin-top:8px">${esc(cr.note)}</div>` : ''}
        <div class="note" style="margin:8px 0 0">抓取频率和上限关系到账号安全，编辑器里不能改；需要调整时请找管理员直接改 <code>config/keywords.json</code>。</div>
      </div></div>`;
}

// ---- 预览块 ----

function cfgEditPrevBlock() {
  const e = S.cfg.edit;
  const p = e && e.preview;
  if (!p) return '';
  const stale = e.previewHash !== cfgEditHash(e.doc);
  if ((p.errors || []).length) return '';   // 报错在顶上的 #cfgEditErrs 里
  if (e.kind === 'taxonomy') {
    const diff = p.diff || {};
    return `<section class="cfg-edprev ${stale ? 'stale' : ''}">
      <h3 class="cfg-h3">预览：按这份草稿，改了会怎样${stale ? ' · <b>草稿又改过了</b>，再预览一次才能保存' : ''}</h3>
      ${cfgImpactKpis({ impact: p.impact })}
      <div class="wb-sec"><h2>Diff <span class="sp">${diff.base ? esc(diff.base.label) + ' → 草稿' : '没有可比对象'}</span></h2>
        <div class="wb-body pad">${!diff.base ? `<div class="note" style="margin:0">${esc(diff.explain || '还没有登记过任何版本，没有可比的基线。')}</div>`
          : (diff.identical ? '<div class="cfg-same">内容没变。</div>' : cfgDiffAxes(diff))}</div></div>
      ${cfgImpactDetail({ impact: p.impact })}
    </section>`;
  }
  if (e.kind === 'trackers') {
    // 命中数为 null = 条件本身有问题算不出来（报错在顶上），印「—」，不印 0：0 是"没命中"，那是另一个意思。
    const n = (x) => (x == null ? '—' : x);
    const rows = (p.trackers || []).map((t) => `
      <div class="cfg-edtp ${esc(t.state)}">
        <span class="stt">${{ added: '新增', removed: '删除', changed: '条件变了', same: '没变' }[t.state] || esc(t.state)}</span>
        <b>${esc(t.name || t.id)}</b>
        <span class="hits">${t.state === 'added' ? `→ <b>${n(t.hits)}</b> 条` : t.state === 'removed' ? `<b>${n(t.hits_before)}</b> 条 →（没了）`
          : `<b>${n(t.hits_before)}</b> → <b>${n(t.hits)}</b> 条${t.hits != null && t.hits_before != null && t.hits !== t.hits_before
            ? ` <span class="dl ${t.hits < t.hits_before ? 'down' : 'up'}">${t.hits > t.hits_before ? '+' : ''}${t.hits - t.hits_before}</span>` : ''}`}</span>
      </div>`).join('');
    return `<section class="cfg-edprev ${stale ? 'stale' : ''}">
      <h3 class="cfg-h3">试算全部：过去 ${esc(p.weeks || 12)} 周，每条追踪项现在命中 → 按草稿命中${stale ? ' · <b>草稿又改过了</b>，再试算一次' : ''}</h3>
      ${rows || '<div class="cfg-none">没有追踪项。</div>'}
    </section>`;
  }
  return '';
}

// ---- 动作 ----

async function cfgEditPreview() {
  const e = S.cfg.edit;
  if (!e || e.saving) return;
  if (cfgEdSweepChips()) cfgEditRepaintBody();
  const btn = $('#cfgEditPreview');
  if (btn) { btn.disabled = true; btn.textContent = e.kind === 'taxonomy' ? '正在全库重算…' : '正在算…'; }
  const hash = cfgEditHash(e.doc);
  try {
    const r = await post('/api/settings/preview', { kind: e.kind, doc: e.doc });
    e.errors = r.errors || [];
    e.preview = r;
    e.previewHash = e.errors.length ? '' : hash;
    if (e.errors.length) toast(`草稿有 ${e.errors.length} 处问题，先改掉`, true);
  } catch (err) {
    e.errors = String(err.message || '').split('；').filter(Boolean);
    e.preview = null; e.previewHash = '';
    toast(err.message, true);
  }
  const errs = $('#cfgEditErrs');
  if (errs) errs.innerHTML = cfgEditErrsBlock();
  cfgEditRepaintBar();
  const prev = $('#cfgEditPrev');
  if (prev && e.preview && !e.errors.length && prev.scrollIntoView) prev.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function cfgEditSave() {
  const e = S.cfg.edit;
  if (!e || e.saving) return;
  if (cfgEdSweepChips()) {
    cfgEditRepaintBody();
    if (e.kind === 'taxonomy') { toast('没按回车的词已经收进去了，草稿有变化，再预览一次才能保存', true); return; }
  }
  if (!cfgEditDirty()) return;
  e.saving = true;
  cfgEditRepaintBar();
  try {
    const r = await api('PUT', '/api/settings/edit/' + encodeURIComponent(e.kind), { doc: e.doc, base_fingerprint: e.fingerprint });
    toast(r.changed === false ? '内容和文件里的一样，没有写入' : '已保存（留了备份），回配置中心看影响，再登记发布');
    if (r.changed !== false) S.cfg.justSaved = { kind: e.kind };
    S.cfg.editKind = null;
    S.cfg.edit = null;
    await go('config');
    loadWbBadge();
  } catch (err) {
    e.saving = false;
    if (err.status === 409) { e.conflict = true; }
    else e.errors = String(err.message || '').split('；').filter(Boolean);
    toast(err.message, true);
    const errs = $('#cfgEditErrs');
    if (errs) errs.innerHTML = cfgEditErrsBlock();
    cfgEditRepaintBar();
    if (errs && errs.scrollIntoView) errs.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function cfgEditDiscard() {
  const e = S.cfg.edit;
  if (!e || !cfgEditDirty()) return;
  if (typeof confirm === 'function' && !confirm(`放弃这 ${cfgEditChanges()} 处改动，回到文件里的那份？`)) return;
  e.doc = JSON.parse(e.base);
  e.errors = []; e.preview = null; e.previewHash = ''; e.hits = {};
  cfgEditRepaintBody();
}

// 离开编辑器前问一句。给 go() 用：返回 true = 可以走。
function cfgEditMayLeave() {
  if (!S.cfg.edit || !cfgEditDirty()) return true;
  if (typeof confirm !== 'function') return true;
  return confirm(`${CFG_EDIT_META[S.cfg.edit.kind].title}有 ${cfgEditChanges()} 处改动还没保存，离开就丢了。确定离开？`);
}

function cfgEdAddChip(path, raw) {
  const arr = cfgEdGet(path);
  const list = Array.isArray(arr) ? arr : [];
  if (!Array.isArray(arr)) cfgEdSet(path, list);
  let added = 0;
  String(raw || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean).forEach((s) => {
    if (!list.includes(s)) { list.push(s); added++; }
  });
  return added;
}

// 打完一个词没按回车就去点「预览」/「保存」是最常见的动作：动手之前把所有词条输入框里剩下的字收进去。
// 返回收进去了几个 —— 分类体系收进去了就得重新预览（哈希变了）。
function cfgEdSweepChips() {
  let n = 0;
  document.querySelectorAll('#cfgEditBody [data-edadd]').forEach((inp) => {
    if (inp.value && inp.value.trim()) { n += cfgEdAddChip(inp.dataset.edadd, inp.value); inp.value = ''; }
  });
  return n;
}

function cfgEdSlugOk(slug) {
  const pat = (S.cfg.edit.rules || {}).slug || '^[a-z][a-z0-9-]{1,30}$';
  return new RegExp(pat).test(slug);
}

function cfgEdAllIds() {
  const e = S.cfg.edit;
  if (e.kind === 'taxonomy') return Object.values(e.doc.axes || {}).flatMap((s) => (s.items || []).map((x) => x.id));
  return (e.doc.trackers || []).map((t) => t.id);
}

function cfgEdAddNew() {
  const e = S.cfg.edit;
  const label = (($('#cfgEdNewLabel') || {}).value || '').trim();
  const slug = (($('#cfgEdNewSlug') || {}).value || '').trim();
  if (!label) { toast('先起个名字', true); return; }
  if (!cfgEdSlugOk(slug)) { toast('slug 要小写字母开头，只能是 a-z 0-9 -，2–31 位', true); return; }
  const prefix = e.kind === 'taxonomy' ? ((e.rules.prefix || {})[e.axis] || e.axis.slice(0, 3)) : (e.rules.prefix || 'trk');
  const id = `${prefix}.${slug}`;
  if (cfgEdAllIds().includes(id)) { toast(`${id} 已经有了`, true); return; }
  if (e.kind === 'taxonomy') {
    e.doc.axes[e.axis].items.push({ id, label, desc: '', hints: [] });
  } else {
    if (!Array.isArray(e.doc.trackers)) e.doc.trackers = [];
    e.doc.trackers.push({ id, name: label, desc: '', owner: '', tags: [], match: 'all', filter: {} });
  }
  cfgEditRepaintBody();
  const nl = $('#cfgEdNewLabel');
  if (nl && nl.focus) nl.focus();
}

async function cfgEdTestTracker(i) {
  const e = S.cfg.edit;
  const t = (e.doc.trackers || [])[i];
  if (!t) return;
  const p = new URLSearchParams();
  Object.entries(t.filter || {}).forEach(([ax, vs]) => { if (vs && vs.length) p.set(ax, vs.join(',')); });
  p.set('match', t.match || 'all');
  p.set('weeks', 12);
  const box = document.getElementById('cfgEdHit' + i);
  if (box) box.innerHTML = '正在算…';
  try {
    const r = await api('GET', '/api/settings/test?' + p.toString());
    e.hits[t.id] = Object.assign({ weeks: 12 }, r);
  } catch (err) {
    e.hits[t.id] = { problems: [err.message] };
  }
  if (box) box.innerHTML = cfgEdHitText(t.id);
}

// ---- 交互：一套委托监听绑在 #cfgEditPage 上（和配置中心的 bindCfg 同一条规矩）----

function bindCfgEditor() {
  const host = $('#cfgEditPage');
  if (!host || host.dataset.cfgEditBound) return;
  host.dataset.cfgEditBound = '1';

  host.addEventListener('click', (ev) => {
    const T = ev.target;
    const e = S.cfg.edit;
    if (T.closest('#cfgEditBack')) return go('config', {});
    if (T.closest('#cfgEditReload') || T.closest('#cfgEditReloadC')) {
      if (e && e.conflict || cfgEditMayLeave()) { S.cfg.edit = null; return loadCfgEditor(S.cfg.editKind); }
      return;
    }
    if (!e) return;
    if (T.closest('#cfgEditDiscard')) return cfgEditDiscard();
    if (T.closest('#cfgEditPreview')) return cfgEditPreview();
    if (T.closest('#cfgEditSave')) return cfgEditSave();
    if (T.closest('#cfgEdNewAdd')) return cfgEdAddNew();
    const axb = T.closest('[data-edax]');
    if (axb) { e.axis = axb.dataset.edax; return cfgEditRepaintBody(); }
    const del = T.closest('[data-eddel]');
    if (del) {
      const i = +del.dataset.eddel;
      const it = e.doc.axes[e.axis].items[i];
      if (!it) return;
      if (typeof confirm === 'function' && !confirm(`删掉类目「${it.label}」（${it.id}）？\n已经打了这个标的内容会失去它；预览影响面会显示有多少条因此失去全部标签。`)) return;
      e.doc.axes[e.axis].items.splice(i, 1);
      return cfgEditRepaintBody();
    }
    const tdel = T.closest('[data-edtdel]');
    if (tdel) {
      const i = +tdel.dataset.edtdel;
      const t = e.doc.trackers[i];
      if (!t) return;
      if (typeof confirm === 'function' && !confirm(`删掉追踪项「${t.name}」（${t.id}）？\n它的历史指标还在库里，只是不再算新的。`)) return;
      e.doc.trackers.splice(i, 1);
      return cfgEditRepaintBody();
    }
    const tst = T.closest('[data-edtest]');
    if (tst) return cfgEdTestTracker(+tst.dataset.edtest);
    const rm = T.closest('[data-edrm]');
    if (rm) {
      const arr = cfgEdGet(rm.dataset.edrm);
      if (Array.isArray(arr)) arr.splice(+rm.dataset.edidx, 1);
      return cfgEditRepaintBody();
    }
    const fi = T.closest('[data-edfi]');
    if (fi) {
      const t = e.doc.trackers[+fi.dataset.edfi];
      if (!t) return;
      if (!t.filter) t.filter = {};
      const ax = fi.dataset.edfax, v = fi.dataset.edfval;
      const cur = t.filter[ax] || [];
      t.filter[ax] = cur.includes(v) ? cur.filter((x) => x !== v) : cur.concat([v]);
      if (!t.filter[ax].length) delete t.filter[ax];
      return cfgEditRepaintBody();
    }
  });

  const onEdit = (ev) => {
    const T = ev.target;
    if (!S.cfg.edit || !T || !T.dataset) return;
    if (T.id === 'cfgEdNewSlug') {
      const e = S.cfg.edit;
      const prefix = e.kind === 'taxonomy' ? ((e.rules.prefix || {})[e.axis] || e.axis.slice(0, 3)) : (e.rules.prefix || 'trk');
      const out = $('#cfgEdNewId');
      if (out) out.textContent = `${prefix}.${T.value.trim() || '…'}`;
      return;
    }
    const ep = T.dataset.ep;
    if (!ep) return;
    let v = T.value;
    if (T.dataset.eptype === 'num') v = T.value === '' ? '' : Number(T.value);
    cfgEdSet(ep, v);
    cfgEditRepaintBar();
  };
  host.addEventListener('input', onEdit);
  host.addEventListener('change', onEdit);

  host.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ',') return;
    const T = ev.target;
    if (!S.cfg.edit || !T) return;
    if (T.dataset && T.dataset.edadd) {
      ev.preventDefault();
      const path = T.dataset.edadd;
      if (!cfgEdAddChip(path, T.value)) { T.value = ''; return; }
      cfgEditRepaintBody();
      const again = document.querySelector(`[data-edadd="${path.replace(/"/g, '\\"')}"]`);
      if (again && again.focus) again.focus();
      return;
    }
    if (ev.key === 'Enter' && (T.id === 'cfgEdNewSlug' || T.id === 'cfgEdNewLabel')) { ev.preventDefault(); cfgEdAddNew(); }
  });
}

// ---------------------------------------------------------------- 页面 8：归档
//
// 这一页回答的是「历史还在不在」，不是「有哪些文件」——`ls out/` 谁都会看，
// 会看错的恰恰是下面三件事，所以三块各自单独说。
//
//  1. **名字里带周次的才是档。** `dashboard.html` / `trackers.html` / `tracker-*.html`
//     每次出报表都会被重写成"最新那一次"。看到 out/ 里 10 个 tracker 页会以为
//     有 10 份历史，其实它们只描述当前。分错这一栏，整页的结论就反了。
//  2. 「数在」和「档在」是两件事：指标在库里 = **还能重算**，趋势线不会断；
//     产物在 out/ 里 = 当时那一份留下了。缺后者只说"没留档"，不是"丢了" ——
//     说成丢了，人会去救一个没坏的东西。
//  3. 口径快照的两个方向说法不一样：表有文件没 = 还能从库里恢复（表里存了全文）；
//     文件有表没 = 那一版没登记过，趋势线可能在那儿断过。合成一句"不完整"，
//     人就不知道该干什么了。
//
// 只读。右上角写死 —— 和配置中心同一条纪律。

async function renderArchivePage() {
  $('#main').innerHTML = `
    <div class="head">
      <div><h1>归档</h1><div class="sub" id="arclede">正在加载…</div></div>
      <div class="rt" id="arcrt"></div>
    </div>
    <div id="arc"><div class="empty">正在加载…</div></div>`;
  if (S.arc.data) renderArchive();
  await loadArchive();
}

async function loadArchive() {
  try {
    S.arc.data = await get('/api/archive');
    renderArchive();
  } catch (e) {
    const el = $('#arc');
    if (el) el.innerHTML = `<div class="empty"><b>归档加载失败</b>${esc(e.message)}</div>`;
  }
}

function renderArchive() {
  const d = S.arc.data;
  const el = $('#arc');
  if (!el || !d) return;

  const h = d.headline || {};
  const mark = levelMark(h.level === 'warn' ? 'warn' : 'ok');

  const lede = $('#arclede');
  if (lede) {
    lede.innerHTML = `产物目录 <code>${esc(d.out_dir)}</code> · 库里有指标的周 <b>${d.weeks_n}</b> 个`;
  }
  const rt = $('#arcrt');
  if (rt) rt.innerHTML = '';

  // 双栏：左边是"哪一周有什么"（周历 → 类型 → 明细），右边是阅读器。
  // 以前周报渲染在页面最底部，看完要滚回顶部选下一周；现在左选右读，列表一直在。
  const k = S.arc.kind;
  const left = [
    arcStrip(d),
    arcWeeksBlock(d),
    arcKindChips(d),
    k === '' || k === 'weekly' || k === 'dashboard'
      ? `<div class="ops-grid"><div>${arcArchivedBlock(d)}</div><div>${arcCurrentBlock(d)}</div></div>` : '',
    k === '' || k === 'version' ? arcSnapshotsBlock(d) : '',
  ].join('');

  el.innerHTML = `
    <div class="wb-head ${esc(h.level || 'ok')}">
      <div class="mk">${mark}</div>
      <div style="flex:1;min-width:0"><div class="tx">${esc(h.text || '')}</div></div>
    </div>
    <div class="arc-grid${S.arc.weekly ? ' reading' : ''}">
      <div class="arc-left">${left}</div>
      <div class="arc-right" id="arcReader">${arcWeeklyBlock(d)}</div>
    </div>`;

  bindArc();
  arcBuildToc();
}

// 周历 strip：最近 12 周一格一周，绿 = 数在档也在 / 黄 = 数在没留档 / 红 = 有档库里没数。
// 点一格 = 选中这一周：下方产物明细只剩它的，有周报就顺手在右边打开。再点一次取消。
function arcStrip(d) {
  const weeks = (d.weeks || []).slice(0, 12).slice().reverse();   // 服务端是新→旧，画成旧→新
  if (!weeks.length) return '';
  const cells = weeks.map((w) => {
    const on = S.arc.pick === w.week;
    const short = String(w.week).replace(/^\d{4}-?W?/, '');
    return `<button type="button" class="wk-cell ${esc(w.state)}${on ? ' on' : ''}" data-week="${esc(w.week)}"
      title="${esc(w.week)} · ${esc(w.state_label)}${w.weekly_md ? ' · 有周报' : ''}">${esc(short)}</button>`;
  }).join('');
  return `<div class="wk-strip-wrap">
    <div class="wk-strip">${cells}</div>
    <div class="wk-legend"><i class="ok"></i>数在，档也在 <i class="no_archive"></i>数在，没留档 <i class="orphan"></i>有档，库里没数
      ${S.arc.pick ? `<span class="sp">只看 <b>${esc(S.arc.pick)}</b> · <button type="button" class="lnk" id="arcUnpick">取消</button></span>` : ''}</div>
  </div>`;
}

function arcKindChips(d) {
  const kinds = [
    ['', `全部`], ['weekly', `周报 ${d.archived.filter((f) => f.kind === 'weekly').length}`],
    ['dashboard', `看板快照 ${d.archived.filter((f) => f.kind === 'dashboard').length}`],
    ['version', `分类版本 ${(d.snapshots.rows || []).length}`],
  ];
  return `<div class="arc-kinds">${kinds.map(([id, label]) =>
    `<button type="button" class="fchip${S.arc.kind === id ? ' on' : ''}" data-akind="${id}">${esc(label)}</button>`).join('')}</div>`;
}

// 阅读器目录：从渲染后的 h2 / h3 抽，给它们补 id，点一下滚到那一节。
function arcBuildToc() {
  const body = document.getElementById('arcMarkdown');
  const toc = document.getElementById('arcToc');
  if (!body || !toc || !body.querySelectorAll) return;
  const hs = [...body.querySelectorAll('h2, h3')];
  if (!hs.length) { toc.innerHTML = ''; return; }
  toc.innerHTML = `<div class="toc-h">目录</div>` + hs.map((h, i) => {
    if (!h.id) h.id = `md-h-${i}`;
    return `<a class="toc-${h.tagName.toLowerCase()}" data-toc="${h.id}">${esc(h.textContent)}</a>`;
  }).join('');
  toc.querySelectorAll('[data-toc]').forEach((a) => a.addEventListener('click', () => {
    const t = document.getElementById(a.dataset.toc);
    if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function arcWeeksBlock(d) {
  if (!d.weeks_n) {
    return `<div class="wb-sec"><h2>按周对齐</h2>
      <div class="wb-body pad"><div class="ops-foot" style="margin-top:0">
        还没有任何一周的指标和报表文件。在数据管道里跑一次「打标 + 出报表」就有了。
      </div></div></div>`;
  }
  const rows = d.weeks.map((w) => {
    const cls = w.state === 'orphan' ? 'bad' : w.state === 'no_archive' ? 'warn' : '';
    const m = [];
    if (w.metrics.tracker) m.push(`追踪项 ${w.metrics.tracker} 格`);
    if (w.metrics.weekly) m.push(`周指标 ${w.metrics.weekly} 格`);
    const open = w.weekly_md
      ? `<button class="btn sm" data-week="${esc(w.week)}">看周报</button>` : '';
    const tick = (v) => (v ? `<span class="tick">${iconSvg('check', 14)}</span>` : '<span class="dim">—</span>');
    return `<tr class="${cls}${S.arc.pick === w.week ? ' pick' : ''}">
      <td class="mono">${esc(w.week)}</td>
      <td>${esc(w.state_label)}</td>
      <td class="ctr">${tick(w.weekly_md)}</td>
      <td class="ctr">${tick(w.dashboard)}</td>
      <td class="dim">${esc(m.join(' · ') || '无指标')}</td>
      <td>${open}</td>
    </tr>`;
  }).join('');

  return `<div class="wb-sec">
    <h2>按周对齐${infoI('「数在，没留档」不影响使用：指标还在库里，那一周可以重算，趋势不会断，只是当时的报表文件没留下。需要处理的是「有档，库里没数」：那时报表文件是唯一的记录，别删。')} <span class="n">${d.weeks_n}</span><span class="sp"></span></h2>
    <div class="wb-body">
      <table class="arc-table">
        <thead><tr><th>周</th><th>状态</th><th class="ctr">周报</th><th class="ctr">看板</th>
          <th>库里的指标</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div></div>`;
}

function arcArchivedBlock(d) {
  const list = d.archived
    .filter((f) => !S.arc.pick || f.week === S.arc.pick)
    .filter((f) => !S.arc.kind || S.arc.kind === 'version' || f.kind === S.arc.kind);
  const rows = list.map((f) => `<div class="arc-row">
      <span class="arc-week mono">${esc(f.week)}</span>
      <span class="arc-kind">${f.kind === 'weekly' ? '周报' : '看板'}</span>
      <span class="arc-name">${esc(f.name)}</span>
      <span class="arc-size">${esc(f.size_h)}</span>
      <span class="arc-at">${esc(f.at)}</span>
    </div>`).join('');
  return `<div class="wb-sec" id="arcArchived">
    <h2>归档产物 <span class="n">${list.length}${list.length !== d.archived.length ? ` / ${d.archived.length}` : ''}</span><span class="sp"></span></h2>
    <div class="wb-body pad">
      ${rows || (d.archived.length ? '<div class="dim">这一周 / 这一类没有归档产物。</div>' : '<div class="dim">一份都没有。</div>')}
    </div></div>`;
}

function arcCurrentBlock(d) {
  const rows = d.current.map((f) => `<div class="arc-row">
      <span class="arc-name">${esc(f.name)}</span>
      <span class="arc-size">${esc(f.size_h)}</span>
      <span class="arc-at">${esc(f.at)}</span>
    </div>`).join('');
  return `<div class="wb-sec">
    <h2>当前产物${infoI('这些文件名里没有周次，每次出报表都会被覆盖成最新一次，不算归档。')} <span class="n">${d.current.length}</span><span class="sp"></span></h2>
    <div class="wb-body pad">
      ${rows || '<div class="dim">还没有。</div>'}
    </div></div>`;
}

function arcSnapshotsBlock(d) {
  const rows = d.snapshots.rows.map((s) => `<tr class="${s.state === 'ok' ? '' : 'warn'}">
      <td class="mono">v${esc(s.version)}</td>
      <td>${esc(s.released_at || '')}</td>
      <td class="dim">${esc(s.note || '')}</td>
      <td class="${s.file_present ? '' : 'bad'}">${esc(s.state_label)}</td>
    </tr>`).join('');
  const orphan = d.snapshots.orphan_files.map((s) => `<tr class="warn">
      <td class="mono">v${esc(s.version)}</td><td>—</td>
      <td class="dim">${esc(s.name)}</td>
      <td>${esc(s.state_label)}</td>
    </tr>`).join('');
  return `<div class="wb-sec" id="arcSnapshots">
    <h2>口径快照${infoI('每个口径版本存两份：登记表里一条记录和一个快照文件。文件丢了能从登记表补回；登记表里没有才是问题：那一版没登记过，用它算的那几周说不清当时的标准。')} <span class="n">${d.snapshots.rows.length}</span><span class="sp"></span></h2>
    <div class="wb-body">
      <table class="arc-table">
        <thead><tr><th>版本</th><th>登记时间</th><th>说明</th><th>存档情况</th></tr></thead>
        <tbody>${rows}${orphan}</tbody>
      </table>
    </div></div>`;
}

function arcWeeklyBlock(d) {
  const w = S.arc.weekly;
  if (!w) {
    return `<div class="wb-sec reader"><h2>周报阅读器</h2>
      <div class="wb-body pad"><div class="dim">还没选哪一周。</div></div></div>`;
  }
  if (!w.exists) {
    return `<div class="wb-sec reader"><h2>周报阅读器</h2>
      <div class="wb-body pad"><div class="note">${esc(w.say || '没有这一周的周报')}</div></div></div>`;
  }
  return `<div class="wb-sec reader" id="arcWeekBox">
    <h2>周报 <span class="mono" style="font-size: 13px;color:var(--tx3)">${esc(w.week)}</span>
      <span class="sp"><a href="${esc(w.path)}" download>下载 .md</a></span></h2>
    <div class="wb-body pad">
      <nav class="md-toc" id="arcToc"></nav>
      <div class="md-body" id="arcMarkdown">${w.html}</div>
      <div class="ops-foot">当时那一份原文 · 读自 <code>${esc(w.path)}</code></div>
    </div></div>`;
}

function bindArc() {
  // 表里的「看周报」：只打开阅读器，不改选中周
  document.querySelectorAll('#arc .arc-table [data-week]').forEach((b) => {
    b.addEventListener('click', () => loadWeekly(b.dataset.week));
  });
  // 周历格子：选中 / 取消这一周，有周报就顺手打开
  document.querySelectorAll('#arc .wk-cell[data-week]').forEach((b) => {
    b.addEventListener('click', () => {
      const wk = b.dataset.week;
      S.arc.pick = S.arc.pick === wk ? '' : wk;
      renderArchive();
      const w = (S.arc.data.weeks || []).find((x) => x.week === wk);
      if (S.arc.pick && w && w.weekly_md) loadWeekly(wk);
    });
  });
  const un = $('#arcUnpick');
  if (un) un.addEventListener('click', () => { S.arc.pick = ''; renderArchive(); });
  document.querySelectorAll('#arc [data-akind]').forEach((c) => {
    c.addEventListener('click', () => { S.arc.kind = c.dataset.akind; renderArchive(); });
  });
}

async function loadWeekly(week) {
  // 已经是这一周了就别重复请求（再点一次是"我还想看看"，不是"重新拉一遍"）。
  if (S.arc.week === week && S.arc.weekly) {
    const box = $('#arcWeekBox');
    if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  try {
    S.arc.weekly = await get('/api/archive/weekly/' + encodeURIComponent(week));
    S.arc.week = week;
    renderArchive();
    // 阅读器在右栏、和列表并排，一般已经在视野里；窄屏下它落到列表下面，才需要滚过去。
    const box = $('#arcWeekBox');
    if (box && box.getBoundingClientRect && box.getBoundingClientRect().top > (window.innerHeight || 900) * 0.8) {
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (e) {
    toast(e.message, true);
  }
}

// ---------------------------------------------------------------- 规划中的页面

function renderSoonPage(page) {
  const c = SOON[page];
  if (!c) { $('#main').innerHTML = '<div class="empty">页面不存在</div>'; return; }
  $('#main').innerHTML = `
    <div class="head">
      <div><h1>${esc(c.title)}</h1><div class="sub">${esc(c.lede)}</div></div>
      <div class="rt"><span class="ro">规划中 · 尚未实现</span></div>
    </div>
    <div class="soon-wrap">
      <h2>这一页要做的事</h2>
      <p class="lede">下面是已经定下来的功能清单，来自 docs/ADMIN-IA.md。实现之前先摆在这，
      免得「规划过的」和「记得做过的」混在一起。</p>
      <ul>${(c.items || []).map(([b, t]) => `<li><b>${esc(b)}</b> —— ${esc(t)}</li>`).join('')}</ul>
      ${c.href ? `<div class="note">这一页已经有产出物：<a href="${esc(c.href)}" target="_blank">${esc(c.href)}${EXT_ICON}</a></div>` : ''}
      <div class="note">目前真正能用的是 <b>1 工作台</b>、<b>3 追踪中心</b>、<b>4 洞察池</b>、
      <b>5 跟进看板</b> 和 <b>6 数据管道</b>：分别回答「今天该我做什么」「这条线还是用同一把尺子量的吗」
      「这条内容归谁管」「这个主题走到哪一步了」「这些数还作不作数」。
      其余页面还只是清单，没实现的就是没实现。</div>
    </div>`;
}

// ---------------------------------------------------------------- 菜单组件（通用层）+ 增强原生 <select>
//
// 一套菜单，四处用：<select> 的增强（单选）、洞察池上方一行的下拉、列头筛选（多选带计数）、表格里的状态单元格。
// 菜单是 body 上唯一的一个 #selMenu，fixed 定位：不会被 .card 的 overflow:hidden 切掉；下面放不下翻上去、右边出界右对齐。
//
//   openMenu(btn, spec)   spec = { title?, search?, multi?, items() → [...], pick(value) }
//     item = { value, label, on, count?, sw?, hint? } | { sep: true } | { head: '…' }
//     单选：项右侧 ✓，选后关闭；多选：项左侧方框，选后不关、重画（计数会变）。
//     search 且项 ≥ 8：顶部一个过滤输入框。键盘：↑↓ 移动、Enter 选、Esc / Tab 关；点外面 / 滚动关。
//   menuClose() / menuRepaint()
//
// 原生 <select>：页面里照写不动（value / change 语义、各页的委托监听全都保留），渲染后自动被增强：
// 原生控件藏起来仍是值的载体，旁边一颗触发按钮，点开走 openMenu；选一项 = 写回 select.value 并派发冒泡的 change。
// MutationObserver 盯着 body，页面怎么重画都自动增强。假 DOM（冒烟测试）里没有 MutationObserver，这一段静静跳过。

const SEL_CHEVRON = '<svg class="sel-cv" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SEL_CHECK = '<svg class="sel-ck" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SEL_TICK = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let _menu = null;   // { btn, spec, act, q }

function menuEl() {
  let m = document.getElementById('selMenu');
  if (!m) {
    m = document.createElement('div');
    m.id = 'selMenu';
    m.className = 'sel-menu';
    m.setAttribute('role', 'listbox');
    m.hidden = true;
    document.body.appendChild(m);
    m.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });   // 别把焦点从触发按钮上抢走
    m.addEventListener('click', (e) => {
      const o = e.target.closest('.sel-opt');
      if (o && !o.classList.contains('dis') && _menu) menuPick(o.dataset.v);
    });
    m.addEventListener('input', (e) => {
      if (!e.target.classList.contains('mq-in') || !_menu) return;
      _menu.q = e.target.value.trim();
      const pos = e.target.selectionStart;
      menuRepaint();
      const q = m.querySelector('.mq-in');
      if (q) { q.focus(); q.setSelectionRange(pos, pos); }
    });
  }
  return m;
}

function menuItemHtml(it, multi) {
  if (it.sep) return '<div class="sel-sep"></div>';
  if (it.head) return `<div class="sel-head">${esc(it.head)}</div>`;
  return `<div class="sel-opt${it.on ? ' on' : ''}${it.count === 0 ? ' zero' : ''}${it.disabled ? ' dis' : ''}${it.act ? ' act' : ''}" role="option"
      data-v="${esc(it.value)}" aria-selected="${!!it.on}">
      ${multi ? `<span class="cb">${SEL_TICK}</span>` : ''}${it.sw ? `<span class="sw ${esc(it.sw)}"></span>` : ''}
      <span class="lb">${esc(it.label)}${it.hint ? `<span class="hint">${esc(it.hint)}</span>` : ''}</span>
      ${it.count != null ? `<span class="cnt">${it.count}</span>` : ''}${!multi ? SEL_CHECK : ''}
    </div>`;
}

function openMenu(btn, spec) {
  const same = _menu && _menu.btn === btn;
  menuClose();
  if (same) return;
  _menu = { btn, spec, act: -1, q: '' };
  btn.setAttribute('aria-expanded', 'true');
  btn.classList.add('open');
  const m = menuEl();
  m.hidden = false;
  menuRepaint();
  // 定位：贴在按钮下方；下面放不下就翻到上方；右边出界就右对齐。
  const r = btn.getBoundingClientRect();
  m.style.minWidth = Math.max(r.width, 180) + 'px';
  m.style.left = r.left + 'px';
  m.style.top = (r.bottom + 4) + 'px';
  const mh = m.offsetHeight, mw = m.offsetWidth;
  if (r.bottom + 4 + mh > window.innerHeight - 8 && r.top - 4 - mh > 8) m.style.top = (r.top - 4 - mh) + 'px';
  if (r.left + mw > window.innerWidth - 8) m.style.left = Math.max(8, r.right - mw) + 'px';
  const q = m.querySelector('.mq-in');
  if (q) q.focus();
  const on = m.querySelector('.sel-opt.on');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  document.addEventListener('mousedown', menuOutside, true);
  document.addEventListener('keydown', menuKey, true);
  window.addEventListener('scroll', menuOnScroll, true);
  window.addEventListener('resize', menuClose);
}

// 重画菜单内容（多选之后计数会变、过滤框输入之后项会少），位置不动。
function menuRepaint() {
  if (!_menu) return;
  const { spec, q } = _menu;
  const m = menuEl();
  const items = spec.items();
  const showQ = spec.search && items.filter((it) => it.value !== undefined).length >= 8;
  const list = q ? items.filter((it) => it.value === undefined || String(it.label).includes(q)) : items;
  m.innerHTML = (spec.title ? `<div class="sel-head">${esc(spec.title)}</div>` : '')
    + (showQ ? `<div class="sel-q"><input class="mq-in" type="text" placeholder="筛一下…" value="${esc(q)}"></div>` : '')
    + list.map((it, i) => menuItemHtml(Object.assign({}, it, { act: i === _menu.act }), spec.multi)).join('')
    + (list.every((it) => it.value === undefined) ? '<div class="sel-none">没有匹配的项</div>' : '');
}

function menuOnScroll(e) {
  // 菜单自己滚不算
  if (_menu && menuEl().contains(e.target)) return;
  menuClose();
}
function menuOutside(e) {
  if (!_menu) return;
  if (menuEl().contains(e.target) || _menu.btn.contains(e.target)) return;
  menuClose();
}
function menuClose() {
  if (!_menu) return;
  const m = menuEl();
  m.hidden = true;
  _menu.btn.setAttribute('aria-expanded', 'false');
  _menu.btn.classList.remove('open');
  const btn = _menu.btn;
  _menu = null;
  document.removeEventListener('mousedown', menuOutside, true);
  document.removeEventListener('keydown', menuKey, true);
  window.removeEventListener('scroll', menuOnScroll, true);
  window.removeEventListener('resize', menuClose);
  if (btn && btn.focus && !btn.disabled && document.activeElement !== btn && menuEl().contains(document.activeElement)) btn.focus();
}
function menuPick(value) {
  if (!_menu) return;
  const { spec, btn } = _menu;
  if (spec.multi) { spec.pick(value); if (_menu) menuRepaint(); return; }
  menuClose();
  spec.pick(value);
  if (btn && btn.focus && !btn.disabled) btn.focus();
}
function menuKey(e) {
  if (!_menu) return;
  const m = menuEl();
  const opts = [...m.querySelectorAll('.sel-opt:not(.dis)')];
  const move = (to) => {
    if (!opts.length) return;
    _menu.act = Math.max(0, Math.min(opts.length - 1, to));
    // act 存的是"可选项里的序号"，重画时按 items 序号比对不方便：直接改 class。
    opts.forEach((o, i) => o.classList.toggle('act', i === _menu.act));
    const a = opts[_menu.act];
    if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
  };
  if (e.key === 'ArrowDown') { e.preventDefault(); move(_menu.act + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(_menu.act - 1); }
  else if (e.key === 'Home') { e.preventDefault(); move(0); }
  else if (e.key === 'End') { e.preventDefault(); move(opts.length - 1); }
  else if (e.key === 'Enter') { const a = opts[_menu.act]; if (a) { e.preventDefault(); menuPick(a.dataset.v); } }
  else if (e.key === 'Escape') { e.preventDefault(); menuClose(); }
  else if (e.key === 'Tab') menuClose();
}

// ---- <select> 增强 ----

function enhanceSelects(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('select').forEach(enhanceSelect);
}

// 表格行 / 顶栏 / 卡片里的行内 select 用小号（30px），其余默认 36px。
function selIsSmall(sel) {
  return sel.classList.contains('stsel') || sel.classList.contains('addtag')
    || !!(sel.closest && sel.closest('td, .topbar, .wb-row, .bcard, .trkrow'));
}

function enhanceSelect(sel) {
  if (!sel || sel.multiple || sel.dataset.sel || sel.dataset.noSel || !sel.parentNode) return;
  sel.dataset.sel = '1';
  const wrap = document.createElement('div');
  wrap.className = 'sel' + (selIsSmall(sel) ? ' sm' : '');
  if (sel.style.flex) wrap.style.flex = sel.style.flex;
  if (sel.style.width) wrap.style.width = sel.style.width;
  // 原生 select 会按最长的选项自撑宽；量一下再藏，触发按钮就不会随选项换字而跳宽。
  const w = sel.offsetWidth;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sel-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `<span class="sel-tx"></span>${SEL_CHEVRON}`;
  if (w) btn.style.minWidth = (w + 8) + 'px';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  wrap.appendChild(btn);
  sel.classList.add('sel-native');
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');
  selSync(sel);
  const spec = {
    items: () => [...sel.options].map((o, i) => ({ value: o.value, label: o.text, on: i === sel.selectedIndex, disabled: o.disabled })),
    pick: (v) => selPick(sel, v),
  };
  btn.addEventListener('click', () => { selSync(sel); openMenu(btn, spec); });
  btn.addEventListener('keydown', (e) => {
    if (_menu && _menu.btn === btn) return;   // 打开着的时候由 menuKey 接管
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selSync(sel); openMenu(btn, spec); }
  });
  sel.addEventListener('change', () => selSync(sel));
}

// 触发按钮上的字和可用性跟着原生 select 走：别的代码改了 value / disabled，下一次 change 或打开时对齐。
function selSync(sel) {
  const btn = sel.parentNode && sel.parentNode.querySelector && sel.parentNode.querySelector('.sel-btn');
  if (!btn) return;
  const opt = sel.options[sel.selectedIndex];
  const tx = btn.querySelector('.sel-tx');
  if (tx) tx.textContent = opt ? opt.text : '';
  btn.disabled = !!sel.disabled;
  if (sel.title) btn.title = sel.title;
}

function selPick(sel, value) {
  if (sel.value !== value) {
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  selSync(sel);
}

if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body && document.body.nodeType === 1) {
  new MutationObserver((muts) => {
    for (const mu of muts) {
      for (const n of mu.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'SELECT') enhanceSelect(n); else enhanceSelects(n);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  enhanceSelects(document);
}

boot();
