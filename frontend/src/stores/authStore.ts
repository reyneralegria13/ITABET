import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'VIP' | 'ADMIN' | 'SUPER_ADMIN';
  balance: number;
  bonusBalance: number;
  avatarUrl?: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  updateBalance: (balance: number, bonusBalance: number) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: true }),

      setAccessToken: (token) => set({ accessToken: token }),

      updateBalance: (balance, bonusBalance) =>
        set((state) => ({
          user: state.user ? { ...state.user, balance, bonusBalance } : null,
        })),

      logout: async () => {
        try { await api.post('/auth/logout'); } catch { /* silent */ }
        disconnectSocket();
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      refreshUser: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data.user });
        } catch {
          // Token might be expired; the interceptor will handle refresh
        }
      },
    }),
    {
      name: 'itabet-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
