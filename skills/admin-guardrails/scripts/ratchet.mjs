#!/usr/bin/env node
/**
 * ratchet：存量违规「只减不增」的规则检查器（技术栈无关，只依赖 Node 18+）。
 *
 * 做法：规则写在 JSON 配置里（文件 glob + 正则）。首次 --update-baseline 把存量记成基线；
 * 之后每次检查：某文件某规则比基线多 → 失败（新代码必须合规）；比基线少 → 也失败并提示收紧基线（迁一处降一处）。
 * 基线只许降：--update-baseline 遇到比旧基线多的条目会拒绝写入（修代码，不要重写基线）；
 * 新增规则、接入新目录这类确需放宽的，用 --allow-increase，并在提交说明里写明原因。
 * 确属例外，在该行或上一行加注释 `lint-allow: <标签> <原因>`（标签默认是规则 id，可用 allow 字段改）。
 * 原因必填：只有标签、没有原因的注释不算豁免（配置顶层 requireReason:false 可关闭）。
 * JSX 子节点里写成 {/* lint-allow: 标签 原因 *\/}，写 // 会被渲染成页面文字。
 *
 * 用法
 *   node ratchet.mjs --config <配置> [--root <仓库根，默认当前目录>]            检查
 *   node ratchet.mjs --config <配置> --update-baseline [--allow-increase]     写基线（默认拒绝增加）
 *   node ratchet.mjs --config <配置> --report [--json <文件>]                 只统计（含例外注释数），不比较基线，退出码 0
 *
 * 配置（JSON）
 *   baseline  基线文件，相对 root，默认 ratchet-baseline.json
 *   requireReason  lint-allow 是否必须写原因，默认 true
 *   rules[]   id、message、globs[]、pattern，可选：
 *             flags 正则标志；exclude 命中就跳过该行；ignore[] 排除的 glob；allow 放行标签；
 *             count "line"（默认，一行最多算 1 处）| "match"（一行里每个匹配算 1 处）；
 *             stripComments "line"（按行去掉 // 注释和单行块注释）| "text"（整文件去注释，识别多行块注释）。
 *   glob 支持 ** * ? 和单层 {a,b}。
 *
 * 局限：基于正则的逐行匹配，是近似检查。需要精确（跨行、语法感知）的规则请用 ESLint / stylelint 的 AST 规则。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const die = (msg) => { console.error(`✘ ${msg}`); process.exit(2); };

const configPath = opt('--config');
if (!configPath) die('缺少 --config <配置文件>');
if (!existsSync(configPath)) die(`找不到配置文件 ${configPath}`);
const ROOT = resolve(opt('--root') || process.cwd());
let config;
try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch (e) { die(`配置不是合法 JSON：${e.message}`); }
if (!Array.isArray(config.rules) || !config.rules.length) die('配置里没有 rules');
const BASELINE = join(ROOT, config.baseline || 'ratchet-baseline.json');

// ---------- glob ----------
const esc = (s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
function globToRe(g) {
  let re = '';
  for (let i = 0; i < g.length; ) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 3; } else { re += '.*'; i += 2; }
    } else if (c === '*') { re += '[^/]*'; i++; }
    else if (c === '?') { re += '[^/]'; i++; }
    else if (c === '{') {
      const j = g.indexOf('}', i);
      if (j < 0) die(`glob 里的 { 没有配对：${g}`);
      re += `(?:${g.slice(i + 1, j).split(',').map(esc).join('|')})`;
      i = j + 1;
    } else { re += esc(c); i++; }
  }
  return new RegExp(`^${re}$`);
}

// ---------- 规则 ----------
const requireReason = config.requireReason !== false;
const rules = config.rules.map((r) => {
  for (const k of ['id', 'globs', 'pattern']) if (!r[k]) die(`规则缺少 ${k}：${JSON.stringify(r).slice(0, 80)}`);
  const flags = r.flags || '';
  try {
    return {
      ...r,
      _globs: r.globs.map(globToRe),
      _ignore: (r.ignore || []).map(globToRe),
      _re: new RegExp(r.pattern, flags.replace('g', '')),
      _reG: new RegExp(r.pattern, flags.includes('g') ? flags : `${flags}g`),
      _exclude: r.exclude ? new RegExp(r.exclude) : null,
      _allowAny: new RegExp(`lint-allow:\\s*${esc(r.allow || r.id)}`),
      _allow: new RegExp(`lint-allow:\\s*${esc(r.allow || r.id)}${requireReason ? '\\s+(?!\\*\\/|-->)\\S' : ''}`),
    };
  } catch (e) { return die(`规则 ${r.id} 的正则无效：${e.message}`); }
});

// ---------- 扫描 ----------
const SKIP_DIRS = new Set(['node_modules', '.git']);
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out); }
    else out.push(join(dir, e.name));
  }
  return out;
};
const blank = (m) => m.replace(/[^\n]/g, ' ');
const stripText = (t) => t.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/[^\n]*/g, (m, a) => a);
const stripLine = (l) => l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');

const found = {}; // 文件 -> 规则 -> { n, lines[], bare }
const exempt = {}; // 规则 -> lint-allow 注释出现的行数（含没写原因的）
const record = (rel, id, n, ln, bare) => {
  const slot = ((found[rel] ||= {})[id] ||= { n: 0, lines: [], bare: false });
  slot.n += n;
  slot.lines.push(ln);
  slot.bare ||= bare;
};

for (const abs of walk(ROOT)) {
  const rel = relative(ROOT, abs).split(sep).join('/');
  const applicable = rules.filter((r) => r._globs.some((g) => g.test(rel)) && !r._ignore.some((g) => g.test(rel)));
  if (!applicable.length) continue;
  let raw;
  try { raw = readFileSync(abs, 'utf8'); } catch { continue; }
  const rawLines = raw.split('\n');
  const textLines = applicable.some((r) => r.stripComments === 'text') ? stripText(raw).split('\n') : null;
  rawLines.forEach((rawLine, i) => {
    const prev = rawLines[i - 1] || '';
    for (const r of applicable) {
      if (r._allowAny.test(rawLine)) exempt[r.id] = (exempt[r.id] || 0) + 1;
      if (r._allow.test(rawLine) || r._allow.test(prev)) continue;
      const line = r.stripComments === 'text' ? textLines[i] : r.stripComments ? stripLine(rawLine) : rawLine;
      if (r._exclude && r._exclude.test(line)) continue;
      const n = r.count === 'match' ? [...line.matchAll(r._reG)].length : r._re.test(line) ? 1 : 0;
      if (n) record(rel, r.id, n, i + 1, r._allowAny.test(rawLine) || r._allowAny.test(prev));
    }
  });
}

const counts = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)).map(([f, byRule]) => [f, Object.fromEntries(Object.entries(byRule).map(([id, v]) => [id, v.n]))]));
const totals = Object.fromEntries(rules.map((r) => [r.id, { message: r.message || '', total: 0, files: 0 }]));
for (const byRule of Object.values(counts)) for (const [id, n] of Object.entries(byRule)) { totals[id].total += n; totals[id].files++; }
const grand = Object.values(totals).reduce((s, t) => s + t.total, 0);

// ---------- 模式 ----------
if (has('--report')) {
  console.log(['规则', '含义', '处数', '文件数', '例外注释数'].join('\t'));
  for (const [id, t] of Object.entries(totals)) console.log([id, t.message, t.total, t.files, exempt[id] || 0].join('\t'));
  const top = Object.entries(counts).map(([f, b]) => [f, Object.values(b).reduce((s, n) => s + n, 0)]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length) console.log(`\n违规最多的文件：\n${top.map(([f, n]) => `  ${n}\t${f}`).join('\n')}`);
  if (opt('--json')) writeFileSync(resolve(opt('--json')), JSON.stringify({ totals, exemptions: exempt, files: counts }, null, 2) + '\n');
  process.exit(0);
}

if (has('--update-baseline')) {
  // 基线只许降：比旧基线多的条目说明引入了新违规，拒绝写入，除非明确 --allow-increase
  const old = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
  const up = [];
  if (old) {
    for (const [file, byRule] of Object.entries(counts)) {
      for (const [id, n] of Object.entries(byRule)) if (n > (old[file]?.[id] || 0)) up.push(`  ${file}  ${id}: ${n} 处（基线 ${old[file]?.[id] || 0}）`);
    }
  }
  if (up.length && !has('--allow-increase')) {
    console.error('✘ 拒绝写入：下面这些条目比现有基线多，说明引入了新违规。基线只许降，请修代码，不要重写基线：');
    up.slice(0, 20).forEach((l) => console.error(l));
    if (up.length > 20) console.error(`  …另有 ${up.length - 20} 条`);
    console.error('\n确需放宽（新增规则、接入新目录等），加 --allow-increase，并在提交说明里写明原因。');
    process.exit(1);
  }
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n');
  console.log(`基线已写入 ${relative(ROOT, BASELINE)}：${Object.keys(counts).length} 个文件，共 ${grand} 处${up.length ? `（--allow-increase 放宽了 ${up.length} 条）` : ''}`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
if (!existsSync(BASELINE)) console.error(`（没有基线文件 ${relative(ROOT, BASELINE)}，按空基线检查：所有违规都算新增）`);
const errors = [];
const stale = [];
const failedRules = new Set();
for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
  for (const r of rules) {
    const now = counts[file]?.[r.id] || 0;
    const base = baseline[file]?.[r.id] || 0;
    if (now > base) {
      failedRules.add(r.id);
      errors.push(`✘ ${file}  ${r.id}: ${now} 处（基线 ${base}）  命中行(前 8 个) ${found[file][r.id].lines.slice(0, 8).join(', ')}${found[file][r.id].bare ? '  ⚠ 有 lint-allow 但没写原因，不算豁免' : ''}`);
    } else if (now < base) stale.push(`✔ ${file}  ${r.id}: ${now} 处（基线 ${base}）`);
  }
}
if (errors.length || stale.length) {
  errors.forEach((e) => console.error(e));
  for (const id of failedRules) console.error(`\n${id}  ${totals[id].message}`);
  stale.forEach((s) => console.error(s));
  if (stale.length) console.error('\n违规已减少，请收紧基线：node ratchet.mjs --config <配置> --update-baseline');
  process.exit(1);
}
const baseTotal = Object.values(baseline).reduce((s, o) => s + Object.values(o).reduce((a, b) => a + b, 0), 0);
console.log(`✔ ratchet 通过（存量 ${baseTotal} 处，新增 0）`);
