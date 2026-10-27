#!/usr/bin/env node
/**
 * 拓扑各验一次：本仓库（真实单仓）、合成全栈单仓、合成分仓。
 * 误判用例也锁住当前扫描结果，避免说明和脚本各说各的。
 *
 *   node skills/admin-recon/scripts/verify-topology.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const inventory = join(here, 'inventory.mjs');
const fixtures = join(here, '..', 'fixtures', 'topology');

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

function topo(paths) {
  const dir = mkdtempSync(join(tmpdir(), 'topo-out-'));
  const out = join(dir, 'topology.json');
  const result = spawnSync(process.execPath, [inventory, '--topology', ...paths, '--json', out], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || '');
    process.stderr.write(result.stdout || '');
    process.exit(result.status || 1);
  }
  const json = JSON.parse(readFileSync(out, 'utf8'));
  rmSync(dir, { recursive: true, force: true });
  return json.repos.map((repo) => ({
    name: repo.name,
    form: repo.form,
    role: repo.role,
    confidence: repo.confidence,
    detail: repo.detail || '',
  }));
}

function assertForm(label, repos, expectedForms) {
  const forms = repos.map((repo) => repo.form).sort();
  const want = [...expectedForms].sort();
  if (forms.length !== want.length || forms.some((form, i) => form !== want[i])) {
    console.error(`${label} 期望 ${want.join(',')} ，实际 ${forms.join(',') || '（空）'}`);
    console.error(JSON.stringify(repos, null, 2));
    process.exit(1);
  }
  const brief = repos.map((repo) => `${repo.name}:${repo.form}/${repo.confidence}`).join(' ');
  console.log(`pass ${label} ${brief}`);
}

function copyFixture(name) {
  const dest = mkdtempSync(join(tmpdir(), `topo-${name}-`));
  cpSync(join(fixtures, name), dest, { recursive: true });
  return dest;
}

const plugin = topo([repoRoot]);
assertForm('plugin-repo', plugin, ['unknown']);
if (plugin[0].confidence !== '低') {
  console.error(`本仓库置信度应变为低，实际 ${plugin[0].confidence}`);
  process.exit(1);
}

const pilot = topo([join(repoRoot, 'docs/pilots/dingdong-ux-radar-insights/pilot-source')]);
assertForm('pilot-source', pilot, ['unknown']);

const fullstack = topo([join(fixtures, 'single-fullstack')]);
assertForm('single-fullstack', fullstack, ['single-fullstack']);
if (fullstack[0].confidence !== '高') {
  console.error(`single-fullstack 置信度应为高，实际 ${fullstack[0].confidence}`);
  process.exit(1);
}
if (!fullstack[0].detail.includes('同仓同构建体系')) {
  console.error(`single-fullstack 拆仓难度文案变了：${fullstack[0].detail}`);
  process.exit(1);
}

const serverDir = topo([join(fixtures, 'server-dirname')]);
assertForm('server-dirname', serverDir, ['single-frontend']);

const javaFx = topo([join(fixtures, 'java-under-fixtures')]);
assertForm('java-under-fixtures', javaFx, ['single-frontend']);

const bare = copyFixture('split');
const bareRepos = topo([bare]);
assertForm('split-without-git', bareRepos, ['monorepo-frontend']);
rmSync(bare, { recursive: true, force: true });

const split = copyFixture('split');
git(join(split, 'web'), ['init', '-q']);
git(join(split, 'api'), ['init', '-q']);
const splitRepos = topo([split]);
assertForm('split-with-git', splitRepos, ['single-backend', 'single-frontend']);
rmSync(split, { recursive: true, force: true });

const nested = copyFixture('split');
git(nested, ['init', '-q']);
git(join(nested, 'web'), ['init', '-q']);
git(join(nested, 'api'), ['init', '-q']);
const nestedRepos = topo([nested]);
assertForm('parent-is-git', nestedRepos, ['monorepo-frontend']);
rmSync(nested, { recursive: true, force: true });

console.log('topology ok');
