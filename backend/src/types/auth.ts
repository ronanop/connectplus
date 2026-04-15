import { Request } from "express";

export interface AuthUser {
  id: number;
  role: string;
  /** Set at login (JWT). Hydrated from DB on some routes (e.g. /api/settings). */
  department?: string | null;
  /** Hydrated from DB (e.g. after `hydrateAuthUserFromDb`). */
  organizationId?: number | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  /**
   * Normalized department for RBAC, resolved once per request (JWT first, else DB).
   * Only defined after `resolveAccessDepartment` / `requireDepartmentAccess` runs.
   */
  accessDepartmentNorm?: string;
  accessDepartmentResolved?: boolean;
}

