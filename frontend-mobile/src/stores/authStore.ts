import { create } from "zustand";

type Role = "SUPER_ADMIN" | "ADMIN" | "USER" | "MANAGEMENT" | "PRESALES" | "SALES" | string;

export interface AuthUser {
  id: number;
  name?: string;
  email?: string;
  department?: string | null;
  tags?: string[];
  role: Role;
  organization?: string | null;
  organizationId?: number | null;
  reportsToId?: number | null;
  directReportCount?: number;
  isManager?: boolean;
  hasFaceRegistered?: boolean;
  faceEnrolledAt?: string | null;
  profilePhotoUrl?: string | null;
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
