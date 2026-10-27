#!/usr/bin/env node
/**
 * 断言：没有出处的接口进不了 gap-table。
 * 三条拒绝（期望空 sources、期望行号无效、实际没有 sources）不得写出文件。
 * 一条有出处的对照必须写出 gap。
 *
 *   node skills/admin-api-contract/scripts/assert-gap-sources.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, 'build-gap.mjs');
const fx = join(here, '..', 'fixtures', 'gap-no-source');
const phrase = '拒绝无出处的推测接口进入 gap-table';

function run(desired, actual) {
  const dir = mkdtempSync(join(tmpdir(), 'gap-sources-'));
  const out = join(dir, 'nested', 'gap.ir.json');
  const result = spawnSync(process.execPath, [
    build, '--desired', desired, '--actual', actual, '--out', out,
  ], { encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr || '', stdout: result.stdout || '', out, dir };
}

function reject(desiredName) {
  const desired = desiredName.startsWith('actual')
    ? join(fx, 'desired-ok.ir.json')
    : join(fx, desiredName);
  const actual = desiredName.startsWith('actual')
    ? join(fx, desiredName)
    : join(fx, 'actual-ok.ir.json');
  const result = run(desired, actual);
  if (result.status === 0) {
    console.error(`${desiredName} 应当失败`);
    process.exit(1);
  }
  if (existsSync(result.out)) {
    console.error(`${desiredName} 写出了 gap 文件`);
    process.exit(1);
  }
  if (!result.stderr.includes(phrase)) {
    console.error(`${desiredName} 的报错里没有红线用语\n${result.stderr}`);
    process.exit(1);
  }
  rmSync(result.dir, { recursive: true, force: true });
  console.log(`rejected ${desiredName}`);
}

reject('desired-no-source.ir.json');
reject('desired-bad-line.ir.json');
reject('actual-no-source.ir.json');

const ok = run(join(fx, 'desired-ok.ir.json'), join(fx, 'actual-ok.ir.json'));
if (ok.status !== 0) {
  console.error(ok.stderr);
  process.exit(ok.status || 1);
}
if (!existsSync(ok.out)) {
  console.error('有出处的对照没有写出 gap 文件');
  process.exit(1);
}
const gap = JSON.parse(readFileSync(ok.out, 'utf8'));
if (!Array.isArray(gap.items) || gap.items.length !== 1 || gap.items[0].status !== 'match') {
  console.error(`有出处的对照结果不对：${JSON.stringify(gap.items)}`);
  process.exit(1);
}
rmSync(ok.dir, { recursive: true, force: true });
console.log('accepted desired-ok.ir.json');
