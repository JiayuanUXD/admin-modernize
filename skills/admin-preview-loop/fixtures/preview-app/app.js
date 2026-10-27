/**
 * 列表 + 抽屉的静态页。数据全部来自网络层，本文件不写种子。
 * 权限点在这里声明；预览服务不校验登录。切回真实环境后由网关生效。
 */
const PERMISSIONS = {
  'insight.read': true,
  'insight.claim': true,
};

const app = document.querySelector('#app');
const query = new URLSearchParams(location.search);
const state = query.get('state') === 'empty' ? 'empty' : 'many';
const openId = query.get('open') || '';

if (query.get('leak') === '1') {
  // 冒烟钩子：这条路径预览服务没有登记。读完响应体，连接才会结束，截图才能等网络空闲。
  // 不把失败打进页面自己的日志；浏览器仍会记一条资源失败，截图命令一并收集。
  fetch('/api/ops/health').then((res) => res.text()).catch(() => {});
}

function h(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children || []) node.append(child);
  return node;
}

function text(value) {
  return document.createTextNode(value == null || value === '' ? '无' : String(value));
}

function modeLink(id, label) {
  const href = `?state=${id}`;
  return h('a', { href, 'aria-current': state === id && !openId ? 'page' : null }, [text(label)]);
}

function rowLink(item) {
  const owner = item.owner || '未认领';
  return h('a', { class: 'row', href: `?state=many&open=${encodeURIComponent(item.id)}` }, [
    h('span', { class: `sev sev-${item.severity}` }, [text(item.severity)]),
    h('span', {}, [text(item.title)]),
    h('small', {}, [text(`${owner} · 赞 ${item.likes} · 热度 ${item.heat}`)]),
  ]);
}

function drawer(detail) {
  const back = `?state=${state}`;
  return h('div', {}, [
    h('div', { class: 'backdrop' }, []),
    h('aside', { class: 'drawer', role: 'dialog', 'aria-label': '洞察详情' }, [
      h('header', {}, [
        h('h2', {}, [text(detail.title)]),
        h('a', { class: 'close', href: back }, [text('关闭')]),
      ]),
      h('dl', { class: 'meta' }, [
        h('dt', {}, [text('级别')]), h('dd', {}, [text(detail.severity)]),
        h('dt', {}, [text('认领')]), h('dd', {}, [text(detail.owner || '未认领')]),
        h('dt', {}, [text('赞')]), h('dd', {}, [text(detail.likes)]),
        h('dt', {}, [text('热度')]), h('dd', {}, [text(detail.heat)]),
        h('dt', {}, [text('备注')]), h('dd', {}, [text(detail.note)]),
      ]),
      h('p', { class: 'body' }, [text(detail.body)]),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', 'data-permission': 'insight.claim' }, [text('认领')]),
        h('p', { class: 'hint' }, [text(
          PERMISSIONS['insight.claim']
            ? '权限点 insight.claim 已声明。预览不校验登录。'
            : '没有认领权限。',
        )]),
      ]),
    ]),
  ]);
}

function render(list, facet, detail) {
  const items = list.items || [];
  const shell = h('div', { class: 'shell' }, [
    h('header', { class: 'top' }, [
      h('div', {}, [
        h('h1', {}, [text('洞察池')]),
        h('p', {}, [text('预览数据 · 固定种子。空列表、多条、打开抽屉。')]),
      ]),
      h('nav', { class: 'modes', 'aria-label': '列表状态' }, [
        modeLink('empty', '空列表'),
        modeLink('many', '多条'),
      ]),
    ]),
    h('div', { class: 'chips' }, (facet.items || []).map((item) => h('span', { class: 'chip' }, [
      text(`${item.label} `),
      h('b', {}, [text(item.count)]),
    ]))),
    items.length
      ? h('div', { class: 'list' }, items.map(rowLink))
      : h('div', { class: 'list' }, [
        h('div', { class: 'empty' }, [
          h('b', {}, [text('这个筛选下没有洞察')]),
          text('换到「多条」可以看到固定种子里的 6 条。'),
        ]),
      ]),
  ]);
  app.replaceChildren(shell);
  if (detail) app.append(drawer(detail));
  app.dataset.previewReady = '1';
}

const listRes = await fetch(`/api/insights?state=${encodeURIComponent(state)}`);
const facetRes = await fetch(`/api/facets?state=${encodeURIComponent(state)}`);
if (!listRes.ok || !facetRes.ok) throw new Error('列表或筛选没有返回');
let detail = null;
if (openId) {
  const detailRes = await fetch(`/api/insights/${encodeURIComponent(openId)}`);
  if (!detailRes.ok) throw new Error('详情没有返回');
  detail = await detailRes.json();
}
render(await listRes.json(), await facetRes.json(), detail);
