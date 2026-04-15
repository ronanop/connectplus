import { normalizeDepartmentName } from "../middleware/departmentAccess";
import { tagsFromJson } from "./tagsFromJson";

export type PortfolioUserRow = {
  id: number;
  department?: string | null;
  tagsJson?: unknown;
  hrEmployeeProfile?: { hrDepartment?: { name?: string | null } | null } | null;
  role?: { name?: string | null } | null;
};

/** CRM `department`, else HR org unit, else `dept:…` tag — aligned with hierarchy tasks. */
export function effectiveDepartmentForPortfolio(u: PortfolioUserRow): string | null {
  const d = u.department?.trim();
  if (d) {
    return d;
  }
  const hr = u.hrEmployeeProfile?.hrDepartment?.name?.trim();
  if (hr) {
    return hr;
  }
  for (const t of tagsFromJson(u.tagsJson)) {
    if (/^dept:/i.test(t)) {
      const rest = t.replace(/^dept:\s*/i, "").trim();
      if (rest) {
        return rest;
      }
    }
  }
  return null;
}

/** True when normalized department string suggests Cloud or Software engineering focus. */
export function departmentIndicatesDeliveryPortfolio(departmentRaw: string | null | undefined): boolean {
  const s = normalizeDepartmentName(departmentRaw);
  if (!s) {
    return false;
  }
  if (s.includes("cloud")) {
    return true;
  }
  if (s.includes("software")) {
    return true;
  }
  if (/\bswe\b/.test(s)) {
    return true;
  }
  if (s.includes("software development") || s.includes("software engineering")) {
    return true;
  }
  return false;
}

export function isAdminRoleName(roleName: string): boolean {
  const u = roleName.trim().toUpperCase();
  return u === "SUPER_ADMIN" || u === "ADMIN";
}

/**
 * Who may register new portfolio projects. The `/projects` area is workspace-wide for any
 * signed-in org user; creation stays scoped to the caller's organization in the service layer.
 * (Previously limited to admins + delivery managers — that hid Add CTAs for most users.)
 */
export function canCreatePortfolioProject(roleName: string, effectiveDept: string | null): boolean {
  void roleName;
  void effectiveDept;
  return true;
}

export function canReadPortfolioProject(
  roleName: string,
  userId: number,
  project: { createdById: number; organizationId: number },
  membership: { role: "LEAD" | "MEMBER" | "VIEWER" } | null,
  userOrganizationId: number | null,
): boolean {
  if (userOrganizationId == null || userOrganizationId !== project.organizationId) {
    return false;
  }
  if (isAdminRoleName(roleName)) {
    return true;
  }
  if (project.createdById === userId) {
    return true;
  }
  return membership != null;
}

export function canPatchProjectFields(
  roleName: string,
  userId: number,
  project: { createdById: number },
  membership: { role: "LEAD" | "MEMBER" | "VIEWER" } | null,
): boolean {
  if (isAdminRoleName(roleName)) {
    return true;
  }
  if (project.createdById === userId) {
    return true;
  }
  return membership?.role === "LEAD";
}

export function canUpdatePortfolioStatus(
  roleName: string,
  membership: { role: "LEAD" | "MEMBER" | "VIEWER" } | null,
): boolean {
  if (isAdminRoleName(roleName)) {
    return true;
  }
  if (!membership) {
    return false;
  }
  return membership.role === "LEAD" || membership.role === "MEMBER";
}

export function canManagePortfolioTeam(roleName: string, membership: { role: "LEAD" | "MEMBER" | "VIEWER" } | null): boolean {
  if (isAdminRoleName(roleName)) {
    return true;
  }
  return membership?.role === "LEAD";
}

export function canUploadPortfolioArtifact(
  roleName: string,
  membership: { role: "LEAD" | "MEMBER" | "VIEWER" } | null,
): boolean {
  if (isAdminRoleName(roleName)) {
    return true;
  }
  if (!membership) {
    return false;
  }
  return membership.role === "LEAD" || membership.role === "MEMBER";
}

/** Journal updates and work logs — same as artifact upload (not viewers). */
export function canPostPortfolioJournal(
  roleName: string,
  membership: { role: "LEAD" | "MEMBER" | "VIEWER" } | null,
): boolean {
  return canUploadPortfolioArtifact(roleName, membership);
}
