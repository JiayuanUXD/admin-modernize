/**
 * 固定种子的响应。同样的查询永远得到同样的 JSON。
 * 只被预览服务调用，不要被页面 import。
 */

const SEVERITIES = ['P0', 'P1', 'P2', 'P3'];

function stateOf(url) {
  return url.searchParams.get('state') === 'empty' ? 'empty' : 'many';
}

function itemsFor(url, seed) {
  return stateOf(url) === 'empty' ? [] : seed.insights;
}

export function list(url, seed) {
  const state = stateOf(url);
  return { state, items: itemsFor(url, seed) };
}

export function facets(url, seed) {
  const items = itemsFor(url, seed);
  return {
    state: stateOf(url),
    items: SEVERITIES.map((id) => ({
      id,
      label: id,
      count: items.filter((item) => item.severity === id).length,
    })),
  };
}

export function detail(url, seed) {
  const id = decodeURIComponent(url.pathname.split('/').pop());
  return seed.insights.find((item) => item.id === id) || null;
}
