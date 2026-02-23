import { create } from "zustand";

type Role = "SUPER_ADMIN" | "ADMIN" | "USER" | string;

interface AuthUser {
  id: number;
  role: Role;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  setUser: user => set({ user }),
  clearUser: () => set({ user: null }),
}));

