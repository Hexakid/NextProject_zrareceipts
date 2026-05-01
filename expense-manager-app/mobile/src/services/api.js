import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3000/api' });

export const setToken = (token) => {
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
};

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password })
};

export const expensesApi = {
  create: (payload) => api.post('/expenses', payload),
  submit: (id) => api.post(`/expenses/${id}/submit`)
};

export const receiptsApi = {
  upload: (formData) => api.post('/receipts/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};
