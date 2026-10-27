#!/usr/bin/env node
/**
 * inventory：后台系统的只读摸底（技术栈无关，Node 18+，无依赖）。
 *
 * 回答四件事：这是什么栈、有多大、哪里在动、离「AI 能做对 / 能看见 / 能接后端」还有多远。
 * 数字都是静态扫描的近似值（正则、目录名、依赖名），用来定范围和指标基线，不是审计结论。
 * 只读：不写目标仓库，--json 只写你指定的路径。
 *
 * 用法
 *   node inventory.mjs <仓库路径> [--json <输出文件>]             完整盘点
 *   node inventory.mjs --topology <路径...> [--json <文件>]       只判拓扑
 *
 * 拓扑模式只回答「这是单仓还是分仓、前后端是否同仓、页面在不在服务端模板里」，
 * 因为拓扑决定隔离机制放在哪一层：同仓靠目录 + CODEOWNERS + CI job，分仓靠契约 + 发布顺序。
 * 判定给证据和置信度，不给二元结论。支持单个仓、多个仓路径，或含多个 git 仓的父目录。
 */
import { readdirSync, readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, relative, basename, dirname, extname, sep } from 'node:path';

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const jsonIdx = argv.indexOf('--json');
const jsonOut = jsonIdx >= 0 ? argv[jsonIdx + 1] : null;
const jsonValueIdx = jsonIdx >= 0 ? jsonIdx + 1 : -1;
const TOPOLOGY_ONLY = argv.includes('--topology');
const paths = argv
  .filter((a, i) => !a.startsWith('--') && i !== jsonValueIdx)
  .map((p) => resolve(p));
const USAGE = [
  '用法',
  '  node inventory.mjs <仓库路径> [--json <输出文件>]           完整盘点',
  '  node inventory.mjs --topology <路径...> [--json <文件>]     只判拓扑（单仓 / 分仓）',
].join('\n');
if (!paths.length || (jsonIdx >= 0 && !jsonOut)) {
  console.error(USAGE);
  process.exit(2);
}
for (const p of paths) {
  if (!existsSync(p) || !statSync(p).isDirectory()) {
    console.error(`✘ ${p} 不是目录`);
    process.exit(2);
  }
}
if (paths.length > 1 && !TOPOLOGY_ONLY) {
  console.error(`多路径只支持 --topology\n${USAGE}`);
  process.exit(2);
}
const ROOT = paths[0];

// ---------- 工具 ----------
const read = (abs) => { try { return readFileSync(abs, 'utf8'); } catch { return ''; } };
const posix = (abs) => relative(ROOT, abs).split(sep).join('/');
const stripJsonc = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"])\/\/[^\n]*/g, '$1');
const readJson = (abs, jsonc = false) => { try { const t = read(abs); return JSON.parse(jsonc ? stripJsonc(t) : t); } catch { return null; } };
const git = (...a) => { try { return execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 1 << 27, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const bump = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

// ---------- 依赖指纹（可自行补充） ----------
const KNOWN = {
  框架: { react: 'react', vue: 'vue', '@angular/core': 'angular', svelte: 'svelte', jquery: 'jquery', 'solid-js': 'solid', preact: 'preact' },
  UI库: { antd: 'antd', '@ant-design/pro-components': 'ant-design-pro', 'element-ui': 'element-ui', 'element-plus': 'element-plus', 'ant-design-vue': 'ant-design-vue', '@arco-design/web-react': 'arco-react', '@arco-design/web-vue': 'arco-vue', 'naive-ui': 'naive-ui', vuetify: 'vuetify', '@mui/material': 'mui', '@chakra-ui/react': 'chakra', bootstrap: 'bootstrap', 'bootstrap-vue': 'bootstrap-vue', 'view-design': 'iview', iview: 'iview', vant: 'vant', '@ddfe/dd-design': 'dd-design' },
  构建: { vite: 'vite', webpack: 'webpack', '@vue/cli-service': 'vue-cli', 'react-scripts': 'cra', umi: 'umi', '@umijs/max': 'umi-max', next: 'next', nuxt: 'nuxt', rollup: 'rollup', parcel: 'parcel', gulp: 'gulp', grunt: 'grunt' },
  路由: { 'react-router-dom': 'react-router', 'react-router': 'react-router', 'vue-router': 'vue-router', '@tanstack/react-router': 'tanstack-router' },
  状态: { redux: 'redux', '@reduxjs/toolkit': 'redux-toolkit', recoil: 'recoil', mobx: 'mobx', zustand: 'zustand', pinia: 'pinia', vuex: 'vuex', jotai: 'jotai', dva: 'dva', '@ngrx/store': 'ngrx' },
  请求: { axios: 'axios', 'umi-request': 'umi-request', ky: 'ky', swr: 'swr', '@tanstack/react-query': 'react-query', 'vue-request': 'vue-request', superagent: 'superagent', '@apollo/client': 'apollo', 'dd-fetch': 'dd-fetch' },
  微前端: { qiankun: 'qiankun', 'single-spa': 'single-spa', '@module-federation/enhanced': 'module-federation', wujie: 'wujie', '@micro-zoe/micro-app': 'micro-app' },
  国际化: { 'react-intl': 'react-intl', i18next: 'i18next', 'react-i18next': 'react-i18next', 'vue-i18n': 'vue-i18n', '@rosetta/react-intl': 'rosetta' },
  样式: { tailwindcss: 'tailwind', sass: 'sass', less: 'less', stylus: 'stylus', 'styled-components': 'styled-components', '@emotion/react': 'emotion', unocss: 'unocss' },
  测试: { jest: 'jest', vitest: 'vitest', cypress: 'cypress', playwright: 'playwright', '@playwright/test': 'playwright', puppeteer: 'puppeteer', '@testing-library/react': 'testing-library' },
  mock: { msw: 'msw', mockjs: 'mockjs', 'json-server': 'json-server', 'vite-plugin-mock': 'vite-plugin-mock', '@faker-js/faker': 'faker', faker: 'faker', miragejs: 'mirage', 'axios-mock-adapter': 'axios-mock-adapter' },
  契约工具: { 'openapi-typescript': 'openapi-typescript', 'swagger-typescript-api': 'swagger-typescript-api', orval: 'orval', '@openapitools/openapi-generator-cli': 'openapi-generator', '@graphql-codegen/cli': 'graphql-codegen', '@hey-api/openapi-ts': 'hey-api', 'ts-proto': 'ts-proto', zod: 'zod', ajv: 'ajv', yup: 'yup', valibot: 'valibot', '@sinclair/typebox': 'typebox' },
  质量: { eslint: 'eslint', stylelint: 'stylelint', prettier: 'prettier', typescript: 'typescript', husky: 'husky', 'lint-staged': 'lint-staged' },
};

// ---------- 文件清单 ----------
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', '.output', '.cache', '.turbo', '.idea', '.vscode', '.svn', '__pycache__']);
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out); }
    else out.push(join(dir, e.name));
  }
  return out;
};
const CODE = new Set(['js', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'mjs', 'cjs']);
const STYLE = new Set(['css', 'scss', 'sass', 'less', 'styl']);
const MARKUP = new Set(['html', 'htm', 'jsp', 'php', 'ftl', 'vm', 'erb', 'ejs', 'hbs', 'pug', 'cshtml']);
const SERVER_TPL = new Set(['jsp', 'php', 'ftl', 'vm', 'erb', 'cshtml']);
const vendorish = /(^|\/)(vendor|vendors|third[-_]?party|plugins?|libs?)\//i;
const has = (rel) => existsSync(join(ROOT, rel));
const entry = (rel) => ({ abs: join(ROOT, rel), rel, ext: extname(rel).slice(1).toLowerCase(), name: basename(rel) });

// ---------- 拓扑扫描 ----------
// 只判形态和给证据，不替人做决定。拿不准时输出 unknown，不硬猜。
const BE_BUILD = new Set(['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts', 'go.mod', 'Cargo.toml', 'requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py', 'manage.py', 'composer.json', 'Gemfile', 'mix.exs']);
const BE_DEPS = { express: 'express', koa: 'koa', '@nestjs/core': 'nest', fastify: 'fastify', egg: 'egg', '@hapi/hapi': 'hapi', '@midwayjs/core': 'midway', sails: 'sails', '@strapi/strapi': 'strapi' };
const BE_CODE = new Set(['java', 'kt', 'go', 'rs', 'scala', 'cs']);
const SCRIPT_CODE = new Set(['py', 'rb', 'php']);
const TOPO_ADVICE = {
  'multi-repo': '分仓：契约是否唯一来源、跨仓联调怎么做，比拆不拆更重要；两端独立 CI，按发布顺序上线',
  'monorepo-fullstack': '前后端同仓：先冻结契约，再「逻辑拆 → 物理拆」，不要先动物理目录',
  'single-fullstack': '单应用前后端同仓：契约先行再拆仓；删掉后端依赖后前端才能独立发布',
  'monorepo-frontend': '纯前端 monorepo：按子包边界选试点，直接进阶段 1；另一端可能在别的仓，先确认',
  'single-frontend': '纯前端单仓：直接进阶段 1；另一端可能在别的仓，先确认',
  'single-backend': '纯后端仓：前端页面不在这里，先把契约产物补上，再扫前端仓',
  'server-rendered': '页面在服务端模板里：迁移走路由级替换，不进「原地改」通道；先建页面清单',
  unknown: '信号不足：先确认仓库边界（是否只含一个应用），再决定隔离方式',
};
const TOPO_ROLE = { 'monorepo-frontend': '前端', 'single-frontend': '前端', 'monorepo-backend': '后端', 'single-backend': '后端', 'monorepo-fullstack': '全栈', 'single-fullstack': '全栈', 'server-rendered': '服务端渲染', 'multi-repo': '多仓容器', unknown: '未知' };
const topoTable = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

// 拓扑用浅扫描（6 层）：够看到 workspace、子包、构建文件、src/main/java 和模板，又不读文件内容
const quickWalk = (root, maxDepth) => {
  const out = [];
  const rec = (dir, depth) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
        if (depth > 0) rec(join(dir, e.name), depth - 1);
      } else out.push(join(dir, e.name));
    }
  };
  rec(root, maxDepth);
  return out;
};

// 父目录下是独立 git 仓 = 分仓容器。根目录本身有 .git 时不算容器（那是子模块，另说）
const childGitRepos = (root) => {
  if (existsSync(join(root, '.git'))) return [];
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name) && existsSync(join(root, e.name, '.git')))
    .map((e) => join(root, e.name));
};

const readWorkspace = (root, pkg) => {
  for (const f of ['pnpm-workspace.yaml', 'pnpm-workspace.yml']) {
    if (!existsSync(join(root, f))) continue;
    const block = read(join(root, f)).split(/^packages:\s*$/m)[1] || '';
    const patterns = [...block.matchAll(/^\s*-\s*['"]?([^'"\n#]+?)['"]?\s*$/gm)].map((m) => m[1].trim());
    return { tool: 'pnpm', file: f, patterns: patterns.slice(0, 12) };
  }
  if (pkg?.workspaces) {
    const list = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages || [];
    return { tool: 'npm/yarn', file: 'package.json#workspaces', patterns: list.slice(0, 12) };
  }
  for (const [f, tool] of [['lerna.json', 'lerna'], ['nx.json', 'nx'], ['turbo.json', 'turbo'], ['rush.json', 'rush']]) {
    if (!existsSync(join(root, f))) continue;
    const cfg = f === 'lerna.json' ? readJson(join(root, f)) : null;
    return { tool, file: f, patterns: (cfg?.packages || []).slice(0, 12) };
  }
  return null;
};

const detectTopo = (root) => {
  const files = quickWalk(root, 6);
  const rel = (abs) => relative(root, abs).split(sep).join('/');
  const pkg = readJson(join(root, 'package.json')) || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  const evidence = [];
  const flags = {};

  // 结构：workspace 与子包
  const workspace = readWorkspace(root, pkg);
  if (workspace) evidence.push(['workspace', `${workspace.file}${workspace.patterns.length ? `（${workspace.patterns.join('、')}）` : ''}`]);
  const pkgDirs = [...new Set(files
    .filter((f) => basename(f) === 'package.json' && dirname(f) !== root)
    .map((f) => dirname(f))
    .filter((d) => !/(^|\/)(fixtures?|examples?|testdata|demos?|__tests__)\//.test(`${rel(d)}/`)))];
  const packages = pkgDirs.map((dir) => {
    const p = readJson(join(dir, 'package.json')) || {};
    const d = { ...p.dependencies, ...p.devDependencies };
    const fe = Object.keys(KNOWN.框架).some((k) => d[k]) || Object.keys(KNOWN.构建).some((k) => d[k]);
    const be = Object.keys(BE_DEPS).some((k) => d[k]);
    return { path: rel(dir), name: p.name || basename(dir), kind: fe && !be ? '前端' : be && !fe ? '后端' : fe && be ? '全栈' : '共享/工具' };
  }).sort((a, b) => a.path.localeCompare(b.path));
  if (packages.length) evidence.push(['子包', `${packages.length} 个：${packages.slice(0, 6).map((p) => `${p.path}（${p.kind}）`).join('、')}${packages.length > 6 ? '…' : ''}`]);

  // 前端
  const frameworks = [...new Set(Object.entries(KNOWN.框架).filter(([d]) => deps[d]).map(([, label]) => label))];
  const feFiles = files.filter((f) => /\.(tsx|jsx|vue|svelte|astro)$/.test(f)).length;
  const hasFE = frameworks.length > 0 || feFiles > 0;
  if (frameworks.length) evidence.push(['前端框架', frameworks.join('、')]);
  else if (feFiles) evidence.push(['前端信号', `${feFiles} 个组件/页面文件`]);

  // 后端
  const buildFiles = files.filter((f) => BE_BUILD.has(basename(f)));
  const serverLibs = Object.keys(BE_DEPS).filter((d) => deps[d]);
  const beCode = files.filter((f) => BE_CODE.has(extname(f).slice(1).toLowerCase()));
  const scriptCode = files.filter((f) => SCRIPT_CODE.has(extname(f).slice(1).toLowerCase()));
  const hasBE = buildFiles.length > 0 || serverLibs.length > 0 || beCode.length >= 5;
  if (buildFiles.length) evidence.push(['后端构建文件', `${buildFiles.length} 个：${buildFiles.slice(0, 3).map(rel).join('、')}`]);
  if (serverLibs.length) evidence.push(['后端框架依赖', serverLibs.map((d) => BE_DEPS[d]).join('、')]);
  if (beCode.length >= 5 && !buildFiles.length) evidence.push(['后端代码', `JVM/Go/Rust ${beCode.length} 个文件`]);
  if (scriptCode.length >= 5 && !hasBE) evidence.push(['脚本信号', `py/rb/php ${scriptCode.length} 个文件（不等于后端，未计入）`]);

  // 页面在不在服务端模板里
  const tpl = files.filter((f) => SERVER_TPL.has(extname(f).slice(1).toLowerCase()));
  flags.serverTemplates = tpl.length;
  if (tpl.length) evidence.push(['服务端模板', `${tpl.length} 个（${[...new Set(tpl.map((f) => extname(f).slice(1).toLowerCase()))].join('、')}）`]);

  // 微前端与契约
  const mf = [...new Set(Object.entries(KNOWN.微前端).filter(([d]) => deps[d]).map(([, label]) => label))];
  flags.microFrontend = mf.length > 0;
  if (mf.length) evidence.push(['微前端', mf.join('、')]);
  const contracts = files.filter((f) => /(openapi|swagger)[^/]*\.(ya?ml|json)$/i.test(basename(f)) || /\.(proto|graphql|gql)$/i.test(f));
  if (contracts.length) evidence.push(['契约产物', `${contracts.length} 个：${contracts.slice(0, 4).map(rel).join('、')}`]);

  const containers = childGitRepos(root);
  if (containers.length) evidence.push(['子目录是独立 git 仓', containers.map((c) => basename(c)).join('、')]);

  // 形态
  const multiPkg = packages.length >= 2 || Boolean(workspace);
  const fullstack = hasFE && hasBE;
  let form = 'unknown';
  if (containers.length >= 2) form = 'multi-repo';
  else if (flags.serverTemplates >= 10 && !hasFE) form = 'server-rendered';
  else if (multiPkg && fullstack) form = 'monorepo-fullstack';
  else if (multiPkg && hasFE) form = 'monorepo-frontend';
  else if (multiPkg && hasBE) form = 'monorepo-backend';
  else if (fullstack) form = 'single-fullstack';
  else if (hasFE) form = 'single-frontend';
  else if (hasBE) form = 'single-backend';

  // 置信度：结构证据（workspace / 构建文件 / 子包 / 容器 / 模板）或两端明确的依赖证据
  const strong = [
    workspace && 'workspace',
    packages.length >= 2 && '多子包',
    buildFiles.length && '后端构建文件',
    serverLibs.length && '后端框架依赖',
    beCode.length >= 5 && '后端代码',
    tpl.length >= 10 && '服务端模板',
    containers.length >= 2 && '子目录是独立 git 仓',
    frameworks.length && '前端框架依赖',
  ].filter(Boolean);
  const confidence = form === 'unknown' ? '低' : strong.length >= 2 ? '高' : '中';

  // 拆仓难度：同构建体系比「只是放在一个 git 里」贵
  const detail = containers.length >= 2 ? '已是分仓'
    : workspace ? '同仓同构建体系：拆仓要改 workspace 与构建配置'
      : hasFE && hasBE && buildFiles.length ? '同仓两套构建（前端 npm + 后端构建文件）：物理拆分最便宜'
        : hasFE && hasBE ? '同仓同构建体系（Node 全栈）'
          : '';

  const next = form === 'multi-repo' ? '对每个子仓单独跑 node inventory.mjs <子仓路径>'
    : form === 'single-frontend' || form === 'single-backend' ? 'node inventory.mjs --topology <父目录或另一个仓>，确认分仓与另一端位置'
      : `node inventory.mjs ${root}`;

  return {
    name: basename(root), path: root, form, role: TOPO_ROLE[form] || '未知', confidence, detail,
    evidence: evidence.map(([kind, detailText]) => ({ kind, detail: detailText })),
    flags, workspace, packages, contracts: contracts.map(rel),
    containerPaths: containers,
    counts: { files: files.length, frontendFiles: feFiles, backendCode: beCode.length, templates: tpl.length, packages: packages.length },
    advice: TOPO_ADVICE[form] || TOPO_ADVICE.unknown, next,
  };
};

const printTopo = (reps) => {
  const out = [];
  if (reps.length === 1) {
    const r = reps[0];
    out.push(`# 拓扑：${r.name}`, '');
    out.push(`- 形态：${r.form}（${r.role}）`, `- 置信度：${r.confidence}`);
    if (r.detail) out.push(`- 拆仓难度：${r.detail}`);
    out.push('', '## 判定依据');
    if (r.evidence.length) out.push(...r.evidence.map((e) => `- ${e.kind}：${e.detail}`));
    else out.push('- 没有找到可用信号');
    out.push('', '## 规模与标志');
    out.push(`- 浅扫描（≤6 层）文件 ${r.counts.files} 个；组件/页面文件 ${r.counts.frontendFiles} 个；后端代码 ${r.counts.backendCode} 个；子包 ${r.counts.packages} 个`);
    out.push(`- 服务端模板 ${r.flags.serverTemplates} 个；微前端 ${r.flags.microFrontend ? '是' : '否'}；契约产物 ${r.contracts.length} 个`);
    out.push('', '## 建议', `- ${r.advice}`, `- 下一步：${r.next}`);
  } else {
    const roles = reps.reduce((m, r) => m.set(r.role, (m.get(r.role) || 0) + 1), new Map());
    out.push(`# 拓扑：分仓（${reps.length} 个仓）`, '');
    out.push(`- 角色分布：${[...roles].map(([k, v]) => `${k} ${v}`).join('、')}`);
    out.push(`- 契约产物：${reps.filter((r) => r.contracts.length).length} 个仓有；${reps.filter((r) => !r.contracts.length).length} 个仓没有`);
    out.push('', topoTable(['仓', '角色', '形态', '置信度', '契约', '服务端模板'], reps.map((r) => [r.name, r.role, r.form, r.confidence, r.contracts.length || '—', r.flags.serverTemplates || '—'])));
    out.push('', '## 建议');
    if (reps.filter((r) => r.contracts.length).length >= 2) out.push('- 契约产物分散在多个仓：先定唯一来源，其余仓由它生成，不要手工维护两份');
    else out.push('- 契约产物缺失：先补契约（OpenAPI / proto / 类型文件），再谈联调与发布顺序');
    out.push('- 跨仓要定发布顺序：前端先发兼容旧接口，后端后发；契约版本进 CI');
    out.push('- 每个仓单独跑 node inventory.mjs <仓路径> 出完整盘点');
  }
  return out.join('\n');
};

const ROOT_TOPO = detectTopo(ROOT);

// 只判拓扑：不进完整扫描，支持多路径和分仓父目录
if (TOPOLOGY_ONLY) {
  const reps = [];
  for (const p of paths) {
    const t = detectTopo(p);
    if (t.form === 'multi-repo' && t.containerPaths.length) for (const c of t.containerPaths) reps.push(detectTopo(c));
    else reps.push(t);
  }
  const uniq = [...new Map(reps.map((r) => [r.path, r])).values()];
  console.log(printTopo(uniq));
  if (jsonOut) {
    writeFileSync(resolve(jsonOut), JSON.stringify({ mode: 'topology', repos: uniq }, null, 2) + '\n');
    console.error(`拓扑已写入 ${resolve(jsonOut)}`);
  }
  process.exit(0);
}

// 完整盘点扫到分仓父目录时，把多个仓加起来没有意义：直接把拓扑报告交出去
if (ROOT_TOPO.form === 'multi-repo') {
  console.log(printTopo([ROOT_TOPO]));
  console.log('\n> 这是分仓父目录（子目录是独立 git 仓），不是一个仓库。分别盘点，或加子仓路径再跑 --topology。');
  process.exit(0);
}

// 在 git 仓库里按 git 的口径列文件（已跟踪 + 未跟踪但没被 .gitignore 忽略），避免把构建产物、报告目录算进去
const listed = git('ls-files', '-z', '--cached', '--others', '--exclude-standard');
const all = listed
  ? listed.split('\0').filter((rel) => rel && existsSync(join(ROOT, rel)) && !rel.split('/').some((s) => SKIP_DIRS.has(s))).map(entry)
  : walk(ROOT).map((abs) => entry(posix(abs)));

// ---------- package.json ----------
const pkg = readJson(join(ROOT, 'package.json')) || {};
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const stack = {};
for (const [group, table] of Object.entries(KNOWN)) {
  const found = [...new Set(Object.entries(table).filter(([d]) => deps[d]).map(([d, label]) => `${label}@${String(deps[d]).replace(/^[\^~]/, '')}`))];
  stack[group] = found;
}
if (Object.keys(deps).some((d) => d.startsWith('@storybook/'))) stack['质量'].push('storybook');
const vueMajor = deps.vue ? Number(String(deps.vue).replace(/^\D*/, '').split('.')[0]) : null;

// ---------- 页面目录 ----------
// 页面目录：路径前 4 级里名为 pages/views/routes/screens/modules 的目录，取文件最多的；都没有再退到 app
const PAGE_NAMES = new Set(['pages', 'views', 'routes', 'screens', 'modules']);
const pageDirCount = new Map();
for (const f of all) {
  if (!(CODE.has(f.ext) || MARKUP.has(f.ext))) continue;
  const segs = f.rel.split('/');
  for (let i = 0; i < Math.min(segs.length - 1, 4); i++) {
    if (PAGE_NAMES.has(segs[i].toLowerCase())) { bump(pageDirCount, segs.slice(0, i + 1).join('/')); break; }
  }
}
const pageDir = [...pageDirCount].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] || (has('src/app') ? 'src/app' : has('app') ? 'app' : null);
const areaOf = (rel) => (rel.startsWith('src/') ? rel.split('/').slice(0, 2).join('/') : rel.includes('/') ? rel.split('/')[0] : '(root)');
const moduleOf = (rel) => {
  if (!pageDir || !rel.startsWith(`${pageDir}/`)) return null;
  const seg = rel.slice(pageDir.length + 1).split('/')[0];
  return seg.includes('.') ? '(root)' : seg; // 直接放在页面目录下的文件
};
const inComponents = (rel) => /(^|\/)components?(\/|$)/i.test(rel);

// ---------- 单遍扫描 ----------
const byExt = new Map();
const hex = new Map();
const fonts = new Map();
const hexFiles = new Map();
const req = { axios: 0, fetch: 0, jqueryAjax: 0, xhr: 0, hooks: 0 };
const sig = { vendored: 0, tooLarge: 0, inlineStyle: 0, important: 0, viewportMath: 0, jqueryFiles: 0, cssVarUses: 0, routeEntries: 0, apiFiles: 0, apiFilesNoTypes: 0, apiAny: 0 };
const mods = new Map();
const modRow = (m) => { if (!mods.has(m)) mods.set(m, { module: m, pages: 0, loc: 0, churn90d: 0 }); return mods.get(m); };
let loc = 0, textFiles = 0, pageFiles = 0, pageFilesWithRequest = 0;

const RE = {
  hex: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
  inline: /style\s*=\s*(\{\{|["'])|:style\s*=|\[style[.\]]/,
  fontCss: /font-size\s*:\s*(\d+(?:\.\d+)?)px/g,
  fontJs: /fontSize\s*:\s*['"]?(\d+)/g,
  jquery: /(^|[^\w$.])(\$\(|\$\.(ajax|get|post|getJSON|each|extend|fn)\b|jQuery[.(])|['"]jquery['"]/,
  axios: /\baxios(\.(get|post|put|delete|patch|request)|\()/,
  fetch: /(^|[^\w.])fetch\(/,
  ajax: /\$\.(ajax|get|post|getJSON)\(|jQuery\.(ajax|get|post)\(/,
  xhr: /new XMLHttpRequest/,
  hooks: /\b(useRequest|useQuery|useSWR|useMutation)\(/,
};
// api 声明类文件（类型应写在这里）与请求封装文件（只转发，类型从 api 引入）分开统计
const apiDecl = /(^|\/)(api|apis|service|services)(\/|\.[tj]sx?$)/i;
const wrapperName = /^(request|http|fetch|axios|ajax|client)\.(ts|tsx|js|jsx)$/i;
const httpLibs = ['axios', 'umi-request', 'ky', 'superagent', 'dd-fetch'].filter((d) => deps[d]);
const importsHttpLib = (raw) => httpLibs.some((d) => raw.includes(`from '${d}'`) || raw.includes(`from "${d}"`) || raw.includes(`require('${d}')`) || raw.includes(`require("${d}")`));

for (const f of all) {
  const isText = CODE.has(f.ext) || STYLE.has(f.ext) || MARKUP.has(f.ext);
  if (!isText) continue;
  const row = byExt.get(f.ext) || { files: 0, loc: 0 };
  row.files++;
  byExt.set(f.ext, row);
  if (/\.min\.(js|css)$/.test(f.rel) || f.rel.endsWith('.d.ts')) continue;
  // 第三方目录和点开头的目录（如 src/.lib 这类内置框架）不算业务代码，不进入 UI / 数据层统计
  if (vendorish.test(f.rel) || /(^|\/)\.[^/]+\//.test(f.rel)) { sig.vendored++; continue; }
  let size = 0;
  try { size = statSync(f.abs).size; } catch { /* 忽略 */ }
  if (size > 2 * 1024 * 1024) { sig.tooLarge++; continue; }
  const raw = read(f.abs);
  const lines = raw.split('\n');
  row.loc += lines.length;
  loc += lines.length;
  textFiles++;
  const mod = moduleOf(f.rel);
  if (mod) modRow(mod).loc += lines.length;

  const isCode = CODE.has(f.ext);
  const inPages = pageDir && f.rel.startsWith(`${pageDir}/`) && !inComponents(f.rel);
  let fileHasRequest = false, fileHasJquery = false;
  const isApiDecl = /^(ts|tsx)$/.test(f.ext) && apiDecl.test(f.rel);
  if (isApiDecl) {
    sig.apiFiles++;
    if (!/\b(interface|type)\s+\w+/.test(raw)) sig.apiFilesNoTypes++;
  }
  if (isApiDecl || (isCode && wrapperName.test(f.name))) sig.apiAny += (raw.match(/:\s*any\b|<any>|\bas any\b/g) || []).length;
  if (inPages && isCode && importsHttpLib(raw)) fileHasRequest = true;
  if (isCode && /rout/i.test(f.rel)) sig.routeEntries += (raw.match(/\bpath\s*:\s*['"]/g) || []).length;

  for (const line of lines) {
    if (!/href\s*=|url\(/.test(line)) for (const m of line.matchAll(RE.hex)) {
      let c = m[0].toLowerCase();
      if (c.length === 4) c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
      bump(hex, c); bump(hexFiles, f.rel);
    }
    if (RE.inline.test(line)) sig.inlineStyle++;
    if (line.includes('!important')) sig.important++;
    if (/innerHeight\s*-|100vh\s*-/.test(line)) sig.viewportMath++;
    if (line.includes('var(--')) sig.cssVarUses++;
    for (const m of line.matchAll(RE.fontCss)) bump(fonts, `${Number(m[1])}px`);
    for (const m of line.matchAll(RE.fontJs)) bump(fonts, `${Number(m[1])}px`);
    if (!STYLE.has(f.ext)) {
      if (RE.jquery.test(line)) fileHasJquery = true;
      if (RE.axios.test(line)) { req.axios++; fileHasRequest = true; }
      if (RE.fetch.test(line)) { req.fetch++; fileHasRequest = true; }
      if (RE.ajax.test(line)) { req.jqueryAjax++; fileHasRequest = true; }
      if (RE.xhr.test(line)) { req.xhr++; fileHasRequest = true; }
      if (RE.hooks.test(line)) { req.hooks++; }
    }
  }
  if (fileHasJquery) sig.jqueryFiles++;
  if (inPages && (isCode || MARKUP.has(f.ext))) { pageFiles++; if (fileHasRequest) pageFilesWithRequest++; }
}

// ---------- 页面估计 ----------
const pageList = [];
if (pageDir) {
  const under = all.filter((f) => f.rel.startsWith(`${pageDir}/`) && !inComponents(f.rel));
  const vueLike = under.some((f) => f.ext === 'vue');
  if (vueLike) pageList.push(...under.filter((f) => f.ext === 'vue').map((f) => f.rel));
  else pageList.push(...under.filter((f) => /^index\.(tsx|jsx|ts|js)$/.test(f.name) || MARKUP.has(f.ext)).map((f) => f.rel));
  const keys = new Set(pageList.map((r) => r.replace(/\/index\.\w+$/, '')));
  const nested = (r) => { const k = r.replace(/\/index\.\w+$/, ''); const parts = k.split('/'); return parts.some((_, i) => i > pageDir.split('/').length && keys.has(parts.slice(0, i).join('/'))); };
  const pages = pageList.filter((r) => !nested(r));
  pageList.length = 0;
  pageList.push(...pages);
  for (const r of pageList) { const m = moduleOf(r); if (m) modRow(m).pages++; }
}

// ---------- git ----------
const inGit = git('rev-parse', '--is-inside-work-tree')?.trim() === 'true';
let gitInfo = null;
if (inGit) {
  const lines = (git('log', '--since=90.days', '--name-only', '--pretty=format:') || '').split('\n').filter(Boolean);
  const hotAreas = new Map();
  for (const rel of lines) {
    const m = moduleOf(rel);
    bump(hotAreas, m ? `${pageDir}/${m}` : areaOf(rel));
    if (m) modRow(m).churn90d++;
  }
  const rootCommits = (git('log', '--max-parents=0', '--format=%cs') || '').trim().split('\n').filter(Boolean);
  gitInfo = {
    commits: Number((git('rev-list', '--count', 'HEAD') || '0').trim()),
    firstCommit: rootCommits[rootCommits.length - 1] || null,
    lastCommit: (git('log', '-1', '--format=%cs') || '').trim() || null,
    commits90d: Number((git('rev-list', '--count', '--since=90.days', 'HEAD') || '0').trim()),
    authors90d: (git('shortlog', '-sn', '--since=90.days', 'HEAD') || '').split('\n').filter(Boolean).length,
    hotAreas: top(hotAreas, 8).map(([area, changes]) => ({ area, changes })),
  };
}

// ---------- AI 就绪度信号 ----------
const firstExisting = (list) => list.filter(has);
const entryFiles = firstExisting(['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.cursorrules', '.cursor/rules', '.windsurfrules', '.github/copilot-instructions.md', '.claude/skills', '.claude/commands']);
const lintConfigs = all.filter((f) => /^(\.?eslintrc(\..+)?|eslint\.(config\.)?\w+|\.?stylelintrc(\..+)?|stylelint\.config\.\w+|\.?prettierrc(\..+)?|prettier\.config\.\w+|commitlint\.config\.\w+)$/.test(f.name) && !/\.(md|log|txt)$/.test(f.name) && f.rel.split('/').length <= 3 && !vendorish.test(f.rel)).map((f) => f.rel);
const tsconfig = readJson(join(ROOT, 'tsconfig.json'), true);
const tokenFiles = all.filter((f) => /(^|\/)([\w-]*(tokens?|theme|variables|vars|palette|brand)[\w-]*)\.(ts|js|scss|less|css|json)$/i.test(f.rel) && !vendorish.test(f.rel)).map((f) => f.rel);
const compDirs = ['src/components', 'src/component', 'src/common', 'src/shared', 'src/ui', 'components'].filter(has).map((d) => ({ dir: d, files: all.filter((f) => f.rel.startsWith(`${d}/`)).length }));
const testFiles = all.filter((f) => /\.(test|spec)\.\w+$/.test(f.name) || /(^|\/)(e2e|cypress|__tests__)\//.test(f.rel)).length;
const mockDirs = all.map((f) => f.rel).filter((r) => /(^|\/)(mocks?|__mocks__|fixtures|stubs)\//i.test(r) && r.split('/').length <= 5).map((r) => r.split('/').slice(0, r.split('/').findIndex((s) => /^(mocks?|__mocks__|fixtures|stubs)$/i.test(s)) + 1).join('/'));
const mockDirList = [...new Set(mockDirs)].slice(0, 5);
const scripts = Object.keys(pkg.scripts || {}).filter((s) => /mock|proto|preview|story|e2e|lint|test|type|check|tsc/i.test(s));
const schemaFiles = all.filter((f) => (/(openapi|swagger)[^/]*\.(ya?ml|json)$/i.test(f.name) || /\.(proto|graphql|gql)$/.test(f.name)) && f.rel.split('/').length <= 5).map((f) => f.rel);
const wrappers = all.filter((f) => /^(request|http|fetch|axios|ajax|client)\.(ts|js|tsx|jsx)$/i.test(f.name) && !vendorish.test(f.rel)).map((f) => f.rel);

// ---------- 汇总 ----------
const tsFiles = (byExt.get('ts')?.files || 0) + (byExt.get('tsx')?.files || 0);
const jsFiles = (byExt.get('js')?.files || 0) + (byExt.get('jsx')?.files || 0);
const serverTpl = [...SERVER_TPL].reduce((s, e) => s + (byExt.get(e)?.files || 0), 0);
const modules = [...mods.values()].sort((a, b) => b.pages - a.pages || b.loc - a.loc);
const profile = {
  repo: basename(ROOT),
  path: ROOT,
  topology: {
    form: ROOT_TOPO.form, role: ROOT_TOPO.role, confidence: ROOT_TOPO.confidence, detail: ROOT_TOPO.detail,
    workspace: ROOT_TOPO.workspace, packages: ROOT_TOPO.packages, flags: ROOT_TOPO.flags,
    contracts: ROOT_TOPO.contracts, evidence: ROOT_TOPO.evidence, advice: ROOT_TOPO.advice,
  },
  stack: { ...stack, vue大版本: vueMajor },
  language: { ts: tsFiles, js: jsFiles, vue: byExt.get('vue')?.files || 0, tsconfig: tsconfig ? { strict: Boolean(tsconfig.compilerOptions?.strict) } : null, serverTemplates: serverTpl },
  size: { textFiles, loc, vendoredSkipped: sig.vendored, largeSkipped: sig.tooLarge, byExt: Object.fromEntries([...byExt].sort((a, b) => b[1].loc - a[1].loc)) },
  pages: { pageDir, estimated: pageList.length, routeEntries: sig.routeEntries, modules },
  git: gitInfo,
  ui: {
    hexLines: [...hex.values()].reduce((s, n) => s + n, 0), distinctColors: hex.size, topColors: top(hex, 5),
    fontSizes: top(fonts, 12), distinctFontSizes: fonts.size,
    inlineStyleLines: sig.inlineStyle, importantLines: sig.important, viewportMathLines: sig.viewportMath,
    cssVarUses: sig.cssVarUses, jqueryFiles: sig.jqueryFiles, topHexFiles: top(hexFiles, 5),
  },
  data: {
    requestCalls: req, wrapperFiles: wrappers, pageCodeFiles: pageFiles, pageFilesWithDirectRequest: pageFilesWithRequest,
    apiFiles: sig.apiFiles, apiFilesWithoutTypes: sig.apiFilesNoTypes, apiAny: sig.apiAny, schemaFiles,
  },
  aiReadiness: { entryFiles, lintConfigs, tokenFiles: tokenFiles.slice(0, 8), componentDirs: compDirs, testFiles, mockDirs: mockDirList, scripts, validators: stack['契约工具'] },
};
if (jsonOut) writeFileSync(resolve(jsonOut), JSON.stringify(profile, null, 2) + '\n');

// ---------- 输出 ----------
const none = (a) => (a && a.length ? a.join('、') : '未检测到');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const out = [];
out.push(`# inventory：${profile.repo}`, '');
out.push(
  '## 技术栈',
  ...['框架', 'UI库', '构建', '路由', '状态', '请求', '微前端', '国际化', '样式'].map((g) => `- ${g}：${none(stack[g])}${g === '框架' && vueMajor ? `（Vue ${vueMajor}）` : ''}`),
  `- 语言：TS ${tsFiles} 个、JS ${jsFiles} 个、Vue ${profile.language.vue} 个（TS 占比 ${pct(tsFiles, tsFiles + jsFiles)}）；tsconfig strict：${tsconfig ? (tsconfig.compilerOptions?.strict ? '是' : '否') : '无 tsconfig'}`,
  serverTpl ? `- 服务端渲染模板：${serverTpl} 个（jsp/php/ftl/vm…），说明至少部分页面不在前端工程里` : '- 服务端渲染模板：无',
  '',
  '## 拓扑（决定隔离机制放在哪一层）',
  `- 形态：${ROOT_TOPO.form}（${ROOT_TOPO.role}）；置信度：${ROOT_TOPO.confidence}`,
  ...(ROOT_TOPO.detail ? [`- 拆仓难度：${ROOT_TOPO.detail}`] : []),
  ...ROOT_TOPO.evidence.slice(0, 6).map((e) => `- ${e.kind}：${e.detail}`),
  `- 建议：${ROOT_TOPO.advice}`,
  '',
  '## 规模',
  `- 文本源码 ${textFiles} 个、${loc} 行；另有第三方 / 点开头目录里的文件 ${sig.vendored} 个、过大文件 ${sig.tooLarge} 个未计入`,
  `- 页面目录：${pageDir || '未识别'}；页面估计 ${pageList.length} 个；路由配置条目 ${sig.routeEntries} 条（两种口径不同，仅供参考）`,
);
const modRows = modules.filter((m) => m.pages || m.loc).slice(0, 15);
if (modRows.length) out.push('', table(['模块', '页面', '代码行', '近 90 天改动'], modRows.map((m) => [m.module, m.pages, m.loc, m.churn90d])));
out.push('', '## 活跃度');
if (gitInfo) {
  out.push(
    `- 提交 ${gitInfo.commits} 次（${gitInfo.firstCommit || '?'} 至 ${gitInfo.lastCommit || '?'}）；近 90 天 ${gitInfo.commits90d} 次、${gitInfo.authors90d} 位作者`,
    `- 近 90 天改动最多的目录：${gitInfo.hotAreas.map((h) => `${h.area}（${h.changes}）`).join('、') || '—'}`,
  );
} else out.push('- 不是 git 仓库，无法判断活跃度');
out.push(
  '',
  '## UI 一致性信号（越发散，AI 越容易模仿出不一致）',
  table(['信号', '数值'], [
    ['硬编码色值：行数 / 不同颜色数（全仓，含主题层）', `${profile.ui.hexLines} / ${profile.ui.distinctColors}；集中在 ${profile.ui.topHexFiles.slice(0, 3).map(([p, n]) => `${p}（${n}）`).join('、') || '—'}`],
    ['字号：不同取值数（px）', `${profile.ui.distinctFontSizes}（${profile.ui.fontSizes.slice(0, 6).map(([s, n]) => `${s}×${n}`).join('、') || '—'}）`],
    ['行内 style 行数', profile.ui.inlineStyleLines],
    ['!important 行数', profile.ui.importantLines],
    ['手算视口高度（innerHeight - / 100vh -）', profile.ui.viewportMathLines],
    ['CSS 变量使用（var(--…)）行数', profile.ui.cssVarUses],
    ['直接用 jQuery 的文件', profile.ui.jqueryFiles],
  ]),
  '',
  '## 数据层信号（接后端返工的主要来源）',
  table(['信号', '数值'], [
    ['请求调用行数：axios / fetch / $.ajax / XHR / hooks', `${req.axios} / ${req.fetch} / ${req.jqueryAjax} / ${req.xhr} / ${req.hooks}`],
    ['请求封装类文件（名为 request/http/fetch/axios/ajax/client；散在各页面里 = 没有统一数据层）', wrappers.length ? `${wrappers.length} 个（${wrappers.slice(0, 3).join('、')}${wrappers.length > 3 ? '…' : ''}）` : '未发现'],
    ['页面代码里直接发请求或直接引入 HTTP 库的文件', pageDir ? `${pageFilesWithRequest} / ${pageFiles}（${pct(pageFilesWithRequest, pageFiles)}）` : '页面目录未识别'],
    ['api/service 声明类 TS 文件：总数 / 没有 interface 或 type 声明；这类文件与请求封装里的 any 处数', tsFiles ? `${sig.apiFiles} / ${sig.apiFilesNoTypes}；${sig.apiAny}` : '非 TS 项目，无法评估类型'],
    ['契约产物（openapi / swagger / proto / graphql）', schemaFiles.length ? `${schemaFiles.length} 个（${schemaFiles.slice(0, 3).join('、')}）` : '未发现'],
    ['响应校验 / 契约生成工具', none(stack['契约工具'])],
  ]),
  '',
  '## AI 就绪度速览（有没有，不评分）',
  table(['层', '项', '现状'], [
    ['约束面', 'AI 入口文件', none(entryFiles)],
    ['约束面', 'lint / 格式化配置', none(lintConfigs)],
    ['约束面', '主题 / token 文件', tokenFiles.length ? `${tokenFiles.length} 个（${tokenFiles.slice(0, 3).join('、')}）` : '未发现'],
    ['约束面', '公共组件目录', compDirs.length ? compDirs.map((c) => `${c.dir}（${c.files} 文件）`).join('、') : '未发现'],
    ['反馈环', 'mock / 夹具目录与库', `${none(mockDirList)}；库：${none(stack.mock)}`],
    ['反馈环', 'e2e / 截图工具与测试文件', `${none(stack['测试'])}；测试相关文件 ${testFiles} 个`],
    ['反馈环', '相关 npm 脚本', none(scripts)],
    ['对接面', '见上方「数据层信号」', '—'],
  ]),
  '',
  '> 口径：全部为静态扫描近似值。页面访问量、接口真实约定、业务重要度扫不出来，需要向用户要。',
  '',
);
console.log(out.join('\n'));
if (jsonOut) console.error(`profile 已写入 ${resolve(jsonOut)}`);
