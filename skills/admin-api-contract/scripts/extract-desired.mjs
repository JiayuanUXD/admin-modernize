#!/usr/bin/env node
/**
 * extract-desired：从页面调用点抽出期望契约草稿（Node 18+，无依赖）。
 *
 * 认 axios / fetch / $.ajax，以及薄封装 get / delete、post / put / patch、
 * api(方法字面量, url, body?)。URL 必须是字符串、模板字符串，或以路径字面量开头的拼接。
 * 认不出 URL 的调用直接跳过，不编接口。拼接里夹了三元表达式时也整段跳过。
 * 每条操作都带 file:line。
 * 字面量 URL 的 confidence 是 medium，模板或拼接是 low。high 留给人工。
 *
 * 用法
 *   node extract-desired.mjs --root <目录> [--out desired.ir.json]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, relative, dirname, sep, extname } from 'node:path';

const argv = process.argv.slice(2);
const USAGE = [
  '用法',
  '  node extract-desired.mjs --root <目录> [--out desired.ir.json]',
  '',
  '递归扫描 .js/.jsx/.ts/.tsx/.vue（跳过 node_modules、dist、build、.git）。',
  '抽出 axios / fetch / $.ajax，以及薄封装 get/post/api（名单见 THIN_CALLS / THIN_API）。',
  'URL 认字符串、模板，以及以路径字面量开头的拼接。认不出的调用跳过，不编接口。',
].join('\n');

const die = (msg) => { console.error(`✘ ${msg}`); process.exit(2); };
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

let root = null;
let out = 'desired.ir.json';
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--root') root = argv[++i];
  else if (a === '--out') out = argv[++i];
  else die(`未知参数 ${a}\n${USAGE}`);
  if ((a === '--root' || a === '--out') && (out == null || root === undefined || argv[i] == null || String(argv[i]).startsWith('--'))) {
    die(`缺少 ${a} 的值\n${USAGE}`);
  }
}
if (!root) die(`缺少 --root <目录>\n${USAGE}`);
const ROOT = resolve(root);
if (!existsSync(ROOT) || !statSync(ROOT).isDirectory()) die(`${root} 不是目录`);
const OUT = resolve(out);

const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
// 薄封装默认名单。同形态的别名加在这里：键是调用名，值是 HTTP 方法。
// get(url) / delete(url) 没有请求体；post/put/patch 的第二参是请求体。
// api 形单独一条：api('GET'|…, url, body?)，方法必须是字符串字面量。
// 参数位置不同的新形态要在 scanFile 里加分支，不要靠猜 URL。
const THIN_CALLS = {
  get: 'GET',
  delete: 'DELETE',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
};
const THIN_API = ['api'];
const THIN_BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const THIN_ALT = [...Object.keys(THIN_CALLS), ...THIN_API].join('|');
const WRAP = new Set(['list', 'items', 'records', 'rows', 'result', 'payload', 'data']);
const SKIP_FIELD = new Set(['map', 'filter', 'forEach', 'then', 'catch', 'json', 'length', 'push', 'concat', 'toString', 'finally']);
const KEEP_SINGULAR = new Set(['status', 'address', 'business', 'series', 'species', 'news', 'stats']);

const read = (abs) => { try { return readFileSync(abs, 'utf8'); } catch { return ''; } };
const skipWs = (s, i) => { while (i < s.length && /\s/.test(s[i])) i++; return i; };

function walk(dir, outFiles = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return outFiles; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), outFiles);
    } else if (CODE_EXT.has(extname(e.name))) outFiles.push(join(dir, e.name));
  }
  return outFiles;
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

function commentRanges(text) {
  const ranges = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '/' && n === '/') {
      const start = i;
      i += 2;
      while (i < text.length && text[i] !== '\n') i++;
      ranges.push([start, i]);
    } else if (c === '/' && n === '*') {
      const start = i;
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i = Math.min(text.length, i + 2);
      ranges.push([start, i]);
    } else if (c === '"' || c === "'" || c === '`') {
      i = readString(text, i).end;
    } else i++;
  }
  return ranges;
}
function inRanges(ranges, index) {
  for (const [a, b] of ranges) if (index >= a && index < b) return true;
  return false;
}

function readString(s, i) {
  const q = s[i];
  let j = i + 1;
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue; }
    if (q === '`' && s[j] === '$' && s[j + 1] === '{') {
      j += 2;
      let d = 1;
      while (j < s.length && d > 0) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '"' || s[j] === "'" || s[j] === '`') { j = readString(s, j).end; continue; }
        if (s[j] === '{') d++;
        else if (s[j] === '}') d--;
        j++;
      }
      continue;
    }
    if (s[j] === q) return { end: j + 1 };
    j++;
  }
  return { end: s.length };
}

function balancedEnd(s, openIdx) {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const open = s[openIdx];
  const close = pairs[open];
  let depth = 0;
  let i = openIdx;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { i = readString(s, i).end; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0 && c === close) return i;
    }
    i++;
  }
  return s.length - 1;
}

function readValue(s, i) {
  i = skipWs(s, i);
  const start = i;
  const c = s[i];
  if (c === '"' || c === "'" || c === '`') {
    const end = readString(s, i).end;
    return { raw: s.slice(start, end), end };
  }
  if (c === '{' || c === '[' || c === '(') {
    const end = balancedEnd(s, i) + 1;
    return { raw: s.slice(start, end), end };
  }
  // 调用和属性访问要整段吃掉。停在第一个 ) 会把 `$('#dnote').value` 拆成假字段 value。
  let j = i;
  let depth = 0;
  while (j < s.length) {
    const ch = s[j];
    if (ch === '"' || ch === "'" || ch === '`') { j = readString(s, j).end; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; j++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) break;
      depth--;
      j++;
      continue;
    }
    if (depth === 0 && /[\s,]/.test(ch)) break;
    j++;
  }
  return { raw: s.slice(start, j), end: j };
}

function parseObjectEntries(raw) {
  const s = String(raw || '').trim();
  if (!s.startsWith('{')) return null;
  const entries = [];
  let i = 1;
  while (i < s.length) {
    i = skipWs(s, i);
    if (i >= s.length || s[i] === '}') break;
    if (s[i] === ',') { i++; continue; }
    if (s.startsWith('...', i)) {
      i = readValue(s, i + 3).end;
      continue;
    }
    if (s[i] === '[') {
      i = balancedEnd(s, i) + 1;
      i = skipWs(s, i);
      if (s[i] === ':') i = readValue(s, i + 1).end;
      continue;
    }
    let key = null;
    if (s[i] === '"' || s[i] === "'") {
      const end = readString(s, i).end;
      key = unescapeJs(s.slice(i + 1, end - 1));
      i = end;
    } else if (/[A-Za-z_$]/.test(s[i])) {
      const start = i;
      i++;
      while (i < s.length && /[\w$]/.test(s[i])) i++;
      key = s.slice(start, i);
    } else { i++; continue; }
    i = skipWs(s, i);
    if (s[i] === ':') {
      const v = readValue(s, i + 1);
      entries.push([key, v.raw]);
      i = v.end;
    } else entries.push([key, null]);
  }
  return entries;
}

function unescapeJs(s) {
  return s.replace(/\\(['"\\nrt/])/g, (_, c) => ({ "'": "'", '"': '"', '\\': '\\', n: '\n', r: '\r', t: '\t', '/': '/' }[c]));
}

function unwrapParens(s) {
  let t = String(s).trim();
  while (t.startsWith('(') && t.endsWith(')')) {
    if (balancedEnd(t, 0) !== t.length - 1) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}

function splitTopLevelPlus(s) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { i = readString(s, i).end; continue; }
    if (c === '(' || c === '{' || c === '[') { depth++; i++; continue; }
    if (c === ')' || c === '}' || c === ']') { depth = Math.max(0, depth - 1); i++; continue; }
    if (c === '+' && depth === 0) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
    i++;
  }
  parts.push(s.slice(start).trim());
  return parts.filter((part) => part.length > 0);
}

function looksLikePath(value) {
  const v = String(value).trim();
  return v.startsWith('/') || /^[a-z][a-z0-9+.-]*:\/\//i.test(v);
}

function hasTopLevelTernary(s) {
  let depth = 0;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { i = readString(s, i).end; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; i++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth = Math.max(0, depth - 1); i++; continue; }
    if (depth === 0 && (c === '?' || c === ':')) return true;
    i++;
  }
  return false;
}

// 拼进路径的动态片段必须是「整段换成一个参数」的表达式。
// 三元表达式会把查询串或空串粘进路径，认不出就整段放弃，不编一条。
function isOpaquePathSegment(part) {
  const s = unwrapParens(part);
  if (!s) return false;
  return !hasTopLevelTernary(s);
}

function parseUrl(raw) {
  if (raw == null) return null;
  const s = unwrapParens(raw);
  if (!s) return null;
  if (s[0] === '"' || s[0] === "'" || s[0] === '`') {
    const end = readString(s, 0).end;
    if (end === s.length) {
      if (s[0] === '`') {
        const value = s.slice(1, -1);
        return { template: value.includes('${'), value };
      }
      return { template: false, value: unescapeJs(s.slice(1, -1)) };
    }
  }
  const parts = splitTopLevelPlus(s);
  if (parts.length < 2) return null;
  const head = parseUrl(parts[0]);
  if (!head || !looksLikePath(head.value)) return null;
  let value = head.value;
  let template = head.template;
  for (const part of parts.slice(1)) {
    const lit = parseUrl(part);
    if (lit) {
      value += lit.value;
      if (lit.template) template = true;
      continue;
    }
    if (!isOpaquePathSegment(part)) return null;
    value += '${param}';
    template = true;
  }
  return { template, value };
}

function normalizePath(raw) {
  let p = String(raw).trim();
  const qIdx = p.indexOf('?');
  let query = '';
  if (qIdx >= 0) { query = p.slice(qIdx + 1); p = p.slice(0, qIdx); }
  p = p.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  p = p.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, '{$1}');
  p = p.replace(/\$\{[^}]*\}/g, '{param}');
  p = p.replace(/\/:([A-Za-z_$][\w$]*)/g, '/{$1}');
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  const queryKeys = [];
  for (const part of query.split('&')) {
    if (!part) continue;
    const key = part.split('=')[0].replace(/\$\{[^}]*\}/g, '').trim();
    if (key && !key.includes('$') && !key.includes('{')) queryKeys.push(key);
  }
  return { path: p, queryKeys };
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

function readCallArgs(text, parenIdx) {
  const args = [];
  let i = parenIdx + 1;
  let start = i;
  let depth = 1;
  while (i < text.length && depth > 0) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') { i = readString(text, i).end; continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') {
      depth--;
      if (depth === 0) {
        const last = text.slice(start, i).trim();
        if (last) args.push(last);
        return { args, end: i };
      }
    } else if (c === ',' && depth === 1) {
      args.push(text.slice(start, i).trim());
      start = i + 1;
    }
    i++;
  }
  return null;
}

function skipGenerics(text, i) {
  if (text[i] !== '<') return i;
  let depth = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') { i = readString(text, i).end; continue; }
    if (c === '<') depth++;
    else if (c === '>') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return i;
}

function quotedMethod(raw) {
  const lit = parseUrl(raw);
  if (!lit || lit.template) return null;
  const method = lit.value.toUpperCase();
  return METHODS.has(method) ? method : null;
}

function queryFromConfig(configRaw) {
  const entries = parseObjectEntries(configRaw);
  if (!entries) return [];
  const params = entries.find(([k]) => k === 'params');
  if (!params || !params[1]) return [];
  const inner = parseObjectEntries(params[1]);
  return inner ? inner.map(([k]) => k) : [];
}

function methodFromEntries(entries, fallback) {
  if (!entries) return fallback;
  const found = entries.find(([k]) => k === 'method' || k === 'type');
  if (!found) return fallback;
  if (!found[1]) return null;
  return quotedMethod(found[1]);
}

function bodyKeys(raw) {
  const entries = parseObjectEntries(raw);
  if (!entries) return null;
  return entries.map(([k]) => k).filter(Boolean);
}

function enclosingSymbol(text, index) {
  const head = text.slice(0, index);
  const re = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g;
  let m;
  let name = null;
  while ((m = re.exec(head))) name = m[1] || m[2];
  return name;
}

function assignedName(text, calleeIndex) {
  const head = text.slice(Math.max(0, calleeIndex - 160), calleeIndex);
  const m = head.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s*)?$/);
  return m ? m[1] : null;
}

function addIdentList(fields, raw) {
  for (const part of String(raw).split(',')) {
    const t = part.trim();
    if (!t || t.startsWith('...')) continue;
    const name = t.split(':')[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name) && !SKIP_FIELD.has(name)) fields.add(name);
  }
}

function collectFields(window, varName) {
  const fields = new Set();
  const take = (alias) => {
    const re = new RegExp(`\\b${alias}\\.([A-Za-z_$][\\w$]*)\\b(?!\\s*\\()`, 'g');
    let m;
    while ((m = re.exec(window))) if (!SKIP_FIELD.has(m[1]) && !WRAP.has(m[1])) fields.add(m[1]);
  };
  if (varName) {
    const mapRe = new RegExp(`\\b${varName}\\.data\\??\\.(?:list|items|records|rows)\\.map\\(\\s*\\(?\\s*([A-Za-z_$][\\w$]*)`, 'g');
    let m;
    while ((m = mapRe.exec(window))) take(m[1]);
    const direct = new RegExp(`\\b${varName}\\.data\\??\\.(?:data|result|payload)\\??\\.([A-Za-z_$][\\w$]*)\\b(?!\\s*\\()`, 'g');
    while ((m = direct.exec(window))) if (!SKIP_FIELD.has(m[1]) && !WRAP.has(m[1])) fields.add(m[1]);
    const shallow = new RegExp(`\\b${varName}\\.data\\??\\.([A-Za-z_$][\\w$]*)\\b(?!\\s*\\()`, 'g');
    while ((m = shallow.exec(window))) if (!SKIP_FIELD.has(m[1]) && !WRAP.has(m[1])) fields.add(m[1]);
    const dest = new RegExp(`\\{([^}]+)\\}\\s*=\\s*${varName}\\.data\\b`, 'g');
    while ((m = dest.exec(window))) addIdentList(fields, m[1]);
  }
  const thenRe = /\.then\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>/g;
  let m;
  while ((m = thenRe.exec(window))) take(m[1]);
  return fields;
}

function commentFields(slice) {
  const fields = new Set();
  const re = /response\s*:\s*([A-Za-z_][\w]*(?:\s*,\s*[A-Za-z_][\w]*)*)/gi;
  let m;
  while ((m = re.exec(slice))) addIdentList(fields, m[1]);
  return fields;
}

function windowAfter(text, endIndex, starts) {
  const startLine = indexToLine(starts, endIndex);
  const limit = Math.min(starts.length, startLine + 20);
  const end = limit < starts.length ? starts[limit] : text.length;
  let slice = text.slice(endIndex, end);
  const cut = slice.search(/\n(?:export\s+)?(?:async\s+)?function\s+/);
  if (cut >= 0) slice = slice.slice(0, cut + 1);
  return slice;
}

function blankMap(keys) {
  const obj = {};
  for (const k of [...keys].sort()) obj[k] = {};
  return obj;
}

function scanFile(abs) {
  const text = read(abs);
  if (!text) return [];
  const starts = lineStartsOf(text);
  const comments = commentRanges(text);
  const rel = relative(ROOT, abs).split(sep).join('/');
  const found = [];
  const re = new RegExp(`axios\\s*\\.\\s*(get|post|put|patch|delete|head|options)|axios|fetch|\\$\\s*\\.\\s*ajax|\\$\\s*\\.\\s*(get|post)|(?<![\\w$.])(?:${THIN_ALT})`, 'g');
  let m;
  while ((m = re.exec(text))) {
    if (inRanges(comments, m.index)) continue;
    const callee = m[0];
    let i = skipWs(text, m.index + callee.length);
    i = skipGenerics(text, i);
    i = skipWs(text, i);
    if (text[i] !== '(') continue;
    const call = readCallArgs(text, i);
    if (!call) continue;
    const kind = callee.replace(/\s+/g, '');
    let method = null;
    let url = null;
    let body = null;
    let config = null;
    if (/^axios\.(get|delete|head|options)$/.test(kind)) {
      method = kind.split('.')[1].toUpperCase();
      url = parseUrl(call.args[0]);
      config = call.args[1] || null;
    } else if (/^axios\.(post|put|patch)$/.test(kind)) {
      method = kind.split('.')[1].toUpperCase();
      url = parseUrl(call.args[0]);
      body = call.args[1] || null;
      config = call.args[2] || null;
    } else if (kind === 'axios') {
      const entries = parseObjectEntries(call.args[0]);
      if (!entries) continue;
      method = methodFromEntries(entries, 'GET');
      const urlEntry = entries.find(([k]) => k === 'url');
      url = urlEntry ? parseUrl(urlEntry[1]) : null;
      const data = entries.find(([k]) => k === 'data');
      body = data ? data[1] : null;
      config = call.args[0];
    } else if (kind === 'fetch') {
      url = parseUrl(call.args[0]);
      config = call.args[1] || null;
      method = methodFromEntries(parseObjectEntries(config), 'GET');
    } else if (kind === '$.get' || kind === '$.post') {
      method = kind === '$.get' ? 'GET' : 'POST';
      url = parseUrl(call.args[0]);
      body = method === 'POST' ? (call.args[1] || null) : null;
      config = method === 'GET' ? (call.args[1] || null) : (call.args[2] || null);
    } else if (kind === '$.ajax') {
      const entries = parseObjectEntries(call.args[0]);
      if (!entries) continue;
      method = methodFromEntries(entries, 'GET');
      const urlEntry = entries.find(([k]) => k === 'url');
      url = urlEntry ? parseUrl(urlEntry[1]) : null;
      const data = entries.find(([k]) => k === 'data');
      body = data ? data[1] : null;
      config = call.args[0];
    } else if (Object.prototype.hasOwnProperty.call(THIN_CALLS, kind)) {
      method = THIN_CALLS[kind];
      url = parseUrl(call.args[0]);
      if (THIN_BODY_METHODS.has(method)) body = call.args[1] || null;
    } else if (THIN_API.includes(kind)) {
      method = quotedMethod(call.args[0]);
      url = call.args.length > 1 ? parseUrl(call.args[1]) : null;
      if (method && THIN_BODY_METHODS.has(method)) body = call.args[2] || null;
    }
    if (!method || !url) continue;
    const norm = normalizePath(url.value);
    if (!norm.path.startsWith('/')) continue;
    const name = assignedName(text, m.index);
    const tail = windowAfter(text, call.end, starts);
    const fields = collectFields(tail, name);
    const callLine = indexToLine(starts, call.end);
    const commentEnd = starts[callLine + 1] ?? text.length;
    for (const f of commentFields(text.slice(m.index, commentEnd))) fields.add(f);
    const queryKeys = new Set(norm.queryKeys);
    for (const k of queryFromConfig(config)) queryKeys.add(k);
    const keys = bodyKeys(body);
    const lineStart = indexToLine(starts, m.index);
    const lineEnd = callLine;
    const source = { file: rel, lineStart };
    if (lineEnd !== lineStart) source.lineEnd = lineEnd;
    const symbol = enclosingSymbol(text, m.index);
    if (symbol) source.symbol = symbol;
    found.push({
      method,
      path: norm.path,
      summary: '',
      query: [...queryKeys],
      body: keys && keys.length ? keys : null,
      fields: [...fields],
      confidence: url.template ? 'low' : 'medium',
      source,
    });
    re.lastIndex = call.end + 1;
  }
  return found;
}

function merge(calls) {
  const map = new Map();
  for (const call of calls) {
    const key = `${call.method} ${call.path}`;
    let row = map.get(key);
    if (!row) {
      row = {
        method: call.method,
        path: call.path,
        summary: '',
        query: new Set(),
        body: new Set(),
        fields: new Set(),
        confidence: 'medium',
        sources: [],
      };
      map.set(key, row);
    }
    for (const k of call.query) row.query.add(k);
    if (call.body) for (const k of call.body) row.body.add(k);
    for (const f of call.fields) row.fields.add(f);
    if (call.confidence === 'low') row.confidence = 'low';
    row.sources.push(call.source);
  }
  const ops = [...map.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  const used = new Map();
  return ops.map((row) => {
    let id = operationId(row.method, row.path);
    if (used.has(id)) {
      const n = used.get(id) + 1;
      used.set(id, n);
      id = `${id}_${n}`;
    } else used.set(id, 1);
    row.sources.sort((a, b) => a.file.localeCompare(b.file) || a.lineStart - b.lineStart);
    return {
      id,
      method: row.method,
      path: row.path,
      summary: row.summary,
      request: {
        query: blankMap(row.query),
        body: row.body.size ? blankMap(row.body) : null,
      },
      response: { fields: [...row.fields].sort() },
      sources: row.sources,
      confidence: row.confidence,
    };
  });
}

const calls = walk(ROOT).flatMap(scanFile);
const doc = {
  version: '1',
  generatedAt: new Date().toISOString(),
  generator: 'extract-desired',
  operations: merge(calls),
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`);
console.log(OUT);
console.error(`操作 ${doc.operations.length} 条`);
