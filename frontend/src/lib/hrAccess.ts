function normalizeDepartmentName(d: string | null | undefined): string {
  return (d ?? "").trim().toLowerCase();
}

const HR_ACCESS_ROLE_NAMES = new Set(["HR_ADMIN", "HR"]);

function departmentIndicatesHr(department: string | null | undefined): boolean {
  const n = normalizeDepartmentName(department);
  if (!n) {
    return false;
  }
  if (n === "hr") {
    return true;
  }
  if (n === "hr department") {
    return true;
  }
  if (n === "human resources" || n === "human-resources" || n === "humanresources") {
    return true;
  }
  if (n.includes("human resource")) {
    return true;
  }
  if (n === "hcm" || n === "people ops" || n === "people operations") {
    return true;
  }
  if (n === "people & culture" || n === "people and culture") {
    return true;
  }
  return false;
}

function tagsIndicateHr(tags: string[] | undefined | null): boolean {
  if (!tags?.length) {
    return false;
  }
  const hints = new Set([
    "hr",
    "hr_admin",
    "hcm",
    "human resources",
    "human-resources",
    "people ops",
    "people operations",
    "hr manager",
    "hr executive",
    "hr lead",
  ]);
  for (const t of tags) {
    const k = t.trim().toLowerCase();
    if (hints.has(k)) {
      return true;
    }
    if (k.includes("human resource")) {
      return true;
    }
  }
  return false;
}

export function canAccessHr(
  user: { role: string; department?: string | null; tags?: string[] | null } | null | undefined,
): boolean {
  if (!user) {
    return false;
  }
  if (user.role === "SUPER_ADMIN") {
    return true;
  }
  if (HR_ACCESS_ROLE_NAMES.has(user.role)) {
    return true;
  }
  if (departmentIndicatesHr(user.department)) {
    return true;
  }
  if (tagsIndicateHr(user.tags ?? undefined)) {
    return true;
  }
  return false;
}
