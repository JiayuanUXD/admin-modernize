#!/usr/bin/env node
/**
 * 合成 monorepo 的逻辑拆验收，以及在临时历史上跑 git filter-repo。
 * 三个拆仓信号都没有，演练停在仓内隔离。filter-repo 只改临时克隆。
 *
 *   node skills/admin-repo-split/scripts/drill-split.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '..', 'fixtures', 'synthetic-monorepo');

function fail(msg) {
  console.error(`✘ ${msg}`);
  process.exit(1);
}
function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    fail(`${cmd} ${args.join(' ')} 退出 ${result.status}`);
  }
  return result.stdout || '';
}
function walk(dir, rootDir = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, rootDir, out);
    else out.push(relative(rootDir, full).split('\\').join('/'));
  }
  return out;
}

const root = mkdtempSync(join(tmpdir(), 'split-drill-'));
cpSync(fixture, root, { recursive: true });
run('git', ['init', '-q', '-b', 'main'], root);
run('git', ['config', 'user.email', 'drill@example.invalid'], root);
run('git', ['config', 'user.name', 'drill'], root);
run('git', ['config', 'commit.gpgsign', 'false'], root);

function commit(message) {
  run('git', ['add', '-A'], root);
  run('git', ['commit', '-q', '-m', message], root);
}
commit('搭上契约、两侧目录、CODEOWNERS 和 CI');
run('node', ['-e', "require('fs').appendFileSync('apps/web/src/types.js', '\\n// web-only\\n')"], root);
commit('前端单独的一笔');
run('node', ['-e', "require('fs').appendFileSync('services/api/src/server.js', '\\n// api-only\\n')"], root);
commit('后端单独的一笔');

const readme = readFileSync(join(root, 'README.md'), 'utf8');
if (!readme.includes('仓内隔离') || !readme.includes('不进物理拆')) {
  fail('README 没有写明默认仓内隔离');
}
const contracts = walk(root).filter((rel) => rel.endsWith('openapi.json') || rel.endsWith('.proto'));
if (contracts.length !== 1 || contracts[0] !== 'contracts/openapi.json') {
  fail(`契约来源不是唯一：${contracts.join(', ')}`);
}
const types = readFileSync(join(root, 'apps/web/src/types.js'), 'utf8');
if (!types.includes('contracts/openapi.json')) fail('前端类型没有指向唯一契约');
const owners = readFileSync(join(root, 'CODEOWNERS'), 'utf8');
if (!owners.includes('/apps/web/') || !owners.includes('/services/api/')) fail('CODEOWNERS 没有覆盖两侧');
const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
if (!ci.includes('node apps/web/check.mjs') || !ci.includes('node services/api/check.mjs')) {
  fail('CI 没有拆成两个检查命令');
}

function isolated(side) {
  const dest = mkdtempSync(join(tmpdir(), `split-${side}-`));
  cpSync(join(root, side === 'web' ? 'apps/web' : 'services/api'), dest, { recursive: true });
  const result = spawnSync(process.execPath, ['check.mjs'], { cwd: dest, encoding: 'utf8' });
  rmSync(dest, { recursive: true, force: true });
  if (result.status !== 0) fail(`${side} 离开另一侧源码之后检查失败\n${result.stderr}`);
}
isolated('web');
isolated('api');
console.log('logical pass contract=1 owners=web,api ci_jobs=web,api isolated=web,api');
console.log('skip 跨仓契约测试：合成仓没有测试环境');
console.log('skip 原仓只读与分支保护：演练不进物理拆，临时目录跑完即删');

const before = Number(run('git', ['rev-list', '--count', 'HEAD'], root).trim());
if (before !== 3) fail(`合成历史应有 3 笔提交，实际 ${before}`);

const clone = mkdtempSync(join(tmpdir(), 'split-clone-'));
rmSync(clone, { recursive: true, force: true });
run('git', ['clone', '-q', root, clone], tmpdir());
const filtered = spawnSync('python3', [
  '-m', 'git_filter_repo',
  '--path', 'apps/web',
  '--path', 'contracts',
  '--path', 'CODEOWNERS',
  '--path', '.github',
], { cwd: clone, encoding: 'utf8' });
if (filtered.status !== 0) {
  process.stderr.write(filtered.stdout || '');
  process.stderr.write(filtered.stderr || '');
  fail(`git filter-repo 退出 ${filtered.status}。本环境用 python3 -m git_filter_repo`);
}
const after = Number(run('git', ['rev-list', '--count', 'HEAD'], clone).trim());
const files = run('git', ['ls-files'], clone).trim().split('\n').filter(Boolean);
const apiFiles = files.filter((rel) => rel.startsWith('services/api/'));
const webFiles = files.filter((rel) => rel === 'apps/web/check.mjs');
if (apiFiles.length !== 0) fail(`filter-repo 之后仍有后端文件：${apiFiles.join(', ')}`);
if (webFiles.length !== 1) fail('filter-repo 之后没有 apps/web/check.mjs');
if (!files.includes('contracts/openapi.json')) fail('filter-repo 之后没有契约');
if (!(after >= 1 && after < before)) fail(`提交数应从 ${before} 降下来，实际 ${after}`);
if (existsSync(join(root, 'services/api/src/server.js')) === false) fail('原演练目录被改掉了');

console.log(`FILTER_REPO tool=python3 -m git_filter_repo commits_before=${before} commits_after=${after} api_files=${apiFiles.length} web_check=1`);
rmSync(root, { recursive: true, force: true });
rmSync(clone, { recursive: true, force: true });
console.log('drill ok');
