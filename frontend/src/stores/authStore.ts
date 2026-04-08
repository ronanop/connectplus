import { create } from "zustand";

type Role = "SUPER_ADMIN" | "ADMIN" | "USER" | string;

interface AuthUser {
  id: number;
  name?: string;
  email?: string;
  department?: string | null;
  role: Role;
  organization?: string | null;
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

