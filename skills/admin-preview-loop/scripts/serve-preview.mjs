#!/usr/bin/env node
/**
 * 一条命令离线起预览。只依赖 Node 18+。
 *
 * mock 挂在网络层，不在页面里。环境开关 APP_MODE=preview，默认关：
 * 不设或设成别的值时直接退出，不起服务。
 *
 *   APP_MODE=preview node skills/admin-preview-loop/scripts/serve-preview.mjs
 *   APP_MODE=preview node skills/admin-preview-loop/scripts/serve-preview.mjs --port 4173
 *   APP_MODE=preview node skills/admin-preview-loop/scripts/serve-preview.mjs --port 0
 *
 * 已登记的接口响应带 X-Preview-Mock: 1。
 * 未登记的 /api/* 返回 501，body 为 { "unmocked": true, "path": "..." }，不带该响应头。
 * 不用 599：Chrome 不认这个状态码，连接会挂住，截图等不到网络空闲。
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detail, facets, list } from '../fixtures/mock/handlers.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};

if (process.env.APP_MODE !== 'preview') {
  console.error('APP_MODE 不是 preview（默认关）。离线预览不会启动，网络层 mock 也不会挂上。');
  console.error('启动：APP_MODE=preview node skills/admin-preview-loop/scripts/serve-preview.mjs');
  process.exit(2);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const appDir = join(root, 'fixtures', 'preview-app');
const seed = JSON.parse(readFileSync(join(root, 'fixtures', 'mock', 'seed.json'), 'utf8'));

const routes = [
  { method: 'GET', test: (url) => url.pathname === '/api/insights', run: (url) => list(url, seed) },
  { method: 'GET', test: (url) => url.pathname === '/api/facets', run: (url) => facets(url, seed) },
  {
    method: 'GET',
    test: (url) => /^\/api\/insights\/[^/]+$/.test(url.pathname),
    run: (url) => detail(url, seed),
  },
];

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function sendJson(res, status, body, mocked) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (mocked) headers['x-preview-mock'] = '1';
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function fileFor(urlPath) {
  const rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.includes('\0')) return null;
  const full = resolve(appDir, `.${rel}`);
  const base = resolve(appDir);
  if (full !== base && !full.startsWith(base + sep)) return null;
  return full;
}

function serveStatic(req, res, url) {
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  let full = fileFor(url.pathname);
  if (!full) {
    res.writeHead(400);
    res.end('bad path');
    return;
  }
  if (url.pathname.endsWith('/')) full = join(full, 'index.html');
  if (existsSync(full) && statSync(full).isDirectory()) full = join(full, 'index.html');
  if (!existsSync(full) || !statSync(full).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': types[extname(full)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(full).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    const route = routes.find((item) => item.method === req.method && item.test(url));
    if (!route) {
      sendJson(res, 501, { unmocked: true, path: url.pathname }, false);
      return;
    }
    const body = route.run(url);
    if (body == null) {
      sendJson(res, 404, { error: 'not found', path: url.pathname }, true);
      return;
    }
    sendJson(res, 200, body, true);
    return;
  }
  serveStatic(req, res, url);
});

const port = Number(opt('--port') ?? 4173);
server.listen(port, '127.0.0.1', () => {
  const addr = server.address();
  console.log(`preview http://127.0.0.1:${addr.port}`);
});
