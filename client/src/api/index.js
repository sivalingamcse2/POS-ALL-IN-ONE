import axios from 'axios';

// VITE_API_URL should be the FULL origin of the backend (e.g. https://pos-api-xxx.onrender.com).
// Falls back to same-origin /api for local dev (via Vite proxy) or when the client and
// API are hosted together.
const apiBase = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const activeRestaurant = localStorage.getItem('active_restaurant');
  if (activeRestaurant) {
    try {
      const res = JSON.parse(activeRestaurant);
      config.headers['X-Restaurant-Id'] = res.id;
    } catch (e) {
      console.error('Error parsing active restaurant', e);
    }
  }

  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (data) => api.post('/auth/login', {
    ...data,
    username: data.identifier || data.username,
  }),
  activate: (data) => api.post('/auth/activate', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// Restaurant API
export const restaurantApi = {
  getAll: () => api.get('/restaurants'),
  getById: (id) => api.get(`/restaurants/${id}`),
  create: (data) => api.post('/restaurants', data),
  update: (id, data) => api.put(`/restaurants/${id}`, data),
  delete: (id) => api.delete(`/restaurants/${id}`),
};

// User API
export const userApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, data) => api.post(`/users/${id}/reset-password`, data),
  getRoles: () => api.get('/users/roles/list'),
  createRole: (data) => api.post('/users/roles', data),
  updateRole: (id, data) => api.put(`/users/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/users/roles/${id}`),
  getActivities: (params) => api.get('/users/activities/list', { params }),
};

// Menu API
export const menuApi = {
  getCategories: () => api.get('/menu/categories'),
  createCategory: (data) => api.post('/menu/categories', data),
  updateCategory: (id, data) => api.put(`/menu/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/menu/categories/${id}`),
  getItems: (params) => api.get('/menu/items', { params }),
  getItemById: (id) => api.get(`/menu/items/${id}`),
  createItem: (data) => api.post('/menu/items', data),
  updateItem: (id, data) => api.put(`/menu/items/${id}`, data),
  deleteItem: (id) => api.delete(`/menu/items/${id}`),
  getLowStock: (threshold) => api.get('/menu/items/low-stock', { params: { threshold } }),
};

// POS API
export const posApi = {
  getTables: () => api.get('/pos/tables'),
  createTable: (data) => api.post('/pos/tables', data),
  updateTable: (id, data) => api.put(`/pos/tables/${id}`, data),
  deleteTable: (id) => api.delete(`/pos/tables/${id}`),
  getOrders: (params) => api.get('/pos/orders', { params }),
  getOrderById: (id) => api.get(`/pos/orders/${id}`),
  createOrder: (data) => api.post('/pos/orders', data),
  updateOrder: (id, data) => api.put(`/pos/orders/${id}`, data),
  updateOrderStatus: (id, status) => api.patch(`/pos/orders/${id}/status`, { status }),
  deleteOrder: (id) => api.delete(`/pos/orders/${id}`),
  addOrderItem: (orderId, data) => api.post(`/pos/orders/${orderId}/items`, data),
  updateOrderItem: (orderId, itemId, data) => api.put(`/pos/orders/${orderId}/items/${itemId}`, data),
  removeOrderItem: (orderId, itemId) => api.delete(`/pos/orders/${orderId}/items/${itemId}`),
};

// Inventory API
export const inventoryApi = {
  getStock: () => api.get('/inventory/stock'),
  getStockByItem: (itemId) => api.get(`/inventory/stock/${itemId}`),
  createTransaction: (data) => api.post('/inventory/transaction', data),
  getTransactions: (params) => api.get('/inventory/transactions', { params }),
  adjustStock: (data) => api.post('/inventory/adjust', data),
};

// Storage API
export const storageApi = {
  getOrders: () => api.get('/storage/orders'),
};

// Reports API
export const reportApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getDailySales: (date) => api.get('/reports/daily-sales', { params: { date } }),
  getMonthlySales: (year, month) => api.get('/reports/monthly-sales', { params: { year, month } }),
  getSalesRange: (start_date, end_date) => api.get('/reports/sales-range', { params: { start_date, end_date } }),
  getItemSales: (start_date, end_date) => api.get('/reports/item-sales', { params: { start_date, end_date } }),
  getCategorySales: (start_date, end_date) => api.get('/reports/category-sales', { params: { start_date, end_date } }),
  getTaxSummary: (start_date, end_date) => api.get('/reports/tax-summary', { params: { start_date, end_date } }),
  getInventoryReport: () => api.get('/reports/inventory'),
  getPaymentMethods: (start_date, end_date) => api.get('/reports/payment-methods', { params: { start_date, end_date } }),
};

export default api;
