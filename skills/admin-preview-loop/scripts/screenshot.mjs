#!/usr/bin/env node
/**
 * 截预览页：桌面 + 窄屏。等网络空闲和字体，再收集
 * 控制台 error、未捕获异常、失败请求、未被 mock 的请求。
 * 任一项存在则退出码 1。
 *
 *   node skills/admin-preview-loop/scripts/screenshot.mjs
 *   node skills/admin-preview-loop/scripts/screenshot.mjs --smoke-unmocked
 *
 * 不传 --base 时，本命令会用 APP_MODE=preview 拉起 serve-preview.mjs。
 * 漏 mock 冒烟访问 ?leak=1，页面会请求未登记的 /api/ops/health，退出码必须是 1。
 * 若冒烟没有收集到「未被 mock」，退出码 2（检测器坏了）。
 *
 * 依赖：npm install --no-save playwright
 * 优先用本机 Google Chrome（channel: chrome）。没有的话用 Playwright 自带 Chromium：
 *   npx playwright install --with-deps chromium
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const has = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};

const here = dirname(fileURLToPath(import.meta.url));
const outDir = opt('--out') || join(here, '..', 'fixtures', 'screenshots');
const smoke = has('--smoke-unmocked');

const viewports = [
  { id: 'desktop', width: 1280, height: 800 },
  { id: 'narrow', width: 390, height: 844 },
];

const scenarios = smoke
  ? [{ id: 'leak', path: '/?state=many&leak=1' }]
  : [
    { id: 'list-empty', path: '/?state=empty' },
    { id: 'list-many', path: '/?state=many' },
    { id: 'drawer-open', path: '/?state=many&open=ins-001' },
  ];

const shots = smoke ? viewports.filter((item) => item.id === 'desktop') : viewports;

function pathOf(url) {
  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('缺少 playwright。在仓库根目录执行：');
  console.error('  npm install --no-save playwright');
  console.error('  npx playwright install --with-deps chromium');
  process.exit(2);
}

let child = null;
async function baseUrl() {
  if (opt('--base')) return opt('--base').replace(/\/$/, '');
  const script = join(here, 'serve-preview.mjs');
  child = spawn(process.execPath, [script, '--port', '0'], {
    env: { ...process.env, APP_MODE: 'preview' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('预览服务 10s 内没有打印地址')), 10000);
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const matched = buf.match(/preview (http:\/\/127\.0\.0\.1:\d+)/);
      if (matched) {
        clearTimeout(timer);
        resolve(matched[1]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`预览服务退出 ${code}：${buf}`));
    });
  });
}

function stop() {
  if (child && !child.killed) child.kill('SIGTERM');
}

const issues = [];
const shotLogs = [];

try {
  const base = await baseUrl();
  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  let browser;
  let browserChannel = 'chromium';
  try {
    browser = await chromium.launch({ ...launchOpts, channel: 'chrome' });
    browserChannel = 'chrome';
  } catch (err) {
    console.error(`系统 Chrome 不可用（${err.message}），改用 Playwright 自带 Chromium`);
    browser = await chromium.launch(launchOpts);
  }
  try {
    mkdirSync(outDir, { recursive: true });
    for (const scenario of scenarios) {
      for (const viewport of shots) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          locale: 'zh-CN',
        });
        const page = await context.newPage();
        const local = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') local.push({ type: 'console', text: msg.text() });
        });
        page.on('pageerror', (err) => {
          local.push({ type: 'pageerror', text: String(err && err.message || err) });
        });
        page.on('requestfailed', (req) => {
          local.push({
            type: 'requestfailed',
            path: pathOf(req.url()),
            error: req.failure()?.errorText || '',
          });
        });
        page.on('response', (res) => {
          const target = pathOf(res.url());
          if (res.status() >= 400) local.push({ type: 'failed-request', path: target, status: res.status() });
          if (target.startsWith('/api/') && res.headers()['x-preview-mock'] !== '1') {
            local.push({ type: 'unmocked', path: target, status: res.status() });
          }
        });
        const url = base + scenario.path;
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.evaluate(async () => { await document.fonts.ready; });
        await page.waitForSelector('[data-preview-ready="1"]', { timeout: 5000 });
        await page.waitForLoadState('networkidle');
        const file = smoke ? null : `${scenario.id}-${viewport.id}.png`;
        if (file) await page.screenshot({ path: join(outDir, file) });
        shotLogs.push({
          file,
          scenario: scenario.id,
          viewport: viewport.id,
          path: scenario.path,
          issues: local,
        });
        issues.push(...local);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const unmocked = issues.filter((item) => item.type === 'unmocked');
  let exitCode = 0;
  if (smoke && unmocked.length === 0) exitCode = 2;
  else if (issues.length) exitCode = 1;

  const logName = smoke ? 'smoke-unmocked.json' : 'run-log.json';
  const log = {
    ok: exitCode === 0,
    exitCode,
    smoke,
    command: smoke
      ? 'node skills/admin-preview-loop/scripts/screenshot.mjs --smoke-unmocked'
      : 'node skills/admin-preview-loop/scripts/screenshot.mjs',
    node: process.version,
    browser: browserChannel,
    shots: shotLogs,
    issueCount: issues.length,
    unmockedCount: unmocked.length,
  };
  writeFileSync(join(outDir, logName), JSON.stringify(log, null, 2) + '\n');

  if (exitCode === 2) {
    console.error(`冒烟没有抓住漏 mock。日志 ${logName}`);
  } else if (exitCode === 1) {
    console.error(`截图检查失败：${issues.length} 项（未被 mock ${unmocked.length}）。日志 ${logName}`);
    for (const item of issues.slice(0, 12)) console.error(`  ${item.type} ${item.path || ''} ${item.status || ''} ${item.text || item.error || ''}`);
  } else {
    console.log(`截图完成：${shotLogs.length} 张，问题 0。目录 ${outDir}`);
  }
  stop();
  process.exit(exitCode);
} catch (err) {
  stop();
  console.error(`✘ ${err.message || err}`);
  process.exit(1);
}
