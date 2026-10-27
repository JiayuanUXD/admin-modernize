#!/usr/bin/env node
/**
 * map-tokens：把硬编码值映射到现有 token，产出存量迁移清单（技术栈无关，Node 18+，无依赖）。
 *
 * 解决的是「有 token 但没人用」：不新建 token、不重命名，只回答每个硬编码值最近能换成哪个 token、
 * 哪些值没有对应 token、哪些映射有歧义需要人定。只读，不写目标仓库；--json 只写你指定的路径。
 *
 * 用法
 *   node map-tokens.mjs --tokens <token 文件或目录...> --scan <代码目录> [--json <文件>]
 *                       [--near 40] [--near-size 1]
 *
 * --tokens   token 来源：CSS 自定义属性、SCSS $变量、LESS @变量、JS/TS/JSON 里的对象属性。
 *            可传多个文件或目录；目录会递归找上述类型的文件。
 * --scan     要映射的代码目录（或单个文件）。
 * --near     颜色距离阈值（加权 RGB，0 完全相同），默认 40；超过就不建议映射。
 * --near-size 字号容差（px），默认 1；超过就算「不在刻度」。
 *
 * 输出：颜色映射、字号映射、需要人定的清单（歧义 / 无对应 / 透明度不同 / token 冲突 / 未被引用）。
 * 退出码 0 恒为报告模式；参数错误为 2。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative, basename, extname, sep } from 'node:path';

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const usage = () => {
  console.error([
    '用法',
    '  node map-tokens.mjs --tokens <文件或目录...> --scan <代码目录> [--json <文件>] [--near 40] [--near-size 1]',
  ].join('\n'));
};
const opts = { tokens: [], scan: null, json: null, near: 40, nearSize: 1 };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--tokens' || a === '--token') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) opts.tokens.push(argv[++i]); }
  else if (a === '--scan') opts.scan = argv[++i];
  else if (a === '--json') opts.json = argv[++i];
  else if (a === '--near') opts.near = Number(argv[++i]);
  else if (a === '--near-size') opts.nearSize = Number(argv[++i]);
  else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
  else { console.error(`✘ 未知参数 ${a}`); usage(); process.exit(2); }
}
if (!opts.tokens.length || !opts.scan) { usage(); process.exit(2); }
for (const p of [...opts.tokens, opts.scan]) {
  if (!existsSync(p)) { console.error(`✘ ${p} 不存在`); process.exit(2); }
}
if (!(opts.near >= 0) || !(opts.nearSize >= 0)) { console.error('✘ --near / --near-size 必须是非负数'); process.exit(2); }
const SCAN = resolve(opts.scan);

// ---------- 工具 ----------
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', '.output', '.cache', '.turbo', '.idea', '.vscode', '.svn', '__pycache__']);
const TOKEN_EXT = new Set(['css', 'scss', 'sass', 'less', 'styl', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json']);
const SCAN_EXT = new Set(['css', 'scss', 'sass', 'less', 'styl', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue', 'svelte', 'html', 'htm']);
const read = (abs) => { try { return readFileSync(abs, 'utf8'); } catch { return ''; } };
const walk = (dir, out = []) => {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!e.name.startsWith('.') && !SKIP.has(e.name)) walk(join(dir, e.name), out); }
    else out.push(join(dir, e.name));
  }
  return out;
};
const filesUnder = (p) => {
  const abs = resolve(p);
  if (statSync(abs).isDirectory()) return walk(abs);
  return [abs];
};
const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));
const hex2 = (n) => clamp255(n).toString(16).padStart(2, '0');
const rel = (abs) => {
  const r = relative(process.cwd(), abs);
  return (r.startsWith('..') ? abs : r).split(sep).join('/');
};

// ---------- 值归一化 ----------
const hue2rgb = (p, q, t) => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};
const hslToHex = (h, s, l) => {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = s / 100;
  const ll = l / 100;
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  return `#${hex2(hue2rgb(p, q, hh + 1 / 3) * 255)}${hex2(hue2rgb(p, q, hh) * 255)}${hex2(hue2rgb(p, q, hh - 1 / 3) * 255)}`;
};
const parseAlpha = (raw) => {
  if (raw == null) return 1;
  const t = String(raw).trim();
  return t.endsWith('%') ? Number(t.slice(0, -1)) / 100 : Number(t);
};
// 返回 {type:'color'|'size', norm, alpha} 或 null
const classify = (raw) => {
  if (raw == null) return null;
  const v = String(raw).trim().replace(/^['"]|['"]$/g, '');
  let m;
  if ((m = v.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i))) {
    let h = m[1].toLowerCase();
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    return { type: 'color', norm: `#${h.slice(0, 6)}`, alpha: h.length === 8 ? Number((parseInt(h.slice(6), 16) / 255).toFixed(2)) : 1 };
  }
  if ((m = v.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i))) {
    return { type: 'color', norm: `#${hex2(Number(m[1]))}${hex2(Number(m[2]))}${hex2(Number(m[3]))}`, alpha: Number(parseAlpha(m[4]).toFixed(2)) };
  }
  if ((m = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i))) {
    return { type: 'color', norm: hslToHex(Number(m[1]), Number(m[2]), Number(m[3])), alpha: Number(parseAlpha(m[4]).toFixed(2)) };
  }
  if ((m = v.match(/^(-?\d+(?:\.\d+)?)px$/i))) return { type: 'size', norm: Number(m[1]), alpha: 1 };
  return null;
};

// ---------- 收集 token ----------
const tokenDefs = [
  { re: /--([\w-]+)\s*:\s*([^;{}]+);/g, kind: 'css-var' },
  { re: /\$([\w-]+)\s*:\s*([^;{}]+);/g, kind: 'scss-var' },
  { re: /@([\w-]+)\s*:\s*([^;{}]+);/g, kind: 'less-var' },
  { re: /['"]?([\w.-]+)['"]?\s*:\s*['"]((?:#[0-9a-fA-F]{3,8})|(?:rgba?\([^)]*\))|(?:hsla?\([^)]*\))|(?:\d+(?:\.\d+)?px))['"]/g, kind: 'obj-prop' },
];
const tokens = [];
const pending = []; // 间接定义：--color-primary: var(--blue-6)
const tokenFiles = new Set();
for (const src of opts.tokens) {
  for (const abs of filesUnder(src)) {
    const ext = extname(abs).slice(1).toLowerCase();
    if (!TOKEN_EXT.has(ext)) continue;
    const text = read(abs);
    if (!text) continue;
    tokenFiles.add(rel(abs));
    for (const { re, kind } of tokenDefs) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const name = `${kind === 'css-var' ? '--' : kind === 'scss-var' ? '$' : kind === 'less-var' ? '@' : ''}${m[1]}`;
        const raw = m[2].trim();
        const c = classify(raw);
        if (!c) {
          // 一层 var() 引用，等所有 token 收集完再解析
          if (kind === 'css-var' && /^var\(\s*--[\w-]+\s*\)$/.test(raw)) pending.push({ name, raw, kind, source: rel(abs) });
          continue;
        }
        tokens.push({ name, type: c.type, value: c.norm, alpha: c.alpha, raw, kind, source: rel(abs) });
      }
    }
  }
}

// var(--x) 解析：最多 3 轮，解决主题文件里常见的间接定义
const byName = new Map(tokens.map((t) => [t.name, t]));
for (let round = 0; round < 3; round++) {
  let resolved = 0;
  for (const p of pending) {
    if (p.done) continue;
    const ref = p.raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    const target = ref && byName.get(ref[1]);
    if (!target) continue;
    const t = { name: p.name, type: target.type, value: target.value, alpha: target.alpha, raw: p.raw, kind: p.kind, source: p.source };
    tokens.push(t);
    byName.set(t.name, t);
    p.done = true;
    resolved++;
  }
  if (!resolved) break;
}

// ---------- 扫描硬编码 ----------
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g;
const FONT_CSS_RE = /font-?size\s*:\s*(\d+(?:\.\d+)?)px/gi;
const FONT_JS_RE = /fontSize\s*:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?/g;
const DEF_LINE = /^\s*(--[$@]?[\w-]+|[$@][\w-]+)\s*:/;

const occ = new Map(); // key -> { type, norm, alpha, count, files:Set, samples:[] }
const varUses = new Map();
const bumpOcc = (type, norm, alpha, file, raw) => {
  const key = `${type}|${norm}|${alpha}`;
  if (!occ.has(key)) occ.set(key, { type, norm, alpha, count: 0, files: new Set(), samples: [] });
  const o = occ.get(key);
  o.count++;
  o.files.add(rel(file));
  if (o.samples.length < 3) o.samples.push(raw.trim());
};

let scanFiles = 0;
for (const abs of filesUnder(SCAN)) {
  const ext = extname(abs).slice(1).toLowerCase();
  if (!SCAN_EXT.has(ext)) continue;
  const text = read(abs);
  if (!text) continue;
  scanFiles++;
  for (const vm of text.matchAll(/var\(--([\w-]+)/g)) varUses.set(vm[1], (varUses.get(vm[1]) || 0) + 1);
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (DEF_LINE.test(line)) return; // token 定义行不算硬编码用法
    const isUrlLine = /url\(|href\s*=/.test(line);
    if (!isUrlLine) {
      for (const m of line.matchAll(COLOR_RE)) {
        const c = classify(m[0]);
        if (c) bumpOcc('color', c.norm, c.alpha, abs, line.trim().slice(0, 120));
      }
    }
    for (const m of line.matchAll(FONT_CSS_RE)) bumpOcc('size', Number(m[1]), 1, abs, line.trim().slice(0, 120));
    for (const m of line.matchAll(FONT_JS_RE)) bumpOcc('size', Number(m[1]), 1, abs, line.trim().slice(0, 120));
  });
}

// ---------- 距离与映射 ----------
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const colorDist = (a, b) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.round(Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2));
};
const byType = (t) => tokens.filter((x) => x.type === t);

const mapColor = (norm, alpha) => {
  const pool = byType('color');
  if (!pool.length) return { status: '无 token', best: null, second: null, dist: null };
  const ranked = pool.map((t) => ({ t, d: colorDist(norm, t.value) })).sort((a, b) => a.d - b.d || a.t.name.localeCompare(b.t.name));
  const [best, second] = ranked;
  const ambiguous = second && best.d > 0 && second.d - best.d < 4;
  if (best.d === 0 && best.t.alpha === alpha) return { status: '直接替换', best: best.t, second, dist: 0 };
  if (best.d === 0) return { status: '透明度不同', best: best.t, second, dist: 0 };
  if (best.d > opts.near) return { status: '无对应', best: null, second: null, dist: best.d, nearest: best.t };
  if (ambiguous) return { status: '歧义', best: best.t, second, dist: best.d };
  return { status: '近似', best: best.t, second, dist: best.d };
};
const mapSize = (norm) => {
  const pool = byType('size');
  if (!pool.length) return { status: '无 token', best: null, second: null, dist: null };
  const ranked = pool.map((t) => ({ t, d: Math.abs(norm - t.value) })).sort((a, b) => a.d - b.d || a.t.name.localeCompare(b.t.name));
  const [best, second] = ranked;
  const ambiguous = second && best.d > 0 && second.d - best.d < 0.5;
  if (best.d === 0) return { status: '直接替换', best: best.t, second, dist: 0 };
  if (best.d > opts.nearSize) return { status: '不在刻度', best: null, second: null, dist: best.d, nearest: best.t };
  if (ambiguous) return { status: '歧义', best: best.t, second, dist: best.d };
  return { status: '近似', best: best.t, second, dist: best.d };
};

const rows = [...occ.values()]
  .map((o) => ({ ...o, files: o.files.size, map: o.type === 'color' ? mapColor(o.norm, o.alpha) : mapSize(o.norm) }))
  .sort((a, b) => b.count - a.count || String(a.norm).localeCompare(String(b.norm)));

// token 冲突：同一个值多个名字；同一个名字多个值
const conflictSameValue = new Map();
for (const t of tokens) {
  const k = `${t.type}|${t.value}|${t.alpha}`;
  if (!conflictSameValue.has(k)) conflictSameValue.set(k, new Set());
  conflictSameValue.get(k).add(t.name);
}
const sameValueConflicts = [...conflictSameValue].filter(([, names]) => names.size > 1).slice(0, 20);
const nameValues = new Map();
for (const t of tokens) {
  if (!nameValues.has(t.name)) nameValues.set(t.name, new Set());
  nameValues.get(t.name).add(`${t.type === 'color' ? t.value + (t.alpha < 1 ? `@${t.alpha}` : '') : `${t.value}px`}`);
}
const sameNameConflicts = [...nameValues].filter(([, vals]) => vals.size > 1).slice(0, 20);

// 未被引用的 CSS 变量
const unusedTokens = [...new Set(tokens.filter((t) => t.kind === 'css-var' && !varUses.get(t.name.replace(/^--/, ''))).map((t) => t.name))];

const summary = {
  tokens: tokens.length, tokenFiles: tokenFiles.size,
  tokenTypes: { color: byType('color').length, size: byType('size').length },
  scanFiles, occurrences: rows.reduce((s, r) => s + r.count, 0),
  byStatus: rows.reduce((m, r) => m.set(r.map.status, (m.get(r.map.status) || 0) + r.count), new Map()),
};
const needsDecision = rows.filter((r) => ['歧义', '无对应', '不在刻度', '透明度不同', '无 token'].includes(r.map.status));

// ---------- 输出 ----------
const out = [];
out.push(`# token 映射：${rel(SCAN)}`, '');
out.push('## 概况');
out.push(`- token：${summary.tokens} 个（颜色 ${summary.tokenTypes.color} / 尺寸 ${summary.tokenTypes.size}），来自 ${summary.tokenFiles} 个文件`);
out.push(`- 扫描：${summary.scanFiles} 个文件，命中硬编码 ${summary.occurrences} 处（按规范化值去重后 ${rows.length} 条）`);
const st = (k) => summary.byStatus.get(k) || 0;
out.push(`- 直接替换 ${st('直接替换')} 处，近似 ${st('近似')} 处，需人定 ${needsDecision.reduce((s, r) => s + r.count, 0)} 处`);
out.push('');
const table = (head, body) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...body.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const fmtOcc = (r) => (r.type === 'color' ? `${r.norm}${r.alpha < 1 ? ` @${r.alpha}` : ''}` : `${r.norm}px`);
const fmtToken = (t) => (t ? `${t.name}（${t.type === 'color' ? t.value + (t.alpha < 1 ? `@${t.alpha}` : '') : `${t.value}px`}）` : '—');
const colorRows = rows.filter((r) => r.type === 'color');
const sizeRows = rows.filter((r) => r.type === 'size');
if (colorRows.length) {
  out.push('## 颜色映射');
  out.push(table(['硬编码值', '次数', '文件数', '建议 token', '距离', '状态'], colorRows.map((r) => [fmtOcc(r), r.count, r.files, fmtToken(r.map.best || r.map.nearest), r.map.dist ?? '—', r.map.status])));
  out.push('');
}
if (sizeRows.length) {
  out.push('## 字号映射');
  out.push(table(['硬编码值', '次数', '文件数', '建议 token', '距离', '状态'], sizeRows.map((r) => [fmtOcc(r), r.count, r.files, fmtToken(r.map.best || r.map.nearest), r.map.dist ?? '—', r.map.status])));
  out.push('');
}
out.push('## 需要人定的清单');
if (needsDecision.length) {
  out.push(table(['值', '次数', '状态', '最近 token', '说明'], needsDecision.map((r) => [
    fmtOcc(r), r.count, r.map.status, fmtToken(r.map.best || r.map.nearest),
    r.map.status === '歧义' ? `最近两个 token 距离相近：${fmtToken(r.map.best)} / ${fmtToken(r.map.second.t)}` : r.map.status === '透明度不同' ? '色值相同但透明度不同，确认用 token + 透明度档' : '没有可用的 token，需新增或保留',
  ])));
} else out.push('- 没有需要人定的项');
out.push('');
if (sameValueConflicts.length || sameNameConflicts.length) {
  out.push('## token 自身冲突');
  if (sameValueConflicts.length) out.push(`- 同一个值有多个 token 名：${sameValueConflicts.map(([k, names]) => `${k.split('|').join(' ')} → ${[...names].join(' / ')}`).join('；')}`);
  if (sameNameConflicts.length) out.push(`- 同一个 token 名有多个值（覆盖）：${sameNameConflicts.map(([n, v]) => `${n} → ${[...v].join(' / ')}`).join('；')}`);
  out.push('');
}
if (unusedTokens.length) {
  out.push('## 未被引用的 token（CSS 变量，仅统计 --scan 范围）');
  out.push(`- ${unusedTokens.slice(0, 20).join('、')}${unusedTokens.length > 20 ? ` …等 ${unusedTokens.length} 个` : ''}`);
  out.push('');
}
out.push('## 下一步');
out.push('- 「直接替换」的可以写 codemod 批量改，改完跑检查命令和截图比对；「近似」先抽样确认再改。');
out.push('- 「歧义」「无对应」「不在刻度」是标准问题，不是迁移问题：先定 token，再迁移（见 `admin-guardrails` 的 D3）。');
out.push('- 确认后的映射表可以直接变成 `ratchet.mjs` 的规则（硬编码值 → 禁止，替代写法写进报错文案）。');
out.push('- 存量按 `admin-legacy-migration` 的价值排序分批改，不要一次改完。');
console.log(out.join('\n'));

if (opts.json) {
  writeFileSync(resolve(opts.json), JSON.stringify({
    scan: SCAN, summary,
    tokens, rows: rows.map((r) => ({ type: r.type, value: r.norm, alpha: r.alpha, count: r.count, files: r.files, status: r.map.status, token: r.map.best?.name || null, nearest: r.map.nearest?.name || null, distance: r.map.dist })),
    needsDecision: needsDecision.map((r) => ({ value: fmtOcc(r), status: r.map.status, count: r.count })),
    tokenConflicts: { sameValue: sameValueConflicts.map(([k, names]) => ({ value: k, names: [...names] })), sameName: sameNameConflicts.map(([n, v]) => ({ name: n, values: [...v] })) },
    unusedCssVars: unusedTokens,
  }, null, 2) + '\n');
  console.error(`映射已写入 ${resolve(opts.json)}`);
}
