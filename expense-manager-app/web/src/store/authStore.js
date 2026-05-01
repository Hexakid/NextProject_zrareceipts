import { create } from 'zustand';
import { authApi } from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user, isAuthenticated: true });
    return data.user;
  },

  logout: async () => {
    await authApi.logout().catch(() => {});
    localStorage.clear();
    set({ user: null, isAuthenticated: false });
  },

  loadCurrentUser: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return set({ loading: false });
      const { data } = await authApi.me();
      set({ user: data, isAuthenticated: true, loading: false });
    } catch {
      localStorage.clear();
      set({ user: null, isAuthenticated: false, loading: false });
    }
  }
}));

export default useAuthStore;
