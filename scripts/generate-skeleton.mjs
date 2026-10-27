#!/usr/bin/env node
/**
 * generate-skeleton：差距表过了人工门禁之后，写出映射骨架（Node 18+，无依赖）。
 *
 * 任一条 disposition 为 null 或空字符串 → 退出码 1，不写文件。
 * direct / bff → mappers.mjs
 * pending → pending-endpoints.json + pending.md
 * 全部操作 → route-mode.json（direct/bff 为 real，pending 为 pending）
 * client.stub.mjs 是 typed client 入口骨架，不是完整客户端。
 *
 * 用法
 *   node generate-skeleton.mjs --gap <gap.ir.json> --out-dir <目录>
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const argv = process.argv.slice(2);
const USAGE = [
  '用法',
  '  node generate-skeleton.mjs --gap <gap.ir.json> --out-dir <目录>',
  '',
  '人工门禁：每条差距的 disposition 必须是 direct、bff 或 pending。',
  '有空值就拒绝（退出码 1），不生成文件。',
].join('\n');

const die = (msg, code = 2) => { console.error(`✘ ${msg}`); process.exit(code); };
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

let gapPath = null;
let outDir = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--gap') gapPath = argv[++i];
  else if (a === '--out-dir') outDir = argv[++i];
  else die(`未知参数 ${a}\n${USAGE}`);
  if ((a === '--gap' || a === '--out-dir') && (argv[i] == null || String(argv[i]).startsWith('--'))) {
    die(`缺少 ${a} 的值\n${USAGE}`);
  }
}
if (!gapPath || !outDir) die(`缺少 --gap 或 --out-dir\n${USAGE}`);
if (!existsSync(gapPath)) die(`找不到 ${gapPath}`);

let gap;
try { gap = JSON.parse(readFileSync(gapPath, 'utf8')); }
catch (e) { die(`${gapPath} 不是合法 JSON：${e.message}`); }
if (!gap || !Array.isArray(gap.items)) die(`${gapPath} 不是 gap IR：缺少 items`);

const ALLOWED = new Set(['direct', 'bff', 'pending']);
const blocked = [];
for (const [i, item] of gap.items.entries()) {
  if (!item || typeof item !== 'object') die(`第 ${i + 1} 条不是对象`);
  if (!item.desiredId || !item.method || !item.path) die(`第 ${i + 1} 条缺 desiredId、method 或 path`);
  const raw = item.disposition;
  if (raw == null || String(raw).trim() === '') {
    blocked.push(item);
    continue;
  }
  const disposition = String(raw).trim();
  if (!ALLOWED.has(disposition)) die(`第 ${i + 1} 条 disposition 无效：${disposition}。只能是 direct、bff、pending。`);
  item.disposition = disposition;
}
if (blocked.length) {
  const lines = blocked.map((item) => `  - ${item.desiredId} ${item.method} ${item.path}`);
  die([
    `人工门禁未过：还有 ${blocked.length} 条差距的 disposition 为空。`,
    '先把每条填成 direct（直连）、bff（适配层映射）或 pending（后端还没有），再生成骨架。',
    ...lines,
  ].join('\n'), 1);
}

const DIR = resolve(outDir);
mkdirSync(DIR, { recursive: true });
const generatedAt = new Date().toISOString();
const actionable = gap.items.filter((item) => item.disposition === 'direct' || item.disposition === 'bff');
const pending = gap.items.filter((item) => item.disposition === 'pending');

function comment(text) {
  return String(text || '').replace(/\r?\n/g, ' ').replace(/\*\//g, '* /');
}
function fnName(id) {
  return /^[A-Za-z_$][\w$]*$/.test(id) ? id : null;
}

const operationLiterals = actionable.map((item) => `  ${JSON.stringify({
  id: item.desiredId,
  method: item.method,
  path: item.path,
  disposition: item.disposition,
  status: item.status || null,
})}`).join(',\n');
const mapperFns = actionable.map((item) => {
  const name = fnName(item.desiredId);
  const header = item.disposition === 'bff'
    ? `// bff：按差距备注做字段映射，页面不要自己改名。${comment(item.notes)}`
    : `// direct：原样透过。${comment(item.notes)}`;
  if (!name) return `  ${JSON.stringify(item.desiredId)}(raw) {\n    ${header}\n    return raw;\n  }`;
  return `  ${name}(raw) {\n    ${header}\n    return raw;\n  }`;
}).join(',\n');

const mappers = `/**
 * 映射层骨架，由 generate-skeleton 写出。
 * direct 原样透过；bff 在这里改字段。页面不要自己做参数改名或拆包。
 * 这不是完整的 typed client。
 */
export const operations = [
${operationLiterals}
];

export const mappers = {
${mapperFns}
};
`;

const clientFns = gap.items.map((item) => {
  const name = fnName(item.desiredId);
  const key = name || JSON.stringify(item.desiredId);
  if (item.disposition === 'pending') {
    return `    ${key}() {\n      throw new Error('后端尚未提供: ${comment(item.desiredId)}');\n    }`;
  }
  return `    ${key}() {\n      throw new Error('stub client: ${comment(item.desiredId)} 未接数据层');\n    }`;
}).join(',\n');
const client = `/**
 * typed client 入口骨架，由 generate-skeleton 写出。
 * 只占住方法名。完整客户端要等契约评审之后替换这里。
 */
export const operations = ${JSON.stringify(gap.items.map((item) => ({
  id: item.desiredId,
  method: item.method,
  path: item.path,
  disposition: item.disposition,
})), null, 2)};

export function createStubClient() {
  return {
${clientFns}
  };
}
`;

const modes = {};
for (const item of gap.items) modes[item.desiredId] = item.disposition === 'pending' ? 'pending' : 'real';
const routeMode = {
  version: '1',
  generatedAt,
  generator: 'generate-skeleton',
  modes,
};
const pendingDoc = {
  version: '1',
  generatedAt,
  generator: 'generate-skeleton',
  endpoints: pending.map((item) => ({
    id: item.desiredId,
    method: item.method,
    path: item.path,
    status: item.status || null,
    notes: item.notes || '',
    disposition: 'pending',
  })),
};
const pendingLines = pending.length
  ? pending.map((item) => `| ${item.desiredId} | ${item.method} | ${item.path} | ${item.status || ''} | ${String(item.notes || '').replace(/\|/g, '\\|')} |`)
  : ['| — | — | — | — | 没有 pending |'];
const pendingMd = `# 待后端提供

这些接口的处置是 \`pending\`。页面应提示「后端尚未提供」，不要 mock 成成功。

| id | method | path | status | notes |
|---|---|---|---|---|
${pendingLines.join('\n')}
`;

writeFileSync(join(DIR, 'mappers.mjs'), mappers);
writeFileSync(join(DIR, 'client.stub.mjs'), client);
writeFileSync(join(DIR, 'route-mode.json'), `${JSON.stringify(routeMode, null, 2)}\n`);
writeFileSync(join(DIR, 'pending-endpoints.json'), `${JSON.stringify(pendingDoc, null, 2)}\n`);
writeFileSync(join(DIR, 'pending.md'), pendingMd);
console.log(DIR);
