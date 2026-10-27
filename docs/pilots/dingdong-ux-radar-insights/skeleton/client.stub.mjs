/**
 * typed client 入口骨架，由 generate-skeleton 写出。
 * 只占住方法名。完整客户端要等契约评审之后替换这里。
 */
export const operations = [
  {
    "id": "listFacets",
    "method": "GET",
    "path": "/api/facets",
    "disposition": "direct"
  },
  {
    "id": "listInsights",
    "method": "GET",
    "path": "/api/insights",
    "disposition": "direct"
  },
  {
    "id": "getInsight",
    "method": "GET",
    "path": "/api/insights/{param}",
    "disposition": "direct"
  },
  {
    "id": "createInsightsClaim",
    "method": "POST",
    "path": "/api/insights/{param}/claim",
    "disposition": "direct"
  },
  {
    "id": "createInsightsNote",
    "method": "POST",
    "path": "/api/insights/{param}/note",
    "disposition": "direct"
  },
  {
    "id": "createInsightsStatus",
    "method": "POST",
    "path": "/api/insights/{param}/status",
    "disposition": "direct"
  }
];

export function createStubClient() {
  return {
    listFacets() {
      throw new Error('stub client: listFacets 未接数据层');
    },
    listInsights() {
      throw new Error('stub client: listInsights 未接数据层');
    },
    getInsight() {
      throw new Error('stub client: getInsight 未接数据层');
    },
    createInsightsClaim() {
      throw new Error('stub client: createInsightsClaim 未接数据层');
    },
    createInsightsNote() {
      throw new Error('stub client: createInsightsNote 未接数据层');
    },
    createInsightsStatus() {
      throw new Error('stub client: createInsightsStatus 未接数据层');
    }
  };
}
