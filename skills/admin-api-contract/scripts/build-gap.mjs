#!/usr/bin/env node
/**
 * build-gap：期望 IR 对照实际能力，写出差距表（Node 18+，无依赖）。
 *
 * --actual 接受 OpenAPI 3 JSON，或 actual-capabilities IR JSON。
 * 不解析 YAML。对齐键是方法 + 规范化路径。
 * status：match（响应字段集合相同）、reshape（路径相同字段不同）、missing（期望有、实际没有）。
 * disposition 与 exposure 固定写 null，等人工门禁。
 *
 * 用法
 *   node build-gap.mjs --desired <desired.ir.json> --actual <openapi.json|actual.ir.json> [--out gap.ir.json]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';

const argv = process.argv.slice(2);
const USAGE = [
  '用法',
  '  node build-gap.mjs --desired <desired.ir.json> --actual <openapi.json|actual.ir.json> [--out gap.ir.json]',
  '',
  '实际能力用 OpenAPI 3 JSON，或 actual IR JSON。YAML 不解析，请先存成 .openapi.json。',
  '差距表只覆盖期望里的操作；disposition 先写 null。',
].join('\n');

const die = (msg) => { console.error(`✘ ${msg}`); process.exit(2); };
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

let desiredPath = null;
let actualPath = null;
let out = 'gap.ir.json';
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--desired') desiredPath = argv[++i];
  else if (a === '--actual') actualPath = argv[++i];
  else if (a === '--out') out = argv[++i];
  else die(`未知参数 ${a}\n${USAGE}`);
  if (['--desired', '--actual', '--out'].includes(a) && (argv[i] == null || String(argv[i]).startsWith('--'))) {
    die(`缺少 ${a} 的值\n${USAGE}`);
  }
}
if (!desiredPath || !actualPath) die(`缺少 --desired 或 --actual\n${USAGE}`);
if (!existsSync(desiredPath)) die(`找不到 ${desiredPath}`);
if (!existsSync(actualPath)) die(`找不到 ${actualPath}`);

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const KEEP_SINGULAR = new Set(['status', 'address', 'business', 'series', 'species', 'news', 'stats']);

function readJson(file) {
  if (/\.ya?ml$/i.test(file)) {
    die('不解析 YAML（无第三方依赖）。请改用 OpenAPI JSON（.openapi.json）或 actual IR JSON。样例里的 actual.openapi.yaml 只是对照，脚本读 actual.openapi.json。');
  }
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (e) { die(`读不了 ${file}：${e.message}`); }
  try { return { text, json: JSON.parse(text) }; }
  catch (e) { die(`${file} 不是合法 JSON：${e.message}。OpenAPI 请用 JSON，不要用 YAML。`); }
}

function lineStartsOf(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}
function indexToLine(starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}
function readString(s, i) {
  const q = s[i];
  let j = i + 1;
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s[j] === q) return j + 1;
    j++;
  }
  return s.length;
}
function balancedEnd(s, openIdx) {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const close = pairs[s[openIdx]];
  let depth = 0;
  let i = openIdx;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') { i = readString(s, i); continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0 && c === close) return i;
    }
    i++;
  }
  return s.length - 1;
}
function sourceFile(file) {
  const abs = resolve(file);
  const rel = relative(process.cwd(), abs);
  if (rel && !rel.startsWith('..') && !rel.startsWith(`..${sep}`)) return rel.split(sep).join('/');
  return abs.split(sep).join('/');
}
function normalizePath(raw) {
  let p = String(raw).trim();
  const qIdx = p.indexOf('?');
  if (qIdx >= 0) p = p.slice(0, qIdx);
  p = p.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  p = p.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, '{$1}');
  p = p.replace(/\$\{[^}]*\}/g, '{param}');
  p = p.replace(/\/:([A-Za-z_$][\w$]*)/g, '/{$1}');
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}
function singular(word) {
  if (KEEP_SINGULAR.has(word)) return word;
  if (word.endsWith('ies') && word.length > 3) return `${word.slice(0, -3)}y`;
  if (/(ses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 1) return word.slice(0, -1);
  return word;
}
function pascal(s) {
  return s.split(/[-_]/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}
function operationId(method, path) {
  const segs = path.split('/').filter(Boolean).filter((s) => !['api', 'v1', 'v2', 'v3'].includes(s));
  const lastIsParam = segs.length > 0 && /^\{.+\}$/.test(segs[segs.length - 1]);
  const staticSegs = segs.filter((s) => !/^\{.+\}$/.test(s));
  const nameSegs = lastIsParam
    ? staticSegs.map((s, i) => (i === staticSegs.length - 1 ? singular(s) : s))
    : staticSegs.slice();
  const m = method.toUpperCase();
  if (!lastIsParam && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m) && nameSegs.length) {
    nameSegs[nameSegs.length - 1] = singular(nameSegs[nameSegs.length - 1]);
  }
  const resource = nameSegs.map(pascal).join('') || 'Root';
  const verb = m === 'GET' ? (lastIsParam ? 'get' : 'list')
    : m === 'POST' ? 'create'
      : m === 'PUT' || m === 'PATCH' ? 'update'
        : m === 'DELETE' ? 'delete'
          : m.toLowerCase();
  return verb + resource;
}
function locateMethod(text, path, method) {
  const starts = lineStartsOf(text);
  const pathsIdx = text.indexOf('"paths"');
  const pathIdx = text.indexOf(`"${path}"`, pathsIdx >= 0 ? pathsIdx : 0);
  if (pathIdx < 0) return 1;
  const brace = text.indexOf('{', pathIdx + path.length + 2);
  if (brace < 0) return indexToLine(starts, pathIdx);
  const end = balancedEnd(text, brace);
  const block = text.slice(brace, end + 1);
  const m = new RegExp(`"${method}"\\s*:`).exec(block);
  return indexToLine(starts, m ? brace + m.index : pathIdx);
}
function resolveRef(doc, schema, seen = new Set()) {
  if (!schema || typeof schema !== 'object') return schema;
  if (typeof schema.$ref === 'string' && schema.$ref.startsWith('#/')) {
    if (seen.has(schema.$ref)) return {};
    seen.add(schema.$ref);
    let cur = doc;
    for (const part of schema.$ref.slice(2).split('/')) {
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
      if (!cur || typeof cur !== 'object') return {};
      cur = cur[key];
    }
    return resolveRef(doc, cur, seen);
  }
  return schema;
}
function responseFields(schema, doc) {
  const s = resolveRef(doc, schema);
  if (!s || typeof s !== 'object') return [];
  if (s.items) return responseFields(s.items, doc);
  if (Array.isArray(s.allOf)) {
    const set = new Set();
    for (const part of s.allOf) for (const f of responseFields(part, doc)) set.add(f);
    return [...set].sort();
  }
  if (s.properties && typeof s.properties === 'object') {
    const props = s.properties;
    for (const key of ['data', 'result', 'payload']) {
      if (props[key] && (props[key].properties || props[key].items || props[key].$ref)) {
        const inner = responseFields(props[key], doc);
        if (inner.length) return inner;
      }
    }
    for (const key of ['list', 'items', 'records', 'rows']) {
      if (props[key]) {
        const inner = responseFields(props[key], doc);
        if (inner.length) return inner;
      }
    }
    return Object.keys(props).sort();
  }
  return [];
}
function pickSchema(op) {
  const responses = op && op.responses;
  if (!responses || typeof responses !== 'object') return null;
  const codes = Object.keys(responses).sort((a, b) => {
    const score = (c) => (String(c).startsWith('2') ? 0 : c === 'default' ? 2 : 1);
    return score(a) - score(b) || String(a).localeCompare(String(b));
  });
  for (const code of codes) {
    const content = responses[code] && responses[code].content;
    if (!content || typeof content !== 'object') continue;
    const media = content['application/json']
      || content['application/json; charset=utf-8']
      || Object.values(content)[0];
    if (media && media.schema) return media.schema;
  }
  return null;
}
function fromOpenApi(doc, text, file) {
  if (!doc.paths || typeof doc.paths !== 'object') die(`${file} 没有 OpenAPI paths`);
  const fileRel = sourceFile(file);
  const ops = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    if (!item || typeof item !== 'object') continue;
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
      const op = item[method];
      if (!op || typeof op !== 'object') continue;
      const upper = method.toUpperCase();
      const norm = normalizePath(path);
      const id = typeof op.operationId === 'string' && op.operationId.trim()
        ? op.operationId.trim()
        : operationId(upper, norm);
      ops.push({
        id,
        method: upper,
        path: norm,
        fields: responseFields(pickSchema(op), doc),
        sources: [{ file: fileRel, lineStart: locateMethod(text, path, method) }],
      });
    }
  }
  return ops;
}
function fromActualIr(doc, file) {
  if (!Array.isArray(doc.operations)) die(`${file} 不是 actual IR：缺少 operations`);
  return doc.operations.map((op, i) => {
    if (!op || typeof op !== 'object') die(`${file} 第 ${i + 1} 条不是对象`);
    const method = String(op.method || '').toUpperCase();
    if (!op.id || !METHODS.has(method) || !op.path) die(`${file} 第 ${i + 1} 条缺 id、method 或 path`);
    if (!Array.isArray(op.sources) || op.sources.length === 0) die(`${file} 的 ${op.id} 没有 sources，拒绝无出处的能力`);
    for (const src of op.sources) {
      if (!src || !src.file || !(src.lineStart >= 1)) die(`${file} 的 ${op.id} 有不完整的 sources`);
    }
    const fields = op.response && Array.isArray(op.response.fields) ? op.response.fields.map(String) : [];
    return { id: String(op.id), method, path: normalizePath(op.path), fields: [...fields].sort(), sources: op.sources };
  });
}
function loadActual(file) {
  const { text, json } = readJson(file);
  if (!json || typeof json !== 'object' || Array.isArray(json)) die(`${file} 的顶层必须是对象`);
  if (json.paths) return fromOpenApi(json, text, file);
  if (Array.isArray(json.operations)) return fromActualIr(json, file);
  die(`${file} 既不是 OpenAPI JSON（含 paths）也不是 actual IR（含 operations）`);
}
function sameFields(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function notesFor(status, method, path, desiredFields, actualFields) {
  if (status === 'missing') return `实际能力中没有 ${method} ${path}`;
  if (status === 'match') return '响应字段一致';
  const onlyDesired = desiredFields.filter((f) => !actualFields.includes(f));
  const onlyActual = actualFields.filter((f) => !desiredFields.includes(f));
  const parts = ['响应字段不一致'];
  if (onlyDesired.length) parts.push(`期望有而实际无：${onlyDesired.join(', ')}`);
  if (onlyActual.length) parts.push(`实际有而期望无：${onlyActual.join(', ')}`);
  return parts.join('；');
}

const desiredDoc = readJson(desiredPath).json;
if (!desiredDoc || !Array.isArray(desiredDoc.operations)) die(`${desiredPath} 不是 desired IR：缺少 operations`);
const actualOps = loadActual(actualPath);
const actualByKey = new Map();
for (const op of actualOps) actualByKey.set(`${op.method} ${op.path}`, op);

const items = desiredDoc.operations.map((op) => {
  const method = String(op.method || '').toUpperCase();
  const path = normalizePath(op.path || '');
  if (!op.id || !METHODS.has(method) || !path.startsWith('/')) die(`desired 操作不完整：${JSON.stringify(op && op.id)}`);
  const desiredFields = op.response && Array.isArray(op.response.fields) ? [...op.response.fields].map(String).sort() : [];
  const actual = actualByKey.get(`${method} ${path}`);
  if (!actual) {
    return {
      desiredId: String(op.id),
      actualId: null,
      method,
      path,
      status: 'missing',
      notes: notesFor('missing', method, path, desiredFields, []),
      disposition: null,
      exposure: null,
    };
  }
  const actualFields = [...actual.fields].sort();
  const status = sameFields(desiredFields, actualFields) ? 'match' : 'reshape';
  return {
    desiredId: String(op.id),
    actualId: actual.id,
    method,
    path,
    status,
    notes: notesFor(status, method, path, desiredFields, actualFields),
    disposition: null,
    exposure: null,
  };
});

const counts = items.reduce((m, item) => { m[item.status] = (m[item.status] || 0) + 1; return m; }, {});
const doc = {
  version: '1',
  generatedAt: new Date().toISOString(),
  generator: 'build-gap',
  items,
};
const OUT = resolve(out);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`);
console.log(OUT);
console.error(`match ${counts.match || 0}，reshape ${counts.reshape || 0}，missing ${counts.missing || 0}`);
