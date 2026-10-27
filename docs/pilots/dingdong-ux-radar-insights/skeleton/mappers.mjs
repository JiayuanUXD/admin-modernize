/**
 * 映射层骨架，由 generate-skeleton 写出。
 * direct 原样透过；bff 在这里改字段。页面不要自己做参数改名或拆包。
 * 这不是完整的 typed client。
 */
export const operations = [
  {"id":"listFacets","method":"GET","path":"/api/facets","disposition":"direct","status":"reshape"},
  {"id":"listInsights","method":"GET","path":"/api/insights","disposition":"direct","status":"reshape"},
  {"id":"getInsight","method":"GET","path":"/api/insights/{param}","disposition":"direct","status":"reshape"},
  {"id":"createInsightsClaim","method":"POST","path":"/api/insights/{param}/claim","disposition":"direct","status":"reshape"},
  {"id":"createInsightsNote","method":"POST","path":"/api/insights/{param}/note","disposition":"direct","status":"reshape"},
  {"id":"createInsightsStatus","method":"POST","path":"/api/insights/{param}/status","disposition":"direct","status":"reshape"}
];

export const mappers = {
  listFacets(raw) {
    // direct：原样透过。响应字段不一致；实际有而期望无：axes, item_types, owners, statuses, taxonomy_version, trackers
    return raw;
  },
  listInsights(raw) {
    // direct：原样透过。响应字段不一致；实际有而期望无：filters, items, page, page_size, pages, taxonomy_version, total
    return raw;
  },
  getInsight(raw) {
    // direct：原样透过。响应字段不一致；实际有而期望无：context, events, has_state, insight_id, item_id, item_type, keyword, like_count, manual_tags, muted, note, owner, post_id, severity, similar, source, starred, status, status_id, tags, text, time, title, trackers, ts, updated_at, updated_by, url
    return raw;
  },
  createInsightsClaim(raw) {
    // direct：原样透过。响应字段不一致；实际有而期望无：insight_id, owner, was
    return raw;
  },
  createInsightsNote(raw) {
    // direct：原样透过。响应字段不一致；实际有而期望无：insight_id, note
    return raw;
  },
  createInsightsStatus(raw) {
    // direct：原样透过。响应字段不一致；实际有而期望无：insight_id, note_touched, status_id, was
    return raw;
  }
};
