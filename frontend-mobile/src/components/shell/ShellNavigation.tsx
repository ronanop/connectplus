import { NavLink } from "react-router-dom";
import {
  AlertCircle,
  Award,
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  FolderKanban,
  LayoutGrid,
  Plus,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import {
  MOBILE_DEFAULT_HOME_PATH,
  PEOPLE_WORKPLACE_LINKS,
  PEOPLE_WORKPLACE_SECTION_TITLE,
  WORKSPACE_TASK_LINKS,
  navLinkIsActive,
  type WorkspaceIconKey,
} from "@shared/workspaceNav";
import type { AuthUser } from "../../stores/authStore";

const WORKSPACE_MOBILE_ICONS: Record<WorkspaceIconKey, LucideIcon> = {
  briefcase: Briefcase,
  folderKanban: FolderKanban,
  clipboardList: ClipboardList,
  layoutGrid: LayoutGrid,
  userCircle: UserCircle,
  clock: Clock,
  building2: Building2,
  award: Award,
  banknote: Banknote,
  calendarDays: CalendarDays,
  alertCircle: AlertCircle,
};

export type HrModuleRow = { id: string; label: string; path: string };

type Props = {
  user: AuthUser | null;
  pathname: string;
  navLinkClass: (active: boolean) => string;
  showHrNav: boolean;
  hrModules: HrModuleRow[];
  hrModulesOpen: boolean;
  setHrModulesOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  onNavigate: () => void;
  canQuickAssign: boolean;
};

export function ShellNavigation({
  user,
  pathname,
  navLinkClass,
  showHrNav,
  hrModules,
  hrModulesOpen,
  setHrModulesOpen,
  onNavigate,
  canQuickAssign,
}: Props) {
  const hrHomeExact = pathname === "/hr" || pathname === "/hr/";

  return (
    <nav
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4"
      aria-label="Main"
    >
      {WORKSPACE_TASK_LINKS.filter(
        link => !link.roles?.length || (user?.role != null && link.roles.includes(user.role)),
      ).map(link => {
        const Icon = WORKSPACE_MOBILE_ICONS[link.iconKey];
        return (
          <NavLink
            key={link.id}
            to={link.path}
            onClick={onNavigate}
            className={() => navLinkClass(navLinkIsActive(link.path, pathname))}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {link.label}
          </NavLink>
        );
      })}

      {canQuickAssign ? (
        <NavLink
          to={`${MOBILE_DEFAULT_HOME_PATH}?assign=1`}
          onClick={onNavigate}
          className={() => navLinkClass(false)}
        >
          <Plus className="h-5 w-5 shrink-0" />
          Assign task
        </NavLink>
      ) : null}

      <div className="my-3 border-t border-[var(--border)] pt-3">
        <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {PEOPLE_WORKPLACE_SECTION_TITLE}
        </p>
      </div>

      {PEOPLE_WORKPLACE_LINKS.map(link => {
        const Icon = WORKSPACE_MOBILE_ICONS[link.iconKey];
        return (
          <NavLink
            key={link.id}
            to={link.path}
            onClick={onNavigate}
            className={() => navLinkClass(navLinkIsActive(link.path, pathname))}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {link.label}
          </NavLink>
        );
      })}

      {showHrNav ? (
        <>
          <div className="my-3 border-t border-[var(--border)] pt-3">
            <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">HR</p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-stretch gap-0.5">
              <button
                type="button"
                aria-expanded={hrModulesOpen}
                aria-label={hrModulesOpen ? "Collapse HR modules" : "Expand HR modules"}
                onClick={() => setHrModulesOpen(o => !o)}
                className="mobile-tap flex shrink-0 items-center justify-center rounded-xl px-2 text-[var(--text-primary)] hover:bg-[var(--bg-base)]"
              >
                <ChevronRight className={`h-5 w-5 transition-transform ${hrModulesOpen ? "rotate-90" : ""}`} />
              </button>
              <NavLink to="/hr" onClick={onNavigate} className={() => navLinkClass(hrHomeExact)}>
                <LayoutGrid className="h-5 w-5 shrink-0" />
                HR home
              </NavLink>
            </div>
            {hrModulesOpen ? (
              <div className="ml-2 space-y-0.5 border-l border-[var(--border)] pl-3">
                {hrModules.map(m => {
                  const subActive = pathname === m.path || pathname.startsWith(`${m.path}/`);
                  return (
                    <NavLink key={m.id} to={m.path} onClick={onNavigate} className={() => navLinkClass(subActive)}>
                      {m.label}
                    </NavLink>
                  );
                })}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </nav>
  );
}
