/**
 * Department + role based access. SUPER_ADMIN may access all routes.
 * ADMIN may access /settings in addition to their department scope.
 */

import { canAccessHr } from "./hrAccess";
import { PEOPLE_WORKPLACE_SECTION_TITLE, isUniversalWorkspacePath } from "@shared/workspaceNav";

export { isUniversalWorkspacePath };

export function normalizeDepartmentName(d: string | null | undefined): string {
  return (d ?? "").trim().toLowerCase();
}

/** Sidebar / business area keys aligned with Settings → department names */
const AREA_TO_DEPT: Record<string, string> = {
  Sales: "sales",
  Presales: "presales",
  SCM: "scm",
  Deployment: "deployment",
  Cloud: "cloud",
  HR: "hr",
};

export function canSeeNavGroup(
  groupTitle: string,
  user: { role: string; department?: string | null } | null,
): boolean {
  if (!user) {
    return false;
  }
  if (user.role === "SUPER_ADMIN") {
    return true;
  }
  // Sidebar "Overview": Dashboard, My Tasks, Inbox — every signed-in user (not department-scoped).
  if (groupTitle === "Overview") {
    return true;
  }
  if (groupTitle === PEOPLE_WORKPLACE_SECTION_TITLE) {
    return true;
  }
  if (groupTitle === "Tools") {
    return false;
  }
  if (groupTitle === "Admin") {
    return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  }
  if (groupTitle === "HR") {
    return canAccessHr(user);
  }
  const dept = normalizeDepartmentName(user.department);
  if (!dept) {
    return false;
  }
  const required = AREA_TO_DEPT[groupTitle];
  if (!required) {
    return false;
  }
  return dept === required;
}

/**
 * Path-based guard (covers deep links). SUPER_ADMIN: all.
 * ADMIN: /settings + same departmental rules as others.
 */
export function canAccessPath(
  pathname: string,
  user: { role: string; department?: string | null } | null,
): boolean {
  if (!user) {
    return false;
  }
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  const path = pathname.split("?")[0] || "/";

  if (path === "/attendance/team" || path.startsWith("/attendance/team/")) {
    return user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MANAGEMENT";
  }

  if (isUniversalWorkspacePath(path)) {
    return true;
  }

  if (path.startsWith("/settings")) {
    return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  }

  if (path.startsWith("/api-fetcher")) {
    return false;
  }

  if (path.startsWith("/super-admin")) {
    return user.role === "SUPER_ADMIN";
  }

  if (path.startsWith("/hr")) {
    return canAccessHr(user);
  }

  // Generic admin lane (legacy page)
  if (path === "/admin" || path.startsWith("/admin/")) {
    return user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  }

  const dept = normalizeDepartmentName(user.department);
  if (!dept) {
    return false;
  }

  if (dept === "sales") {
    return path.startsWith("/crm/");
  }
  if (dept === "presales") {
    return path.startsWith("/presales");
  }
  if (dept === "scm") {
    return path.startsWith("/scm");
  }
  if (dept === "deployment") {
    return path.startsWith("/deployments");
  }
  if (dept === "cloud") {
    return path.startsWith("/cloud");
  }

  return false;
}
