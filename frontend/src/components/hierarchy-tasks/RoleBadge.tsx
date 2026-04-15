import { effectiveHierarchyRole, type HierarchyRoleName } from "../../lib/taskHierarchy";

const styles: Record<HierarchyRoleName, string> = {
  ORGANIZATION_MEMBER: "bg-violet-500/15 text-violet-800 dark:text-violet-200 border border-violet-500/30",
  SENIOR_MANAGER: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border border-indigo-500/30",
  MANAGER: "bg-blue-500/15 text-blue-800 dark:text-blue-200 border border-blue-500/30",
  EMPLOYEE: "bg-teal-500/15 text-teal-800 dark:text-teal-200 border border-teal-500/30",
  INTERN: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border border-neutral-500/25",
};

export function RoleBadge({ roleName }: { roleName: string }) {
  const eff = effectiveHierarchyRole(roleName);
  const label = eff ? eff.replaceAll("_", " ") : roleName;
  const cls = eff ? styles[eff] : "bg-neutral-500/10 text-neutral-600 border border-neutral-500/20";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
      aria-label={`Role: ${label}`}
    >
      {label}
    </span>
  );
}
