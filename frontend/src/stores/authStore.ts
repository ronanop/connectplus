import { create } from "zustand";

type Role = "SUPER_ADMIN" | "ADMIN" | "USER" | "MANAGEMENT" | string;

interface AuthUser {
  id: number;
  name?: string;
  email?: string;
  department?: string | null;
  /** From `/api/auth/me`; used for HR access when department name is not exactly `HR`. */
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

