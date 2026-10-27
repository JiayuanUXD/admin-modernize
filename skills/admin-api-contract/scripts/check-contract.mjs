#!/usr/bin/env node
/**
 * check-contract：拿响应对照契约的 response.fields（Node 18+，无依赖）。
 *
 * 契约用 actual IR（优先）和/或 desired IR。同一方法 + 路径两边都有时，整条用 actual。
 * 响应来自 --samples（录制/合成 JSON 或 JSONL），和/或 --base 现场拉。
 * 拉失败、HTTP 非 2xx、响应不是 JSON 对象：打 CONTRACT_ERROR，进程不崩，不算 mismatch。
 *
 * 缺字段 → CONTRACT_MISMATCH（计入 mismatch_count）。
 * 多余字段 → CONTRACT_WARNING（计入 warning_count，不算不一致）。
 * 只比响应 JSON 的顶层键，不走进数组元素，不看类型。
 * gap 表的 reshape / missing 不参与这个计数。
 *
 * 用法
 *   node check-contract.mjs (--actual <actual.ir.json> | --desired <desired.ir.json> | 两者)
 *     (--samples <目录或.jsonl> | --base <url> | 两者)
 *     [--param <路径参数替换值>]
 *
 * 退出码：0 全过（warning 可以有）；1 有 mismatch 或 CONTRACT_ERROR；2 参数或契约文件不合法。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const USAGE = [
  '用法',
  '  node check-contract.mjs (--actual <actual.ir.json> | --desired <desired.ir.json> | 两者) \\',
  '    (--samples <目录或.jsonl> | --base <url> | 两者) [--param <值>]',
  '',
  '对照 response.fields 的顶层键。actual 与 desired 撞车时用 actual。',
  '缺字段打 CONTRACT_MISMATCH；多余字段打 CONTRACT_WARNING，不计 mismatch。',
  '文件名：GET__api_insights.json、GET__api_insights_{param}.json（下划线还原成斜杠，花括号里不要再写下划线）。',
  'JSONL 每行：{"method","path","body"?,"response"}。body 只在 --base 发请求时用。',
  '--base 拉失败记 CONTRACT_ERROR，不把进程打崩，也不计入 mismatch_count。',
  '结束一行：CONTRACT_SUMMARY mismatch_count=N warning_count=M checked=K error_count=E',
  '不一致数只认 mismatch_count。gap 的 reshape 不是这个数。',
].join('\n');

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

const die = (msg) => { console.error(`✘ ${msg}`); process.exit(2); };
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

let actualPath = null;
let desiredPath = null;
let samplesPath = null;
let base = null;
let paramValue = 'sample';
const valued = new Set(['--actual', '--desired', '--samples', '--base', '--param']);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!valued.has(a)) die(`未知参数 ${a}\n${USAGE}`);
  const value = argv[++i];
  if (value == null || String(value).startsWith('--')) die(`缺少 ${a} 的值\n${USAGE}`);
  if (a === '--actual') actualPath = value;
  else if (a === '--desired') desiredPath = value;
  else if (a === '--samples') samplesPath = value;
  else if (a === '--base') base = value;
  else if (a === '--param') paramValue = value;
}
if (!actualPath && !desiredPath) die(`缺少 --actual 或 --desired\n${USAGE}`);
if (!samplesPath && !base) die(`缺少 --samples 或 --base\n${USAGE}`);
if (actualPath && !existsSync(actualPath)) die(`找不到 ${actualPath}`);
if (desiredPath && !existsSync(desiredPath)) die(`找不到 ${desiredPath}`);
if (samplesPath && !existsSync(samplesPath)) die(`找不到 ${samplesPath}`);
if (base && !/^https?:\/\//i.test(base)) die(`--base 要以 http:// 或 https:// 开头`);

function readJson(file) {
  let text;
  try { text = readFileSync(file, 'utf8'); }
  catch (e) { die(`读不了 ${file}：${e.message}`); }
  try { return JSON.parse(text); }
  catch (e) { die(`${file} 不是合法 JSON：${e.message}`); }
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

function opKey(method, path) {
  return `${String(method).toUpperCase()} ${normalizePath(path)}`;
}

function loadOperations(file, label) {
  const json = readJson(file);
  if (!json || typeof json !== 'object' || !Array.isArray(json.operations)) {
    die(`${file} 不是契约 IR：需要 operations 数组（${label}）`);
  }
  const ops = [];
  for (const op of json.operations) {
    if (!op || typeof op !== 'object') die(`${file} 里有一条操作不是对象`);
    const method = String(op.method || '').toUpperCase();
    if (!METHODS.has(method)) die(`${file} 操作方法不合法：${op.method}`);
    if (!op.path) die(`${file} 有操作缺少 path`);
    const fields = op.response && op.response.fields;
    if (!Array.isArray(fields) || fields.some((f) => typeof f !== 'string' || !f)) {
      die(`${file} 的 ${method} ${op.path} 缺少 response.fields`);
    }
    ops.push({
      id: typeof op.id === 'string' && op.id ? op.id : '-',
      method,
      path: normalizePath(op.path),
      fields,
    });
  }
  if (!ops.length) die(`${file} 的 operations 是空的`);
  return ops;
}

function indexOps(ops) {
  const map = new Map();
  for (const op of ops) {
    const key = opKey(op.method, op.path);
    if (!map.has(key)) map.set(key, op);
  }
  return map;
}

function oneLine(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function parseName(filename) {
  const base = basename(filename).replace(/\.(jsonl|ndjson|json)$/i, '');
  const m = base.match(/^([A-Za-z]+)__(.+)$/);
  if (!m) return null;
  const method = m[1].toUpperCase();
  if (!METHODS.has(method)) return null;
  const path = normalizePath(m[2].replace(/_/g, '/'));
  return { method, path };
}

function asResponseRecord(value, fallback) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { error: '响应不是 JSON 对象' };
  }
  const method = value.method != null ? String(value.method).toUpperCase() : '';
  const hasEnvelope = METHODS.has(method) && typeof value.path === 'string' && value.path
    && Object.prototype.hasOwnProperty.call(value, 'response');
  if (hasEnvelope && !fallback) {
    return {
      method,
      path: normalizePath(value.path),
      body: Object.prototype.hasOwnProperty.call(value, 'body') ? value.body : undefined,
      response: value.response,
    };
  }
  if (fallback) {
    return { method: fallback.method, path: fallback.path, body: undefined, response: value };
  }
  return { error: '认不出操作。文件名写成 METHOD__path.json，或在 JSONL 里带 method、path、response' };
}

function loadSamples(target) {
  const records = [];
  const errors = [];
  const st = statSync(target);
  const files = st.isDirectory()
    ? readdirSync(target).filter((name) => !name.startsWith('.')).sort((a, b) => a.localeCompare(b)).map((name) => join(target, name))
    : [target];
  for (const file of files) {
    if (statSync(file).isDirectory()) continue;
    const name = basename(file);
    const lower = name.toLowerCase();
    if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) {
      const text = readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (!line.trim()) return;
        const where = `${name}:${idx + 1}`;
        let json;
        try { json = JSON.parse(line); }
        catch (e) {
          errors.push({ where, error: `invalid json: ${oneLine(e.message)}` });
          return;
        }
        const rec = asResponseRecord(json, null);
        if (rec.error) errors.push({ where, error: rec.error });
        else records.push(rec);
      });
      continue;
    }
    if (!lower.endsWith('.json')) continue;
    let json;
    try { json = JSON.parse(readFileSync(file, 'utf8')); }
    catch (e) {
      errors.push({ where: name, error: `invalid json: ${oneLine(e.message)}` });
      continue;
    }
    const named = parseName(name);
    const rec = asResponseRecord(json, named);
    if (rec.error) errors.push({ where: name, error: rec.error });
    else records.push(rec);
  }
  return { records, errors };
}

function compare(op, response) {
  if (response == null || typeof response !== 'object' || Array.isArray(response)) {
    return { error: 'response is not an object' };
  }
  const actualKeys = new Set(Object.keys(response));
  const missing = op.fields.filter((f) => !actualKeys.has(f)).sort();
  const expected = new Set(op.fields);
  const extra = [...actualKeys].filter((k) => !expected.has(k)).sort();
  return { missing, extra };
}

function lineFor(kind, op, method, path, tail) {
  const id = op && op.id ? op.id : '-';
  return `CONTRACT_${kind} op=${id} method=${method} path=${path} ${tail}`;
}

function fillPath(path) {
  return path.replace(/\{[^}]+\}/g, encodeURIComponent(paramValue));
}

function sampleBodyFor(records, op) {
  const key = opKey(op.method, op.path);
  const hit = records.find((rec) => opKey(rec.method, rec.path) === key && rec.body !== undefined);
  return hit ? hit.body : {};
}

async function fetchLive(op, body) {
  const url = `${base.replace(/\/$/, '')}${fillPath(op.path)}`;
  const init = { method: op.method, headers: { accept: 'application/json' } };
  if (op.method !== 'GET' && op.method !== 'HEAD') {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body == null ? {} : body);
  }
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
  } catch (e) {
    const cause = e && e.cause;
    const extra = cause ? (cause.code || cause.message || '') : '';
    const msg = [e && e.message, extra].filter(Boolean).join(': ');
    return { error: `fetch failed: ${oneLine(msg) || 'unknown'}` };
  }
  if (!res.ok) return { error: `http ${res.status}` };
  const text = await res.text();
  try { return { response: JSON.parse(text) }; }
  catch (e) { return { error: `non-json: ${oneLine(e.message)}` }; }
}

function applyCompare(op, response, stats) {
  const result = compare(op, response);
  if (result.error) {
    stats.errors += 1;
    console.log(lineFor('ERROR', op, op.method, op.path, `error=${result.error}`));
    return;
  }
  stats.checked += 1;
  if (result.missing.length) {
    stats.mismatch += 1;
    console.log(lineFor('MISMATCH', op, op.method, op.path, `missing=${result.missing.join(',')}`));
  }
  if (result.extra.length) {
    stats.warning += 1;
    console.log(lineFor('WARNING', op, op.method, op.path, `extra=${result.extra.join(',')}`));
  }
}

async function main() {
  const desiredOps = desiredPath ? loadOperations(desiredPath, 'desired') : [];
  const actualOps = actualPath ? loadOperations(actualPath, 'actual') : [];
  const contracts = indexOps(desiredOps);
  for (const [key, op] of indexOps(actualOps)) contracts.set(key, op);

  const stats = { mismatch: 0, warning: 0, checked: 0, errors: 0 };
  let records = [];
  if (samplesPath) {
    const loaded = loadSamples(samplesPath);
    records = loaded.records;
    for (const err of loaded.errors) {
      stats.errors += 1;
      console.log(`CONTRACT_ERROR op=- method=- path=- error=${oneLine(`${err.where}: ${err.error}`)}`);
    }
    if (!records.length && !loaded.errors.length && !base) {
      stats.errors += 1;
      console.log('CONTRACT_ERROR op=- method=- path=- error=no samples');
    }
    for (const rec of records) {
      const op = contracts.get(opKey(rec.method, rec.path));
      if (!op) {
        stats.errors += 1;
        console.log(`CONTRACT_ERROR op=- method=${rec.method} path=${rec.path} error=no contract operation`);
        continue;
      }
      applyCompare(op, rec.response, stats);
    }
  }

  if (base) {
    for (const op of contracts.values()) {
      const live = await fetchLive(op, sampleBodyFor(records, op));
      if (live.error) {
        stats.errors += 1;
        console.log(lineFor('ERROR', op, op.method, op.path, `error=${live.error}`));
        continue;
      }
      applyCompare(op, live.response, stats);
    }
  }

  console.log(
    `CONTRACT_SUMMARY mismatch_count=${stats.mismatch} warning_count=${stats.warning} checked=${stats.checked} error_count=${stats.errors}`,
  );
  process.exitCode = stats.mismatch > 0 || stats.errors > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error(`✘ ${oneLine(e && e.stack ? e.stack : e)}`);
  process.exit(2);
});
