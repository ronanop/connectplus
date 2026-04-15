/**
 * Single source of truth for “People & workplace” + task hub links shared by
 * `frontend` and `frontend-mobile`. Add new entries here to keep web and mobile in sync.
 *
 * Task management uses the hierarchy board at `/tasks/hierarchy` (web and mobile).
 */

export type WorkspaceIconKey =
  | "briefcase"
  | "folderKanban"
  | "clipboardList"
  | "layoutGrid"
  | "userCircle"
  | "clock"
  | "building2"
  | "award"
  | "banknote"
  | "calendarDays"
  | "alertCircle";

export type WorkspaceNavLink = {
  id: string;
  path: string;
  label: string;
  iconKey: WorkspaceIconKey;
  /** If set, only these roles see the link (sidebar). */
  roles?: readonly string[];
};

/** Task hub — hierarchy board only (workplace / CRM project tasks removed). */
export const WORKSPACE_TASK_LINKS: readonly WorkspaceNavLink[] = [
  {
    id: "hierarchyBoard",
    path: "/tasks/hierarchy",
    label: "Task Board",
    iconKey: "layoutGrid",
  },
  {
    id: "portfolioProjects",
    path: "/projects/portfolio",
    label: "Portfolio projects",
    iconKey: "folderKanban",
  },
] as const;

/** “People & workplace” section (Profile … complaint). */
export const PEOPLE_WORKPLACE_LINKS: readonly WorkspaceNavLink[] = [
  { id: "profile", path: "/profile", label: "Profile", iconKey: "userCircle" },
  { id: "attendance", path: "/attendance", label: "Attendance", iconKey: "clock" },
  { id: "meetingRooms", path: "/meeting-rooms", label: "Meeting room booking", iconKey: "building2" },
  { id: "skills", path: "/skills", label: "Skills", iconKey: "award" },
  { id: "payroll", path: "/payroll", label: "Payroll", iconKey: "banknote" },
  { id: "leaves", path: "/leaves", label: "Leaves", iconKey: "calendarDays" },
  { id: "complaints", path: "/complaints", label: "Raise a complaint", iconKey: "alertCircle" },
] as const;

export const PEOPLE_WORKPLACE_SECTION_TITLE = "People & workplace";

/** Path prefixes any signed-in user may access (department ignored). Keep in sync with new shared links. */
const UNIVERSAL_PATH_PREFIXES: readonly string[] = [
  "/dashboard",
  "/workspace",
  "/tasks",
  "/projects",
  "/inbox",
  "/profile",
  "/attendance",
  "/meeting-rooms",
  "/skills",
  "/payroll",
  "/leaves",
  "/complaints",
];

export function isUniversalWorkspacePath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  if (path === "/") {
    return true;
  }
  return UNIVERSAL_PATH_PREFIXES.some(prefix => prefix !== "/" && (path === prefix || path.startsWith(`${prefix}/`)));
}

export function isHierarchyTaskPath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  return path === "/tasks/hierarchy" || path.startsWith("/tasks/hierarchy/");
}

/** Sidebar / NavLink active state (web + mobile). */
export function navLinkIsActive(linkPath: string, pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  if (linkPath === "/tasks/hierarchy") {
    return isHierarchyTaskPath(path);
  }
  if (linkPath === "/projects/portfolio") {
    return path === "/projects/portfolio" || path.startsWith("/projects/portfolio/");
  }
  return path === linkPath || path.startsWith(`${linkPath}/`);
}

/** Post-login landing (mobile) — task board. */
export const MOBILE_DEFAULT_HOME_PATH = "/tasks/hierarchy";
