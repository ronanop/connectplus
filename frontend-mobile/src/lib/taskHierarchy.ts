export const HIERARCHY_LEVELS = {
  ORGANIZATION_MEMBER: 5,
  SENIOR_MANAGER: 4,
  MANAGER: 3,
  EMPLOYEE: 2,
  INTERN: 1,
} as const;

export type HierarchyRoleName = keyof typeof HIERARCHY_LEVELS;

const LEVEL_BY_ROLE: Record<string, HierarchyRoleName> = {
  ORGANIZATION_MEMBER: "ORGANIZATION_MEMBER",
  SENIOR_MANAGER: "SENIOR_MANAGER",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
  INTERN: "INTERN",
};

export function effectiveHierarchyRole(dbRoleName: string): HierarchyRoleName | null {
  const upper = dbRoleName.trim().toUpperCase();
  if (LEVEL_BY_ROLE[upper]) {
    return LEVEL_BY_ROLE[upper];
  }
  if (upper === "SUPER_ADMIN" || upper === "ADMIN") {
    return "ORGANIZATION_MEMBER";
  }
  if (upper === "MANAGEMENT") {
    return "SENIOR_MANAGER";
  }
  if (upper === "USER") {
    return "EMPLOYEE";
  }
  if (upper === "SALES" || upper === "PRESALES" || upper === "ISR") {
    return "EMPLOYEE";
  }
  return null;
}

export function getAssignableRoles(assignerDbRoleName: string): HierarchyRoleName[] {
  const assigner = effectiveHierarchyRole(assignerDbRoleName);
  const assignerLevel = assigner ? HIERARCHY_LEVELS[assigner] : 0;
  if (assignerLevel <= 0) {
    return [];
  }
  if (assigner === "EMPLOYEE") {
    return ["EMPLOYEE", "INTERN"];
  }
  return (Object.entries(HIERARCHY_LEVELS) as [HierarchyRoleName, number][])
    .filter(([, level]) => level < assignerLevel)
    .map(([role]) => role);
}

export function canUserAssignTasks(dbRoleName: string): boolean {
  return getAssignableRoles(dbRoleName).length > 0;
}

export function isOrganizationMemberRole(dbRoleName: string): boolean {
  return effectiveHierarchyRole(dbRoleName) === "ORGANIZATION_MEMBER";
}
