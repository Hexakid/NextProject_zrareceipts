import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout')
};

// ─── Expenses ─────────────────────────────────────
export const expensesApi = {
  list: (params) => api.get('/expenses', { params }),
  get: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  submit: (id) => api.post(`/expenses/${id}/submit`),
  delete: (id) => api.delete(`/expenses/${id}`),
  team: () => api.get('/expenses/team/list')
};

// ─── Approvals ────────────────────────────────────
export const approvalsApi = {
  queue: () => api.get('/approvals/queue'),
  history: () => api.get('/approvals/history'),
  approve: (expenseId, data) => api.post(`/approvals/${expenseId}/approve`, data),
  reject: (expenseId, data) => api.post(`/approvals/${expenseId}/reject`, data)
};

// ─── Projects ─────────────────────────────────────
export const projectsApi = {
  list: () => api.get('/projects'),
  all: () => api.get('/projects/all/list'),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data)
};

export const categoriesApi = {
  list: () => api.get('/categories')
};

// ─── Budgets ──────────────────────────────────────
export const budgetsApi = {
  overview: () => api.get('/budgets/overview'),
  alerts: () => api.get('/budgets/alerts'),
  byProject: (id) => api.get(`/budgets/${id}`)
};

// ─── Reports ──────────────────────────────────────
export const reportsApi = {
  analytics: (params) => api.get('/reports/analytics', { params }),
  exportCsv: (data) => api.post('/reports/export/csv', data, { responseType: 'blob' }),
  exportPdf: (data) => api.post('/reports/export/pdf', data, { responseType: 'blob' })
};

// ─── Receipts ─────────────────────────────────────
export const receiptsApi = {
  upload: (formData) => api.post('/receipts/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  get: (id) => api.get(`/receipts/${id}`),
  importVat: (data) => api.post('/receipts/import-vat', data)
};

// ─── Notifications ────────────────────────────────
export const notificationsApi = {
  list: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all')
};

export default api;
