import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  token: string | null;
  setUser: (user: UserState['user']) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    set => ({
      user: null,
      token: null,
      setUser: user => set({ user }),
      setToken: token => set({ token }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'user-storage',
    }
  )
);
