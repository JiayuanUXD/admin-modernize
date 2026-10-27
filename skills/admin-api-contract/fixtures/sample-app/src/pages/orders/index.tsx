import axios from 'axios';

export async function listOrders(status) {
  const res = await axios.get('/api/orders', { params: { status } });
  return res.data.list.map((row) => ({
    id: row.id,
    status: row.status,
  }));
}

export async function createOrder(input) {
  const res = await axios.post('/api/orders', {
    sku: input.sku,
    qty: input.qty,
    note: input.note,
  });
  return {
    id: res.data.id,
    status: res.data.status,
    note: res.data.note,
  };
}

export async function loadOrder(id) {
  const res = await axios.get(`/api/orders/${id}`);
  return {
    id: res.data.id,
    status: res.data.status,
  };
}
