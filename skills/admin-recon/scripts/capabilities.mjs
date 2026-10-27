#!/usr/bin/env node
/**
 * capabilities：按模块列出页面已用接口和数据层方法（Node 18+，无依赖）。
 *
 * 页面接口只来自 extract-desired。认不出 URL 的调用不编进表。
 * 数据层方法只列 services / pipeline / controllers 等文件里的具名函数，
 * 跳过以下划线开头的名字。不从路由 if 分支反推接口。
 *
 * 每条都带 file:line，并且回读源码核对行号落在文件内、该行能对上路径或函数名。
 *
 *   node capabilities.mjs --root <目录> [--out <file.json>] [--md <file.md>]
 *   node capabilities.mjs --root <目录> --check <已提交的.json>
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, dirname, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extractScript = join(here, '..', '..', 'admin-api-contract', 'scripts', 'extract-desired.mjs');
const argv = process.argv.slice(2);
const USAGE = [
  '用法',
  '  node capabilities.mjs --root <目录> [--out <file.json>] [--md <file.md>]',
  '  node capabilities.mjs --root <目录> --check <已提交的.json>',
  '',
  '页面接口来自 extract-desired，每条带 file:line。',
  '数据层方法来自 services、pipeline、controllers 等目录里的具名函数。',
  '没有出处的接口不会出现在结果里。',
].join('\n');

const die = (msg) => { console.error(`✘ ${msg}`); process.exit(2); };
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

function opt(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}

const rootArg = opt('--root');
const outPath = opt('--out');
const mdPath = opt('--md');
const checkPath = opt('--check');
if (!rootArg) die(`缺少 --root\n${USAGE}`);
for (const name of ['--root', '--out', '--md', '--check']) {
  if (argv.includes(name) && (opt(name) == null || String(opt(name)).startsWith('--'))) die(`缺少 ${name} 的值\n${USAGE}`);
}
const ROOT = resolve(rootArg);
if (!existsSync(ROOT)) die(`找不到 ${rootArg}`);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', '.output', '.cache']);
const PAGE_MARKERS = new Set(['pages', 'views', 'routes', 'screens', 'modules']);
const DATA_MARKERS = new Set(['services', 'service', 'pipeline', 'controllers', 'controller', 'data-layer']);
const CODE_EXT = new Set(['.py', '.js', '.mjs', '.cjs', '.ts', '.tsx']);

function posix(abs) {
  return relative(ROOT, abs).split(sep).join('/');
}
function displayRoot(p) {
  const rel = relative(process.cwd(), resolve(p));
  if (rel && !rel.startsWith('..')) return rel.split(sep).join('/');
  return resolve(p).split(sep).join('/');
}
function isDataLayer(rel) {
  const norm = rel.split(sep).join('/');
  if (/(^|\/)(mocks?|__mocks__|fixtures|tests?|__tests__|specs?)(\/|$)/i.test(norm)) return false;
  if ([...DATA_MARKERS].some((name) => new RegExp(`(^|/)${name}(/|$)`, 'i').test(norm))) return true;
  return /(^|\/)[^/]*(-api|Api|client|Client)\.(js|mjs|cjs|ts|tsx)$/.test(norm);
}
function moduleOf(file) {
  const parts = file.split('/');
  for (let i = 0; i < parts.length - 1; i++) {
    if (PAGE_MARKERS.has(parts[i].toLowerCase())) return parts[i + 1].replace(/\.[^.]+$/, '');
  }
  for (let i = 0; i < parts.length - 1; i++) {
    if (DATA_MARKERS.has(parts[i].toLowerCase())) {
      const next = parts[i + 1];
      if (i + 1 === parts.length - 1) return next.replace(/\.[^.]+$/, '');
      return next;
    }
  }
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0].replace(/\.[^.]+$/, '');
}
function resourceOf(path) {
  const segs = String(path).split('/').filter(Boolean)
    .filter((s) => !['api', 'v1', 'v2', 'v3'].includes(s) && !s.startsWith('{'));
  return segs[0] || '';
}
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
    } else out.push(join(dir, entry.name));
  }
  return out;
}
function linesOf(abs) {
  return readFileSync(abs, 'utf8').split(/\n/);
}
function fail(msg) {
  console.error(`✘ ${msg}`);
  process.exit(1);
}
function assertCall(row) {
  const abs = join(ROOT, row.file);
  if (!existsSync(abs)) fail(`出处文件不存在：${row.file}`);
  const lines = linesOf(abs);
  const start = row.lineStart;
  const end = row.lineEnd || row.lineStart;
  if (start < 1 || end > lines.length || end < start) {
    fail(`${row.file}:${start} 超出文件行数 ${lines.length}（${row.method} ${row.path}）`);
  }
  const window = lines.slice(start - 1, end).join('\n');
  const staticPrefix = row.path.split('{')[0];
  const head = staticPrefix.length > 1 ? staticPrefix.replace(/\/$/, '') : staticPrefix;
  const needle = head.slice(0, Math.min(head.length, 24));
  if (!window.includes(needle)) {
    fail(`${row.file}:${start} 对不上路径 ${row.path}：${window.trim().slice(0, 120)}`);
  }
}
function assertMethod(row) {
  const abs = join(ROOT, row.file);
  if (!existsSync(abs)) fail(`出处文件不存在：${row.file}`);
  const lines = linesOf(abs);
  if (row.lineStart < 1 || row.lineStart > lines.length) {
    fail(`${row.file}:${row.lineStart} 超出文件行数 ${lines.length}（${row.name}）`);
  }
  const leaf = row.name.split('.').pop();
  const line = lines[row.lineStart - 1];
  if (!line.includes(leaf)) fail(`${row.file}:${row.lineStart} 对不上方法 ${row.name}：${line.trim()}`);
}
function scanPy(text, rel) {
  const lines = text.split(/\n/);
  let cls = null;
  let clsIndent = -1;
  const out = [];
  lines.forEach((line, i) => {
    const classMatch = /^(\s*)class\s+([A-Za-z_][\w]*)\b/.exec(line);
    if (classMatch && !line.trim().startsWith('#')) {
      cls = classMatch[2];
      clsIndent = classMatch[1].length;
      return;
    }
    const defMatch = /^(\s*)def\s+([A-Za-z_][\w]*)\s*\(/.exec(line);
    if (!defMatch) return;
    const indent = defMatch[1].length;
    if (cls && indent <= clsIndent) cls = null;
    const name = defMatch[2];
    if (name.startsWith('_')) return;
    const qualified = cls && indent > clsIndent ? `${cls}.${name}` : name;
    out.push({
      name: qualified,
      file: rel,
      lineStart: i + 1,
      kind: cls && indent > clsIndent ? 'method' : 'function',
    });
  });
  return out;
}
function scanJs(text, rel) {
  const lines = text.split(/\n/);
  const out = [];
  lines.forEach((line, i) => {
    const fn = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line.trim())
      ? /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line)
      : /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/.exec(line);
    if (!fn) return;
    if (fn[1].startsWith('_')) return;
    out.push({ name: fn[1], file: rel, lineStart: i + 1, kind: 'function' });
  });
  return out;
}

const tmp = mkdtempSync(join(tmpdir(), 'recon-cap-'));
const desiredPath = join(tmp, 'desired.ir.json');
const extracted = spawnSync(process.execPath, [
  extractScript, '--root', ROOT, '--out', desiredPath,
], { encoding: 'utf8' });
if (extracted.status !== 0) {
  process.stderr.write(extracted.stderr || '');
  process.exit(extracted.status || 1);
}
const desired = JSON.parse(readFileSync(desiredPath, 'utf8'));
rmSync(tmp, { recursive: true, force: true });

const buckets = new Map();
function bucket(name) {
  if (!buckets.has(name)) {
    buckets.set(name, { module: name, pageCalls: [], dataLayerCalls: [], dataLayerMethods: [] });
  }
  return buckets.get(name);
}

for (const op of desired.operations || []) {
  for (const src of op.sources || []) {
    const row = {
      id: op.id,
      method: op.method,
      path: op.path,
      resource: resourceOf(op.path),
      file: src.file,
      lineStart: src.lineStart,
      lineEnd: src.lineEnd || null,
      symbol: src.symbol || null,
      confidence: op.confidence || null,
    };
    assertCall(row);
    const target = isDataLayer(src.file) ? 'dataLayerCalls' : 'pageCalls';
    bucket(moduleOf(src.file))[target].push(row);
  }
}

for (const abs of walk(ROOT)) {
  const rel = posix(abs);
  if (!rel || rel.startsWith('..')) continue;
  if (!isDataLayer(rel)) continue;
  const ext = extname(abs).toLowerCase();
  if (!CODE_EXT.has(ext)) continue;
  const text = readFileSync(abs, 'utf8');
  const methods = ext === '.py' ? scanPy(text, rel) : scanJs(text, rel);
  for (const method of methods) {
    assertMethod(method);
    bucket(moduleOf(rel)).dataLayerMethods.push(method);
  }
}

const byRow = (a, b) => a.file.localeCompare(b.file) || a.lineStart - b.lineStart || String(a.method || a.name).localeCompare(String(b.method || b.name)) || String(a.path || '').localeCompare(String(b.path || ''));
const modules = [...buckets.values()]
  .map((mod) => ({
    module: mod.module,
    pageCalls: mod.pageCalls.sort(byRow),
    dataLayerCalls: mod.dataLayerCalls.sort(byRow),
    dataLayerMethods: mod.dataLayerMethods.sort(byRow),
  }))
  .filter((mod) => mod.pageCalls.length || mod.dataLayerCalls.length || mod.dataLayerMethods.length)
  .sort((a, b) => a.module.localeCompare(b.module));

const doc = {
  version: '1',
  generator: 'admin-recon-capabilities',
  root: displayRoot(rootArg),
  notes: [
    '页面接口只来自 extract-desired。认不出 URL 的调用不在表里。',
    '数据层方法是 services / pipeline / controllers 等文件里不以 _ 开头的具名函数。不从路由分支反推接口。',
    '.vue 单文件组件里的方法定义本模式不扫。页面里的调用仍然来自 extract-desired。',
    '没有 pages/<模块>/ 时，模块名取页面文件的父目录，或数据层文件名。路径资源是路径上的第一个静态段，不是业务模块名。',
  ],
  counts: {
    modules: modules.length,
    pageCalls: modules.reduce((n, mod) => n + mod.pageCalls.length, 0),
    dataLayerCalls: modules.reduce((n, mod) => n + mod.dataLayerCalls.length, 0),
    dataLayerMethods: modules.reduce((n, mod) => n + mod.dataLayerMethods.length, 0),
  },
  modules,
};

const jsonText = `${JSON.stringify(doc, null, 2)}\n`;

function cell(value) {
  return value == null || value === '' ? '' : String(value).replace(/\|/g, '\\|');
}
function callTable(rows) {
  if (!rows.length) return '（无）\n';
  const head = '| 方法 | 路径 | 路径资源 | 出处 | 符号 | 置信度 |';
  const sep = '|---|---|---|---|---|---|';
  const body = rows.map((row) => `| ${cell(row.method)} | \`${cell(row.path)}\` | ${cell(row.resource)} | \`${cell(row.file)}:${cell(row.lineStart)}\` | ${cell(row.symbol)} | ${cell(row.confidence)} |`);
  return `${[head, sep, ...body].join('\n')}\n`;
}
function methodTable(rows) {
  if (!rows.length) return '（无）\n';
  const head = '| 方法 | 出处 | 种类 |';
  const sep = '|---|---|---|';
  const body = rows.map((row) => `| \`${cell(row.name)}\` | \`${cell(row.file)}:${cell(row.lineStart)}\` | ${cell(row.kind)} |`);
  return `${[head, sep, ...body].join('\n')}\n`;
}
function toMarkdown(data) {
  const lines = [
    '# 能力盘点（带出处）',
    '',
    `扫描根：\`${data.root}\``,
    '',
    '```bash',
    `node skills/admin-recon/scripts/capabilities.mjs --root ${data.root} --out /tmp/recon-capabilities.json --md /tmp/recon-capabilities.md`,
    '```',
    '',
    ...data.notes.map((note) => `- ${note}`),
    '',
    `模块 ${data.counts.modules} 个。页面调用 ${data.counts.pageCalls} 条，数据层调用 ${data.counts.dataLayerCalls} 条，数据层方法 ${data.counts.dataLayerMethods} 个。`,
    '',
  ];
  for (const mod of data.modules) {
    lines.push(`## 模块 \`${mod.module}\``, '');
    lines.push('### 页面已用接口', '', callTable(mod.pageCalls));
    lines.push('### 数据层里的调用', '', callTable(mod.dataLayerCalls));
    lines.push('### 数据层方法', '', methodTable(mod.dataLayerMethods));
  }
  return `${lines.join('\n')}`;
}
const mdText = toMarkdown(doc);

if (checkPath) {
  if (!existsSync(checkPath)) die(`找不到 ${checkPath}`);
  const expected = readFileSync(checkPath, 'utf8');
  if (expected !== jsonText) {
    console.error(`能力盘点与 ${checkPath} 不一致。用同一条 --root 重新 --out 后再对。`);
    process.exit(1);
  }
  console.log(`checked ${checkPath}`);
}

if (outPath) {
  mkdirSync(dirname(resolve(outPath)), { recursive: true });
  writeFileSync(resolve(outPath), jsonText);
  console.log(resolve(outPath));
}
if (mdPath) {
  mkdirSync(dirname(resolve(mdPath)), { recursive: true });
  writeFileSync(resolve(mdPath), mdText);
  console.log(resolve(mdPath));
}
if (!outPath && !mdPath && !checkPath) process.stdout.write(jsonText);
