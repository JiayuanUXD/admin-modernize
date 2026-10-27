export function orderStats() {
  return $.ajax({
    url: '/api/orders/stats',
    method: 'GET',
  }).then((data) => ({
    count: data.count,
  }));
}

export function listOrdersViaFetch() {
  return fetch('/api/orders').then((res) => res.json());
}
