/** 字段对照，不是调用点。抽取脚本只认 axios / fetch / $.ajax。 */
export const ordersMock = {
  'GET /api/orders': [{ id: '1', status: 'open' }],
  'POST /api/orders': { id: '1', status: 'open', note: '' },
};
