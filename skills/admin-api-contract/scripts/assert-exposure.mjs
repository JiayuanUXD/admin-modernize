#!/usr/bin/env node
/**
 * 断言 generate-skeleton 对 exposure 的行为。
 *
 *   node skills/admin-api-contract/scripts/assert-exposure.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const gen = join(repo, 'scripts', 'generate-skeleton.mjs');
const fx = join(here, '..', 'fixtures', 'exposure');
const SKELETONS = [
  'mappers.mjs',
  'client.stub.mjs',
  'route-mode.json',
  'pending-endpoints.json',
  'pending.md',
  'mcp-tools.stub.mjs',
];

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function run(gapPath) {
  const dir = mkdtempSync(join(tmpdir(), 'exposure-'));
  const out = join(dir, 'skeleton');
  const result = spawnSync(process.execPath, [gen, '--gap', gapPath, '--out-dir', out], { encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr || '', stdout: result.stdout || '', out, dir };
}

function assertAbsent(out) {
  if (existsSync(out)) {
    const present = SKELETONS.filter((name) => existsSync(join(out, name)));
    if (present.length) fail(`非法 exposure 仍写出文件：${present.join(', ')}`);
    fail('非法 exposure 仍创建了输出目录');
  }
}

const legal = run(join(fx, 'gap.ir.json'));
if (legal.status !== 0) fail(`合法夹具应退出码 0，实际 ${legal.status}\n${legal.stderr}`);
const stubPath = join(legal.out, 'mcp-tools.stub.mjs');
if (!existsSync(stubPath)) fail('缺少 mcp-tools.stub.mjs');
const stubUrl = pathToFileURL(stubPath);
stubUrl.searchParams.set('t', String(Date.now()));
const mod = await import(stubUrl.href);
const names = (mod.tools || []).map((tool) => tool.name);
if (names.join(',') !== 'listThings,getThing') fail(`工具名应为 listThings,getThing，实际 ${names.join(',')}`);
const listSchema = mod.tools[0].inputSchema;
const getSchema = mod.tools[1].inputSchema;
if (listSchema.type !== 'object' || listSchema.additionalProperties !== false || JSON.stringify(listSchema.properties) !== '{}' || listSchema.required != null) {
  fail(`listThings.inputSchema 应是没有 required 的空 properties：${JSON.stringify(listSchema)}`);
}
if (JSON.stringify(getSchema.required) !== JSON.stringify(['id']) || getSchema.properties.id.type !== 'string' || getSchema.additionalProperties !== false) {
  fail(`getThing.inputSchema.required 应为 ["id"]，实际 ${JSON.stringify(getSchema)}`);
}
if (mod.tools[0].description !== '列出 things' || mod.tools[1].description !== '按 id 读取 thing') {
  fail(`工具描述应来自 notes：${mod.tools.map((tool) => tool.description).join(' | ')}`);
}
const mapperText = readFileSync(join(legal.out, 'mappers.mjs'), 'utf8');
const clientText = readFileSync(join(legal.out, 'client.stub.mjs'), 'utf8');
for (const id of ['listThings', 'getThing', 'createThing', 'updateThing']) {
  if (!mapperText.includes(id)) fail(`mappers.mjs 缺少 ${id}`);
}
if (mapperText.includes('deleteThing')) fail('mappers.mjs 含有 deleteThing');
if (mapperText.includes('mcp-tools') || clientText.includes('mcp-tools')) fail('映射或 client 引用了 mcp-tools');
const handlerSrc = mod.tools.map((tool) => String(tool.handler)).join('\n');
if (!handlerSrc.includes('dataLayer.listThings') || !handlerSrc.includes('dataLayer.getThing')) {
  fail(`handler 未调用数据层同名方法：\n${handlerSrc}`);
}
const pageHttp = 'this.$' + 'http';
if (handlerSrc.includes('fetch(') || handlerSrc.includes('axios') || handlerSrc.includes(pageHttp)) {
  fail('handler 含有页面或 HTTP 调用');
}
const pendingMd = readFileSync(join(legal.out, 'pending.md'), 'utf8');
if (!pendingMd.includes('deleteThing') || !pendingMd.includes('已标 `mcp`，后端未提供，所以没有工具。')) {
  fail(`pending.md 未注明 mcp 未发布工具：\n${pendingMd}`);
}
const stubText = readFileSync(stubPath, 'utf8');
if (!stubText.includes('这是给 Agent 直接调用的占位，不是服务器，也不是页面要 import 的模块。')) {
  fail('stub 顶部缺少占位说明');
}
rmSync(legal.dir, { recursive: true, force: true });

const illegal = run(join(fx, 'gap-illegal.ir.json'));
if (illegal.status !== 2) fail(`非法 exposure 应退出码 2，实际 ${illegal.status}\n${illegal.stderr}`);
assertAbsent(illegal.out);
rmSync(illegal.dir, { recursive: true, force: true });

const emptyDir = mkdtempSync(join(tmpdir(), 'exposure-empty-'));
const emptyGap = join(emptyDir, 'gap.ir.json');
const gap = JSON.parse(readFileSync(join(fx, 'gap.ir.json'), 'utf8'));
const update = gap.items.find((item) => item.desiredId === 'updateThing');
if (!update) fail('合法夹具缺少 updateThing');
update.exposure = '';
writeFileSync(emptyGap, `${JSON.stringify(gap, null, 2)}\n`);
const empty = run(emptyGap);
if (empty.status !== 0) fail(`空字符串 exposure 应退出码 0，实际 ${empty.status}\n${empty.stderr}`);
const emptyUrl = pathToFileURL(join(empty.out, 'mcp-tools.stub.mjs'));
emptyUrl.searchParams.set('t', String(Date.now()));
const emptyMod = await import(emptyUrl.href);
const emptyNames = emptyMod.tools.map((tool) => tool.name);
if (emptyNames.join(',') !== 'listThings,getThing' || emptyNames.includes('updateThing')) {
  fail(`空字符串不应产生 updateThing 工具，实际 ${emptyNames.join(',')}`);
}
rmSync(empty.dir, { recursive: true, force: true });
rmSync(emptyDir, { recursive: true, force: true });
console.log('exposure ok');
