// 洞察池风格的薄封装。内部 fetch 的 path 是变量，抽取必须认外层 get/post/api。
// 认不出 URL 的调用（纯变量、方法不是字符串字面量、注释）直接跳过，不编接口。

async function api(method, path, body) {
  const res = await fetch(path, { method, body: body && JSON.stringify(body) });
  return res.json();
}

const get = (p) => api('GET', p);
const post = (p, b) => api('POST', p, b);

export async function loadInsights(p) {
  return get('/api/insights?' + p.toString());
}

export async function loadFacets(q) {
  return get('/api/facets?' + q);
}

export async function loadInsight(id) {
  const row = await get('/api/insights/' + encodeURIComponent(id));
  return { id: row.id, status: row.status };
}

export async function claimInsight(id, owner, actor, note) {
  return post(`/api/insights/${encodeURIComponent(id)}/claim`, { owner, actor, note });
}

export async function setInsightStatus(id, status_id, actor) {
  return post(`/api/insights/${id}/status`, { status_id, actor });
}

export async function setInsightNote(id, note, actor) {
  return api('POST', `/api/insights/${id}/note`, { note, actor });
}

export async function reviewSample(id, verdict) {
  return post('/api/samples/' + id + '/review', { verdict });
}

export async function skippedTernary(id, version) {
  return get('/api/trackers/' + encodeURIComponent(id)
    + (version ? '?version=' + encodeURIComponent(version) : ''));
}

export async function skipped(path, method) {
  await fetch(path);
  await api(method, path);
  await get(path);
  await post(path, { note: '' });
}

// get('/api/insights/not-a-call');
/* post('/api/insights/also-not', { owner: 'x' }); */
