import { Request } from "express";

export interface AuthUser {
  id: number;
  role: string;
  /** Set at login (JWT). May be stale until next login if an admin changes department. */
  department?: string | null;
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

