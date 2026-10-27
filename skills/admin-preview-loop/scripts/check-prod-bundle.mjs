#!/usr/bin/env node
/**
 * 生产包不含 mock。
 * 只把 fixtures/preview-app 的静态文件收成一份包（不带 fixtures/mock，不带脚本），
 * 再搜 mock 特征。命中则退出码 1。
 *
 *   node skills/admin-preview-loop/scripts/check-prod-bundle.mjs
 *   node skills/admin-preview-loop/scripts/check-prod-bundle.mjs --self-test
 *
 * --self-test：干净包必须通过；再往包里写入种子标志，必须命中。
 * 自检两条都符合才退出 0。
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const selfTest = process.argv.includes('--self-test');
const root = fileURLToPath(new URL('..', import.meta.url));
const appDir = join(root, 'fixtures', 'preview-app');
const files = ['index.html', 'app.js', 'preview.css'];

const MARKERS = [
  'preview-loop-fixed-seed-v1',
  'X-Preview-Mock',
  'APP_MODE',
  'fixtures/mock',
];

function scan(dir) {
  const hits = [];
  const walk = (current) => {
    for (const name of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, name.name);
      if (name.isDirectory()) walk(full);
      else {
        let text;
        try { text = readFileSync(full, 'utf8'); } catch { continue; }
        for (const marker of MARKERS) {
          if (text.includes(marker)) hits.push({ file: name.name, marker });
        }
      }
    }
  };
  walk(dir);
  return hits;
}

const dir = mkdtempSync(join(tmpdir(), 'preview-bundle-'));
let code = 0;
try {
  for (const file of files) writeFileSync(join(dir, file), readFileSync(join(appDir, file)));
  const clean = scan(dir);
  if (clean.length) {
    console.error('生产包含 mock 特征：');
    for (const hit of clean) console.error(`  ${hit.file}  ${hit.marker}`);
    code = 1;
  } else if (!selfTest) {
    console.log('生产包检查通过：未发现 mock 特征（preview-app 三个静态文件）');
  } else {
    writeFileSync(join(dir, 'leaked-seed.txt'), 'preview-loop-fixed-seed-v1\n');
    const dirty = scan(dir);
    if (!dirty.some((hit) => hit.marker === 'preview-loop-fixed-seed-v1')) {
      console.error('自检失败：掺入种子标志后没有命中');
      code = 1;
    } else {
      console.log('自检通过：干净包无 mock 特征；掺入种子标志后能命中');
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
