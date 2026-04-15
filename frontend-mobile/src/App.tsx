import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import axios from "axios";
import { exchangeMicrosoftAuthCodeForAccessToken } from "@shared/microsoftSpaTokenExchange";
import {
  ArrowLeft,
  Filter,
  Search,
  Bell,
  LogOut,
  Menu,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "./lib/api";
import {
  formatHierarchyAssigneeNames,
  formatTaskCompletionDuration,
  hierarchyArtifactDownloadUrl,
  hierarchyTasksApi,
  isUserHierarchyAssignee,
  parseCompletionApprovedDuration,
} from "./lib/hierarchyTasksApi";
import type {
  AssignableUser,
  DirectTaskStatus,
  HierarchyTaskDetail,
  HierarchyTaskListItem,
  TaskPriority,
  TaskStatus as HierarchyTaskStatus,
} from "./lib/hierarchyTasksApi";
import { hierarchyTaskKeys } from "./lib/queryKeys";
import { MobilePortfolioProjectsPage } from "./pages/portfolioProjectsMobile";
import { MobileSkillsPage } from "./pages/skillsMobile";
import { getHierarchyErrorMessage } from "./lib/hierarchyError";
import { canUserAssignTasks, isOrganizationMemberRole } from "./lib/taskHierarchy";
import { canAccessHr } from "./lib/hrAccess";
import { HR_MODULES_STATIC } from "./lib/hrModules";
import { LeavesPageContent } from "@leaves-ui";
import { DepartmentManagementContent } from "./pages/DepartmentManagement";
import { HrUserProfileContent } from "./pages/HrUserProfile";
import { HrHomeContent } from "./pages/HrHome";
import { ReimbursementPageContent } from "@reimbursement-ui";
import { MeetingRoomsPageContent } from "@meeting-rooms-ui";
import ProfilePage from "./pages/profile/ProfilePage";
import AttendancePage from "./pages/attendance/AttendancePage";
import { ShellNavigation, type HrModuleRow } from "./components/shell/ShellNavigation";
import { MobileBottomDock } from "./components/shell/MobileBottomDock";
import { fetchNotifications, markNotificationRead, type AppNotification } from "./lib/notificationsApi";
import { AuthUser, useAuthStore } from "./stores/authStore";
import { MOBILE_DEFAULT_HOME_PATH } from "@shared/workspaceNav";

function formatTaskDate(dateString: string | null) {
  if (!dateString) return "No due date";
  return new Date(dateString).toLocaleDateString();
}

function resolveMicrosoftRedirectUri() {
  const configuredBaseUrl = import.meta.env.VITE_PUBLIC_APP_URL;
  if (configuredBaseUrl && configuredBaseUrl.trim()) {
    const base = configuredBaseUrl.trim().replace(/\/+$/, "");
    return base.endsWith("/login") ? base : `${base}/login`;
  }
  return `${window.location.origin}/login`;
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore(s => s.user);
  const clearUser = useAuthStore(s => s.clearUser);
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: notificationPayload, refetch: refetchNotifications } = useQuery({
    queryKey: ["app-notifications"],
    queryFn: () => fetchNotifications(80),
    enabled: Boolean(user),
    staleTime: 20_000,
    refetchInterval: 45_000,
  });
  const notificationsList: AppNotification[] = notificationPayload?.notifications ?? [];
  const unreadCount = notificationPayload?.unreadCount ?? 0;

  useEffect(() => {
    if (notificationsOpen && user) {
      void refetchNotifications();
    }
  }, [notificationsOpen, user, refetchNotifications]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/auth/logout");
    },
    onSettled: () => {
      clearUser();
      setMenuOpen(false);
      navigate("/login");
    },
  });

  useEffect(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen && !notificationsOpen) {
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, notificationsOpen]);

  const closeMenu = () => setMenuOpen(false);

  const navLinkClass = (active: boolean) =>
    `mobile-tap flex min-w-0 items-center gap-3 break-words rounded-xl px-4 py-3.5 text-sm font-medium transition-colors ${
      active ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-primary)] hover:bg-[var(--bg-base)]"
    }`;

  const showHrNav = canAccessHr(user);

  const { data: hrModulesData } = useQuery({
    queryKey: ["hr-modules"],
    queryFn: async () => {
      const response = await api.get("/api/hr/modules");
      return response.data?.data?.modules as HrModuleRow[] | undefined;
    },
    enabled: showHrNav,
  });
  const hrModules: HrModuleRow[] = hrModulesData?.length ? hrModulesData : [...HR_MODULES_STATIC];

  const hrHomeExact = location.pathname === "/hr" || location.pathname === "/hr/";
  const hrChildActive = hrModules.some(
    m => location.pathname === m.path || location.pathname.startsWith(`${m.path}/`),
  );
  const [hrModulesOpen, setHrModulesOpen] = useState(() => hrChildActive || hrHomeExact);

  useEffect(() => {
    if (hrChildActive || hrHomeExact) {
      setHrModulesOpen(true);
    }
  }, [hrChildActive, hrHomeExact]);

  const canQuickAssign = Boolean(user?.role && canUserAssignTasks(user.role));

  return (
    <div className="flex min-h-[100dvh] min-h-screen w-full flex-col bg-[var(--bg-base)] lg:h-[100dvh] lg:max-h-screen lg:flex-row lg:overflow-hidden">
      <aside
        className="hidden h-full min-h-0 w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)]/95 lg:flex lg:flex-col"
        aria-label="Workspace navigation"
      >
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Connectplus</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">CRM Workspace</p>
        </div>
        <ShellNavigation
          user={user}
          pathname={location.pathname}
          navLinkClass={navLinkClass}
          showHrNav={showHrNav}
          hrModules={hrModules}
          hrModulesOpen={hrModulesOpen}
          setHrModulesOpen={setHrModulesOpen}
          onNavigate={() => {}}
          canQuickAssign={canQuickAssign}
        />
        {user ? (
          <div className="mt-auto shrink-0 space-y-3 border-t border-[var(--border)] p-4">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="flex w-full items-center gap-3 rounded-xl bg-[var(--bg-base)] p-3 text-left transition hover:bg-[var(--bg-elevated)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--accent-primary)]">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name || "User"}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{user.email || user.role}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : null}
      </aside>

      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-x-hidden lg:mx-0 lg:max-w-none">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-surface)]/95 px-3 pb-3 pt-[max(0.75rem,var(--safe-top))] backdrop-blur sm:px-4 sm:pb-4 sm:pt-[max(1rem,var(--safe-top))] lg:px-6 lg:pb-4 lg:pt-4">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="mobile-tap mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] active:bg-[var(--bg-elevated)] lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="app-drawer"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" strokeWidth={2.25} />
          </button>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] sm:text-[11px] sm:tracking-[0.24em]">
              <span className="lg:hidden">Connectplus CRM Mobile</span>
              <span className="hidden lg:inline">Connectplus CRM</span>
            </p>
            <h1 className="mt-0.5 text-base font-semibold leading-tight sm:mt-1 sm:text-lg lg:text-xl">{title}</h1>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-muted)] sm:text-xs lg:text-sm">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="mobile-tap relative mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] active:bg-[var(--bg-elevated)]"
            aria-expanded={notificationsOpen}
            aria-controls="notifications-panel"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          >
            <Bell className="h-5 w-5" strokeWidth={2.25} />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[10px] font-bold leading-none text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
        </div>
        {user && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3 lg:hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--accent-primary)]">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name || "User"}</p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                {user.email || user.role}
              </p>
            </div>
          </div>
        )}
      </header>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-4 pb-[max(5.5rem,calc(1.25rem+var(--safe-bottom)))] lg:px-8 lg:pb-6 lg:pt-6">
        <div className="mx-auto w-full min-w-0 max-w-full lg:max-w-5xl xl:max-w-6xl">{children}</div>
      </main>

      </div>

      {/* Mount only when open — invisible full-screen layers were stacking above the bottom bar (flash then hide). */}
      {menuOpen ? (
        <div className="fixed inset-0 z-[110] lg:hidden" aria-hidden={false}>
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <aside
            id="app-drawer"
            className="absolute left-0 top-0 flex h-full max-h-[100dvh] w-[min(20rem,88vw)] max-w-full flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Menu</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">ConnectPlus</p>
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className="mobile-tap inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)]"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ShellNavigation
              user={user}
              pathname={location.pathname}
              navLinkClass={navLinkClass}
              showHrNav={showHrNav}
              hrModules={hrModules}
              hrModulesOpen={hrModulesOpen}
              setHrModulesOpen={setHrModulesOpen}
              onNavigate={closeMenu}
              canQuickAssign={canQuickAssign}
            />
            <div className="border-t border-[var(--border)] p-4 pb-[max(1rem,var(--safe-bottom))]">
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                className="mobile-tap mobile-tap-strong flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3.5 text-sm font-medium text-[var(--text-primary)]"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {notificationsOpen ? (
        <div className="fixed inset-0 z-[110]" aria-hidden={false}>
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Close notifications"
            onClick={() => setNotificationsOpen(false)}
          />
          <aside
            id="notifications-panel"
            className="absolute right-0 top-0 flex h-full max-h-[100dvh] w-[min(20rem,88vw)] max-w-full flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl lg:w-[24rem] lg:max-w-[min(24rem,calc(100vw-4rem))]"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Alerts
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="mobile-tap inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)]"
                aria-label="Close notifications"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {notificationsList.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                  <Bell className="h-10 w-10 text-[var(--text-muted)] opacity-40" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-[var(--text-primary)]">You&apos;re all caught up</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Task assignments, status changes, comments, and files will appear here.
                  </p>
                </div>
              ) : (
                <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
                  {notificationsList.map(n => {
                    const taskId = n.metadata && typeof n.metadata.hierarchyTaskId === "number" ? n.metadata.hierarchyTaskId : null;
                    const unread = !n.readAt;
                    return (
                      <li key={n.id} className="border-b border-[var(--border)]/60 last:border-b-0">
                        <button
                          type="button"
                          className={`mobile-tap w-full rounded-xl px-3 py-3 text-left ${
                            unread ? "bg-[var(--accent-primary)]/6" : "hover:bg-[var(--bg-base)]"
                          }`}
                          onClick={async () => {
                            if (!n.readAt) {
                              try {
                                await markNotificationRead(n.id);
                                await queryClient.invalidateQueries({ queryKey: ["app-notifications"] });
                              } catch {
                                /* ignore */
                              }
                            }
                            setNotificationsOpen(false);
                            if (taskId != null) {
                              navigate(`/tasks/hierarchy/${taskId}`);
                            }
                          }}
                        >
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{n.title}</p>
                          <p className="mt-1 break-words text-xs text-[var(--text-muted)]">{n.message}</p>
                          <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      ) : null}

    </div>
  );
}

function MobileHierarchyTasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"mine" | "assigned_by_me" | "all">("mine");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [dueSoon, setDueSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [createAssignMode, setCreateAssignMode] = useState<"people" | "department">("people");
  const [handoffDepartment, setHandoffDepartment] = useState("");
  const [assigneePickerSearch, setAssigneePickerSearch] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);

  const listParams = useMemo(() => {
    const p: Record<string, string> = { scope };
    if (priorityFilter !== "ALL") {
      p.priority = priorityFilter;
    }
    if (dueSoon) {
      p.dueSoon = "true";
    }
    if (search.trim()) {
      p.search = search.trim();
    }
    return p;
  }, [scope, priorityFilter, dueSoon, search]);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: hierarchyTaskKeys.list(listParams),
    queryFn: () => hierarchyTasksApi.list(listParams),
    enabled: Boolean(user?.organizationId),
  });

  const canAssign = user?.role ? canUserAssignTasks(user.role) : false;
  const showAll = user?.role ? isOrganizationMemberRole(user.role) : false;

  const {
    data: assignable = [],
    isLoading: assignableLoading,
    isError: assignableLoadError,
  } = useQuery({
    queryKey: hierarchyTaskKeys.assignableUsers(),
    queryFn: () => hierarchyTasksApi.getAssignableUsers(),
    enabled: createOpen && Boolean(user?.organizationId) && createAssignMode === "people",
  });

  const { data: handoffDepartments = [], isLoading: handoffDeptsLoading } = useQuery({
    queryKey: hierarchyTaskKeys.handoffDepartments(),
    queryFn: () => hierarchyTasksApi.listHandoffDepartments(),
    enabled: createOpen && Boolean(user?.organizationId) && showAll && createAssignMode === "department",
  });

  const filteredAssignableForCreate = useMemo(() => {
    const q = assigneePickerSearch.trim().toLowerCase();
    if (!q) {
      return assignable;
    }
    return assignable.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.name.toLowerCase().includes(q) ||
        (u.department?.toLowerCase().includes(q) ?? false),
    );
  }, [assignable, assigneePickerSearch]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!date || !time) {
        throw new Error("Pick date and time");
      }
      const local = new Date(`${date}T${time}:00`);
      if (local.getTime() < Date.now()) {
        throw new Error("Deadline cannot be in the past");
      }
      if (createAssignMode === "department") {
        if (!handoffDepartment.trim()) {
          throw new Error("Choose a department");
        }
        return hierarchyTasksApi.create({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          deadline: local.toISOString(),
          assignToDepartment: handoffDepartment.trim(),
        });
      }
      if (selectedAssigneeIds.length === 0) {
        throw new Error("Choose at least one assignee");
      }
      return hierarchyTasksApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        deadline: local.toISOString(),
        assignedToIds: selectedAssigneeIds,
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setSelectedAssigneeIds([]);
      setCreateAssignMode("people");
      setHandoffDepartment("");
      setCreateErr(null);
      await queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.lists() });
    },
    onError: err => setCreateErr(getHierarchyErrorMessage(err)),
  });

  useEffect(() => {
    if (!createOpen) {
      setCreateAssignMode("people");
      setHandoffDepartment("");
      setAssigneePickerSearch("");
    }
  }, [createOpen]);

  useEffect(() => {
    if (searchParams.get("assign") !== "1") {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("assign");
    setSearchParams(next, { replace: true });
    if (user?.organizationId && canAssign) {
      setCreateOpen(true);
    }
  }, [searchParams, setSearchParams, canAssign, user?.organizationId]);

  if (!user?.organizationId) {
    return (
      <Shell title="Task Board" subtitle="Hierarchy tasks">
        <p className="max-w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          Your account is not linked to an organization.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title="Task Board" subtitle="Assign and track work by hierarchy">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScope("mine")}
            className={`mobile-tap rounded-full px-3 py-1.5 text-xs font-medium ${
              scope === "mine" ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-surface)]"
            }`}
          >
            My tasks
          </button>
          <button
            type="button"
            onClick={() => setScope("assigned_by_me")}
            className={`mobile-tap rounded-full px-3 py-1.5 text-xs font-medium ${
              scope === "assigned_by_me" ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-surface)]"
            }`}
          >
            By me
          </button>
          {showAll ? (
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`mobile-tap rounded-full px-3 py-1.5 text-xs font-medium ${
                scope === "all" ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-surface)]"
              }`}
            >
              All
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="mobile-tap mobile-tap-strong flex w-full min-w-0 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] py-3 text-sm font-medium"
        >
          <Filter className="h-4 w-4 shrink-0" />
          Filters
        </button>

        <input
          className="min-w-0 max-w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm"
          placeholder="Search title or assignee…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {isLoading ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">No tasks match.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t: HierarchyTaskListItem) => (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(`/tasks/hierarchy/${t.id}`)}
                className="mobile-tap w-full max-w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-left"
              >
                <p className="break-words font-semibold text-[var(--text-primary)]">{t.title}</p>
                <p className="mt-1 break-words text-xs text-[var(--text-muted)]">
                  {formatHierarchyAssigneeNames(t)} · {format(new Date(t.deadline), "PPp")}
                </p>
                <p className="mt-1 text-[10px] uppercase text-[var(--text-muted)]">{t.status.replaceAll("_", " ")}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {filterOpen ? (
          <motion.div
            key="filters"
            className="fixed inset-0 z-[100] flex items-end justify-center px-3 pb-[max(0.5rem,var(--safe-bottom))] pt-10 sm:px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="presentation"
          >
            <motion.button
              type="button"
              aria-label="Close filters"
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFilterOpen(false)}
            />
            <motion.div
              className="relative z-[1] mx-auto w-full min-w-0 max-w-lg max-h-[min(70vh,_calc(100dvh-2rem))] overflow-y-auto overflow-x-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 pb-[max(1rem,var(--safe-bottom))] shadow-2xl"
              initial={{ y: "105%" }}
              animate={{ y: 0 }}
              exit={{ y: "105%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
            >
            <p className="text-sm font-semibold">Filters</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dueSoon} onChange={e => setDueSoon(e.target.checked)} />
              Due within 24h
            </label>
            <p className="mt-3 text-xs text-[var(--text-muted)]">Priority</p>
            <select
              className="mt-1 w-full max-w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className="mobile-tap mobile-tap-strong mt-4 w-full rounded-2xl bg-[var(--accent-primary)] py-3 text-sm font-medium text-white"
            >
              Done
            </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {createOpen ? (
          <motion.div
            key="create-task"
            className="fixed inset-0 z-[100] flex flex-col justify-end items-center px-3 pb-[max(0.5rem,var(--safe-bottom))] pt-10 lg:justify-center lg:px-4 lg:pb-4 lg:pt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreateOpen(false)}
            />
            <motion.div
              className="relative z-[1] flex w-full min-w-0 max-w-md max-h-[min(88dvh,calc(100dvh-1.25rem))] flex-col overflow-hidden rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl lg:max-h-[min(88vh,42rem)] lg:rounded-2xl lg:shadow-[0_25px_50px_-12px_rgba(10,15,30,0.18)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 340 }}
            >
            <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <div className="p-4 pb-[max(1rem,var(--safe-bottom))] sm:p-5 lg:p-6">
            <div className="mb-3 flex justify-center lg:hidden" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">New task</p>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="mobile-tap -mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--bg-base)]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {createErr ? <p className="mt-2 text-xs text-red-600">{createErr}</p> : null}
            <input
              className="mt-3 w-full max-w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <textarea
              className="mt-2 min-h-[56px] w-full max-w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
              placeholder="Description"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <select
              className="mt-2 w-full max-w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
            >
              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div className="mt-2 flex min-w-0 gap-2">
              <input
                type="date"
                className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-2 py-2 text-sm"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
              <input
                type="time"
                className="w-[6.5rem] shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-2 py-2 text-sm"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
            <div className="mt-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-base)] p-3">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] text-[var(--accent-primary)] ring-1 ring-[var(--border)]">
                  <UserPlus className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Assign to</p>
                  {showAll ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateAssignMode("people")}
                        className={`mobile-tap rounded-full px-3 py-1.5 text-xs font-medium ${
                          createAssignMode === "people"
                            ? "bg-[var(--accent-primary)] text-white"
                            : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                        }`}
                      >
                        People
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateAssignMode("department")}
                        className={`mobile-tap rounded-full px-3 py-1.5 text-xs font-medium ${
                          createAssignMode === "department"
                            ? "bg-[var(--accent-primary)] text-white"
                            : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                        }`}
                      >
                        Department
                      </button>
                    </div>
                  ) : null}
                  {createAssignMode === "department" ? (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Managers in that department get the task and add teammates (Manager tag, direct reports, or
                      Manager role).
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Search below, then tap someone to add or remove.
                    </p>
                  )}
                  {createAssignMode === "people" && selectedAssigneeIds.length > 0 ? (
                    <p className="mt-1.5 text-xs font-medium text-[var(--accent-primary)]">
                      {selectedAssigneeIds.length} selected
                    </p>
                  ) : null}
                </div>
              </div>
              {createAssignMode === "department" && showAll ? (
                <div className="mt-3">
                  <label className="text-xs text-[var(--text-muted)]">Department</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
                    value={handoffDepartment}
                    onChange={e => setHandoffDepartment(e.target.value)}
                    disabled={handoffDeptsLoading}
                  >
                    <option value="">Select…</option>
                    {handoffDepartments.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                {createAssignMode === "people" && assignableLoading ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-4 py-5 text-center">
                    <p className="text-sm text-[var(--text-muted)]">Loading people…</p>
                  </div>
                ) : createAssignMode === "people" && assignableLoadError ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-4 py-5 text-center">
                    <p className="text-sm text-red-600">Could not load assignees. Try again.</p>
                  </div>
                ) : createAssignMode === "people" && assignable.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-4 py-5 text-center">
                    <UserPlus className="h-9 w-9 text-[var(--text-muted)] opacity-50" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-[var(--text-primary)]">No one available to assign</p>
                    <p className="max-w-[16rem] text-xs leading-relaxed text-[var(--text-muted)]">
                      You only see users in your org that match your role rules. If your profile has a department, the
                      list is limited to that department. Ask an admin to set departments and roles if the list should
                      not be empty.
                    </p>
                  </div>
                ) : createAssignMode === "people" ? (
                  <>
                    <div className="border-b border-[var(--border)] p-2">
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                          aria-hidden
                        />
                        <input
                          type="search"
                          enterKeyHint="search"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                          placeholder="Search name, email, role, department…"
                          value={assigneePickerSearch}
                          onChange={e => setAssigneePickerSearch(e.target.value)}
                          autoComplete="off"
                          autoCorrect="off"
                        />
                      </div>
                    </div>
                    {filteredAssignableForCreate.length === 0 ? (
                      <div className="px-4 py-5 text-center text-sm text-[var(--text-muted)]">
                        No one matches your search. Try another term or clear the field.
                      </div>
                    ) : (
                  <ul className="scrollbar-none max-h-[min(12rem,28dvh)] divide-y divide-[var(--border)] overflow-y-auto overscroll-contain">
                    {filteredAssignableForCreate.map(u => {
                      const on = selectedAssigneeIds.includes(u.id);
                      return (
                        <li key={u.id}>
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() =>
                              setSelectedAssigneeIds(prev =>
                                on ? prev.filter(x => x !== u.id) : [...prev, u.id],
                              )
                            }
                            className={`mobile-tap flex min-h-[48px] w-full items-center gap-2 px-3 py-3 text-left text-sm ${
                              on
                                ? "bg-[var(--accent-primary)]/12 font-medium text-[var(--text-primary)] ring-2 ring-inset ring-[var(--accent-primary)]/30"
                                : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/80 active:bg-[var(--bg-elevated)]"
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                                on
                                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                                  : "border-[var(--border)] bg-[var(--bg-base)] text-transparent"
                              }`}
                              aria-hidden
                            >
                              ✓
                            </span>
                            <span className="min-w-0 flex-1 break-words">
                              <span className="block">{u.name}</span>
                              <span className="mt-0.5 block text-xs font-normal text-[var(--text-muted)]">
                                {u.role.name}
                                {u.department ? ` · ${u.department}` : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                    )}
                  </>
                ) : (
                  <div className="px-4 py-5 text-center text-sm text-[var(--text-muted)]">
                    {handoffDeptsLoading ? "Loading departments…" : "Pick a department above."}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={
                createMutation.isPending ||
                (createAssignMode === "people"
                  ? selectedAssigneeIds.length === 0
                  : !handoffDepartment.trim())
              }
              onClick={() => createMutation.mutate()}
              className="mobile-tap mobile-tap-strong mt-5 w-full rounded-2xl bg-[var(--accent-primary)] py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving…" : "Assign task"}
            </button>
            </div>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Shell>
  );
}

function MobileHierarchyTaskDetailPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const id = taskId ? parseInt(taskId, 10) : NaN;
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [directStatus, setDirectStatus] = useState<DirectTaskStatus>("PENDING");
  const [statusFile, setStatusFile] = useState<File | null>(null);
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: task, isLoading } = useQuery({
    queryKey: Number.isFinite(id) ? hierarchyTaskKeys.detail(id) : ["ht-detail", "x"],
    queryFn: () => hierarchyTasksApi.get(id),
    enabled: Number.isFinite(id),
  });

  useEffect(() => {
    if (task && ["PENDING", "IN_PROGRESS", "ON_HOLD", "CANCELLED"].includes(task.status)) {
      setDirectStatus(task.status as DirectTaskStatus);
      setStatusFile(null);
    }
  }, [task]);

  const invalidateTask = async () => {
    await queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.detail(id) });
    await queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.lists() });
  };

  const applyDirectMutation = useMutation({
    mutationFn: async () => {
      const cur = queryClient.getQueryData<HierarchyTaskDetail>(hierarchyTaskKeys.detail(id));
      if (!cur) {
        throw new Error("Task not loaded");
      }
      let artifactId: number | undefined;
      if (statusFile) {
        const fd = new FormData();
        fd.append("file", statusFile);
        fd.append("kind", "STATUS_CHANGE");
        fd.append("statusFrom", cur.status);
        fd.append("statusTo", directStatus);
        const up = await hierarchyTasksApi.uploadArtifact(id, fd);
        artifactId = up.artifactId;
      }
      return hierarchyTasksApi.updateStatus(id, { status: directStatus, artifactId });
    },
    onSuccess: async () => {
      setStatusFile(null);
      await invalidateTask();
    },
  });

  const addRecordMutation = useMutation({
    mutationFn: async () => {
      if (!recordFile) {
        throw new Error("Pick a file");
      }
      const fd = new FormData();
      fd.append("file", recordFile);
      fd.append("kind", "GENERAL");
      return hierarchyTasksApi.uploadArtifact(id, fd);
    },
    onSuccess: async () => {
      setRecordFile(null);
      await invalidateTask();
    },
  });

  const requestCompletionMutation = useMutation({
    mutationFn: async () => {
      if (!completionFile) {
        throw new Error("Completion proof required");
      }
      const fd = new FormData();
      fd.append("file", completionFile);
      return hierarchyTasksApi.requestCompletion(id, fd);
    },
    onSuccess: async () => {
      setCompletionFile(null);
      await invalidateTask();
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => hierarchyTasksApi.approveCompletion(id),
    onSuccess: invalidateTask,
  });

  const rejectMutation = useMutation({
    mutationFn: () => hierarchyTasksApi.rejectCompletion(id, rejectReason.trim() || undefined),
    onSuccess: async () => {
      setRejectReason("");
      await invalidateTask();
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => hierarchyTasksApi.addComment(id, comment.trim()),
    onSuccess: async () => {
      setComment("");
      await queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.detail(id) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => hierarchyTasksApi.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.lists() });
      navigate("/tasks/hierarchy");
    },
  });

  const isOrgMember = user?.role ? isOrganizationMemberRole(user.role) : false;
  const canEdit = Boolean(user && task && (task.assignedBy.id === user.id || isOrgMember));
  const assigneeWorkflowOpen = Boolean(
    task &&
      task.status !== "COMPLETED" &&
      task.status !== "CANCELLED" &&
      task.status !== "COMPLETION_PENDING_APPROVAL",
  );
  const usesTaskScopedAssignable = Boolean(
    user &&
      task &&
      isUserHierarchyAssignee(task, user.id) &&
      task.assignedBy.id !== user.id &&
      !isOrgMember,
  );
  const canManageAssignees = Boolean(
    user &&
      task &&
      assigneeWorkflowOpen &&
      (task.assignedBy.id === user.id || isOrgMember || isUserHierarchyAssignee(task, user.id)),
  );
  const canStatus = Boolean(
    user &&
      task &&
      (isUserHierarchyAssignee(task, user.id) || task.assignedBy.id === user.id || isOrgMember),
  );

  const [assigneeIdsDraft, setAssigneeIdsDraft] = useState<number[]>([]);
  const [assigneeSearchEdit, setAssigneeSearchEdit] = useState("");
  const [assigneeSaveError, setAssigneeSaveError] = useState("");

  const assigneeRowsKey = task
    ? (task.assignees.length ? task.assignees : task.assignedTo ? [task.assignedTo] : [])
        .map(a => a.id)
        .sort()
        .join(",")
    : "";

  useEffect(() => {
    if (!task) {
      return;
    }
    const rows = task.assignees.length ? task.assignees : task.assignedTo ? [task.assignedTo] : [];
    setAssigneeIdsDraft(rows.map(a => a.id));
    setAssigneeSearchEdit("");
    setAssigneeSaveError("");
  }, [task?.id, assigneeRowsKey]);

  const { data: assignableForEdit = [], isLoading: loadingAssignableEdit } = useQuery({
    queryKey: hierarchyTaskKeys.assignableUsers(usesTaskScopedAssignable ? id : undefined),
    queryFn: () =>
      usesTaskScopedAssignable ? hierarchyTasksApi.getAssignableUsers(id) : hierarchyTasksApi.getAssignableUsers(),
    enabled: Number.isFinite(id) && canManageAssignees,
  });

  const mergedAssignableForEdit = useMemo(() => {
    if (!task) {
      return assignableForEdit;
    }
    const map = new Map<number, AssignableUser>(assignableForEdit.map(u => [u.id, u]));
    const rows = task.assignees.length ? task.assignees : task.assignedTo ? [task.assignedTo] : [];
    for (const a of rows) {
      if (!map.has(a.id)) {
        map.set(a.id, {
          id: a.id,
          name: a.name,
          email: a.email,
          department: a.department,
          role: { name: a.role.name },
        });
      }
    }
    return [...map.values()];
  }, [task, assignableForEdit]);

  const filteredAssignableEdit = useMemo(() => {
    const q = assigneeSearchEdit.trim().toLowerCase();
    if (!q) {
      return mergedAssignableForEdit;
    }
    return mergedAssignableForEdit.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.name.toLowerCase().includes(q) ||
        (u.department?.toLowerCase().includes(q) ?? false),
    );
  }, [mergedAssignableForEdit, assigneeSearchEdit]);

  const selectedAssignableUsers = useMemo(() => {
    const map = new Map(mergedAssignableForEdit.map(u => [u.id, u]));
    return assigneeIdsDraft.map(sid => map.get(sid)).filter(Boolean) as AssignableUser[];
  }, [mergedAssignableForEdit, assigneeIdsDraft]);

  const assigneesDraftDirty = useMemo(() => {
    if (!task) {
      return false;
    }
    const cur = (task.assignees.length ? task.assignees : task.assignedTo ? [task.assignedTo] : [])
      .map(a => a.id)
      .sort()
      .join(",");
    const dr = [...assigneeIdsDraft].sort().join(",");
    return cur !== dr;
  }, [task, assigneeIdsDraft]);

  const updateAssigneesMutation = useMutation({
    mutationFn: () => hierarchyTasksApi.update(id, { assignedToIds: assigneeIdsDraft }),
    onSuccess: async () => {
      setAssigneeSaveError("");
      await invalidateTask();
    },
    onError: err => setAssigneeSaveError(getHierarchyErrorMessage(err)),
  });

  if (!Number.isFinite(id)) {
    return <Navigate to="/tasks/hierarchy" replace />;
  }

  if (isLoading || !task) {
    return (
      <Shell title="Task" subtitle="Loading">
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">Loading…</p>
      </Shell>
    );
  }

  const t = task as HierarchyTaskDetail;

  const completionRequesterId = t.completionRequest?.requestedBy.id;
  const canApproveCompletion = Boolean(
    user &&
      t.status === "COMPLETION_PENDING_APPROVAL" &&
      completionRequesterId != null &&
      completionRequesterId !== user.id &&
      canStatus,
  );
  const workflowOpen =
    t.status !== "COMPLETED" &&
    t.status !== "CANCELLED" &&
    t.status !== "COMPLETION_PENDING_APPROVAL";

  const directStatuses: DirectTaskStatus[] = ["PENDING", "IN_PROGRESS", "ON_HOLD", "CANCELLED"];

  return (
    <Shell title="Task" subtitle="Hierarchy assignment">
      <div className="min-w-0 space-y-4">
        <button
          type="button"
          onClick={() => navigate("/tasks/hierarchy")}
          className="mobile-tap inline-flex max-w-full items-center gap-2 text-sm text-[var(--accent-primary)]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back to board
        </button>

        {t.assignmentMode === "DEPARTMENT_HANDOFF" ? (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm">
            <p className="font-semibold text-[var(--text-primary)]">Department handoff</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Routed to <strong>{t.handoffTargetDepartment ?? t.department ?? "department"}</strong>. Managers on this
              task should add teammates; everyone must stay in that department.
            </p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h2 className="break-words text-lg font-semibold">{t.title}</h2>
          <p className="mt-2 break-words text-sm text-[var(--text-muted)]">{t.description || "No description."}</p>
          <p className="mt-3 break-words text-xs text-[var(--text-muted)]">
            From {t.assignedBy.name} → {formatHierarchyAssigneeNames(t)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Status: {t.status.replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{format(new Date(t.deadline), "PPp")}</p>
        </div>

        {canManageAssignees ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-semibold">{usesTaskScopedAssignable ? "Transfer task" : "Assignees"}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {usesTaskScopedAssignable
                ? t.assignmentMode === "DEPARTMENT_HANDOFF"
                  ? "Search and select one or more people in the handoff department (same rules as when this task was created)."
                  : "Search and select one or more people to reassign this task. Choices follow the same rules as the original assignment."
                : t.assignmentMode === "DEPARTMENT_HANDOFF"
                  ? "Add people in the handoff department only (same rules as task scope)."
                  : "Add or remove people (same department and role rules as new tasks)."}
            </p>
            {selectedAssignableUsers.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedAssignableUsers.map(u => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-base)] py-0.5 pl-2.5 pr-1 text-xs font-medium"
                  >
                    {u.name}
                    <button
                      type="button"
                      onClick={() =>
                        setAssigneeIdsDraft(prev => (prev.length <= 1 ? prev : prev.filter(x => x !== u.id)))
                      }
                      className="rounded-full p-0.5 text-[var(--text-muted)]"
                      aria-label={`Remove ${u.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] py-2 pl-9 pr-3 text-sm"
                placeholder="Search people…"
                value={assigneeSearchEdit}
                onChange={e => setAssigneeSearchEdit(e.target.value)}
              />
            </div>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-base)]">
              {loadingAssignableEdit ? (
                <p className="p-3 text-xs text-[var(--text-muted)]">Loading…</p>
              ) : filteredAssignableEdit.length === 0 ? (
                <p className="p-3 text-xs text-[var(--text-muted)]">No matching people.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {filteredAssignableEdit.map(u => {
                    const selected = assigneeIdsDraft.includes(u.id);
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() =>
                            setAssigneeIdsDraft(prev => {
                              if (selected) {
                                if (prev.length <= 1) {
                                  return prev;
                                }
                                return prev.filter(x => x !== u.id);
                              }
                              return [...prev, u.id];
                            })
                          }
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                            selected ? "bg-[var(--accent-primary)]/15" : ""
                          }`}
                        >
                          <span className="font-medium">
                            {selected ? "✓ " : ""}
                            {u.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                            {u.department ?? u.role.name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {assigneeSaveError ? <p className="mt-2 text-xs text-red-600">{assigneeSaveError}</p> : null}
            <button
              type="button"
              disabled={
                updateAssigneesMutation.isPending || !assigneesDraftDirty || assigneeIdsDraft.length === 0
              }
              onClick={() => updateAssigneesMutation.mutate()}
              className="mobile-tap mobile-tap-strong mt-3 w-full rounded-2xl bg-[var(--accent-primary)] py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {updateAssigneesMutation.isPending ? "…" : usesTaskScopedAssignable ? "Save transfer" : "Save assignees"}
            </button>
          </div>
        ) : null}

        {t.status === "COMPLETION_PENDING_APPROVAL" && t.completionRequest ? (
          <div className="rounded-2xl border border-violet-500/35 bg-violet-500/10 p-4 text-sm">
            <p className="font-semibold">Completion approval pending</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              By {t.completionRequest.requestedBy.name}. Another assignee or creator must approve.
            </p>
            {t.completionRequest.artifact ? (
              <a
                href={hierarchyArtifactDownloadUrl(id, t.completionRequest.artifact.id)}
                className="mt-2 inline-block text-xs font-medium text-[var(--accent-primary)]"
                target="_blank"
                rel="noreferrer"
              >
                Open proof file
              </a>
            ) : null}
            {canApproveCompletion ? (
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate()}
                  className="mobile-tap mobile-tap-strong w-full rounded-2xl bg-[var(--accent-primary)] py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {approveMutation.isPending ? "…" : "Approve completion"}
                </button>
                <textarea
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-xs"
                  placeholder="Reject reason (optional)"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={2}
                />
                <button
                  type="button"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}
                  className="mobile-tap mobile-tap-strong w-full rounded-2xl border border-red-500/40 py-3 text-sm text-red-600 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {canStatus && workflowOpen ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-semibold">Change status</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Completed requires proof + approval below.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {directStatuses.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDirectStatus(s)}
                  className={`mobile-tap rounded-xl px-2 py-2 text-xs font-medium ${
                    directStatus === s ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-base)]"
                  }`}
                >
                  {s.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs text-[var(--text-muted)]">Optional file for this change</label>
            <input
              type="file"
              className="mt-1 w-full text-xs"
              onChange={e => setStatusFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => {
                if (directStatus === "CANCELLED" && !window.confirm("Cancel this task?")) {
                  return;
                }
                applyDirectMutation.mutate();
              }}
              disabled={applyDirectMutation.isPending || directStatus === t.status}
              className="mobile-tap mobile-tap-strong mt-3 w-full rounded-2xl bg-[var(--accent-primary)] py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {applyDirectMutation.isPending ? "Saving…" : "Save status"}
            </button>
            <p className="mt-4 text-sm font-semibold">Add file to record</p>
            <input
              type="file"
              className="mt-1 w-full text-xs"
              onChange={e => setRecordFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={!recordFile || addRecordMutation.isPending}
              onClick={() => addRecordMutation.mutate()}
              className="mobile-tap mobile-tap-strong mt-2 w-full rounded-2xl border border-[var(--border)] py-3 text-sm disabled:opacity-50"
            >
              Upload
            </button>
            <p className="mt-4 text-sm font-semibold">Submit for completion</p>
            <input
              type="file"
              className="mt-1 w-full text-xs"
              onChange={e => setCompletionFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={!completionFile || requestCompletionMutation.isPending}
              onClick={() => requestCompletionMutation.mutate()}
              className="mobile-tap mobile-tap-strong mt-2 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {requestCompletionMutation.isPending ? "…" : "Send for approval"}
            </button>
          </div>
        ) : null}

        {(t.artifacts ?? []).length > 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-semibold">Artefacts</p>
            <ul className="mt-2 space-y-2 text-xs">
              {(t.artifacts ?? []).map(a => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-base)] px-3 py-2">
                  <span className="min-w-0 truncate">{a.fileName}</span>
                  <a
                    href={hierarchyArtifactDownloadUrl(id, a.id)}
                    className="shrink-0 text-[var(--accent-primary)]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete this task?")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="mobile-tap mobile-tap-strong w-full rounded-2xl border border-red-500/40 py-3 text-sm text-red-600 disabled:opacity-50"
          >
            Delete task
          </button>
        )}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-sm font-semibold">Comments</p>
          <div className="mt-2 space-y-2">
            {t.comments.map(c => (
              <div key={c.id} className="rounded-xl bg-[var(--bg-base)] px-3 py-2 text-sm">
                <p className="text-xs font-medium">{c.user.name}</p>
                <p className="mt-1 break-words">{c.content}</p>
              </div>
            ))}
          </div>
          {canStatus && (
            <>
              <textarea
                className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                placeholder="Comment…"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
              <button
                type="button"
                disabled={!comment.trim() || commentMutation.isPending}
                onClick={() => commentMutation.mutate()}
                className="mobile-tap mobile-tap-strong mt-2 w-full rounded-2xl border border-[var(--border)] py-3 text-sm disabled:opacity-50"
              >
                Post
              </button>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-sm font-semibold">Activity</p>
          <ul className="mt-2 space-y-2 text-xs text-[var(--text-muted)]">
            {t.activities.map(a => {
              const completionInfo = parseCompletionApprovedDuration(
                a.action,
                a.meta,
                a.createdAt,
                t.createdAt,
              );
              return (
                <li key={a.id} className="break-words">
                  <div>
                    {a.action} · {a.user.name} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </div>
                  {completionInfo ? (
                    <div className="mt-0.5 font-medium text-[var(--text-primary)]">
                      Completed in {formatTaskCompletionDuration(completionInfo.durationMs)} from{" "}
                      {completionInfo.baselineLabel}.
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Shell>
  );
}

function ProtectedLayout() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (useAuthStore.getState().user) {
        setSessionChecked(true);
        return;
      }
      try {
        const response = await api.get("/api/auth/me");
        const currentUser = response.data?.data?.user as AuthUser | undefined;
        if (currentUser && !cancelled) {
          setUser(currentUser);
        }
      } catch {
        // Invalid or missing session; stay logged out until redirect below.
      } finally {
        if (!cancelled) {
          setSessionChecked(true);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  if (!sessionChecked) {
    return (
      <div className="flex min-h-[100dvh] min-h-screen w-full items-center justify-center overflow-x-hidden p-6 text-center text-sm text-[var(--text-muted)]">
        Loading mobile workspace...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <>
      <MobileBottomDock />
      <div className="relative min-h-0 w-full max-w-full overflow-x-hidden">
        <Outlet />
      </div>
    </>
  );
}

function MobileLeavesPage() {
  return (
    <Shell title="Leaves" subtitle="Time off requests and balances">
      <LeavesPageContent />
    </Shell>
  );
}

/** Placeholder until backend modules exist for these menu entries */
function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Shell title={title} subtitle={subtitle}>
      <div className="max-w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-10 text-center shadow-sm">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          This feature is not available in the app yet. Check back later for updates.
        </p>
      </div>
    </Shell>
  );
}

const payrollMobileTabClass = ({ isActive }: { isActive: boolean }) =>
  `mobile-tap flex-1 rounded-xl px-3 py-2.5 text-center text-xs font-semibold sm:text-sm ${
    isActive
      ? "bg-[var(--accent-primary)] text-white"
      : "border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
  }`;

function PayrollMobileLayout() {
  return (
    <Shell title="Payroll" subtitle="Pay and compensation">
      <div className="space-y-4">
        <div className="flex gap-2">
          <NavLink to="/payroll/conveyance" className={payrollMobileTabClass} end>
            Conveyance
          </NavLink>
          <NavLink to="/payroll/reimbursement" className={payrollMobileTabClass} end>
            Reimbursement
          </NavLink>
        </div>
        <div className="max-w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-10 text-center shadow-sm">
          <Outlet />
        </div>
      </div>
    </Shell>
  );
}

function PayrollMobilePlaceholderBody() {
  return (
    <p className="text-sm leading-relaxed text-[var(--text-muted)]">
      This feature is not available in the app yet. Check back later for updates.
    </p>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore(s => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/api/auth/login", { email, password });
      return response.data?.data?.user as AuthUser | undefined;
    },
    onSuccess: async () => {
      const meResponse = await api.get("/api/auth/me");
      const user = meResponse.data?.data?.user as AuthUser;
      setUser(user);
      navigate(MOBILE_DEFAULT_HOME_PATH, { replace: true });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? "Login failed");
    },
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const ssoError = urlParams.get("error");

    if (ssoError) {
      setError(`Microsoft authentication error: ${ssoError}`);
      window.history.replaceState({}, document.title, "/login");
      return;
    }

    if (code) {
      void handleMicrosoftCallback(code);
      window.history.replaceState({}, document.title, "/login");
    }
  }, []);

  const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const handleMicrosoftCallback = async (code: string) => {
    setLoading(true);
    setError(null);

    try {
      const codeVerifier = sessionStorage.getItem("msal_code_verifier");
      const redirectUri = resolveMicrosoftRedirectUri();

      if (!codeVerifier) {
        setError("Code verifier not found. Please try again.");
        setLoading(false);
        return;
      }

      const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
      const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
      if (!tenantId || !clientId) {
        setError("Microsoft SSO is not configured.");
        setLoading(false);
        return;
      }

      const accessToken = await exchangeMicrosoftAuthCodeForAccessToken({
        tenantId,
        clientId,
        code,
        codeVerifier,
        redirectUri,
      });

      await api.post("/api/auth/login/microsoft/callback", {
        accessToken,
      });

      sessionStorage.removeItem("msal_code_verifier");

      const meResponse = await api.get("/api/auth/me");
      const user = meResponse.data?.data?.user as AuthUser | undefined;
      if (!user) {
        setError("Unexpected response from server.");
        setLoading(false);
        return;
      }

      setUser(user);
      navigate(MOBILE_DEFAULT_HOME_PATH, { replace: true });
    } catch (callbackError) {
      if (axios.isAxiosError(callbackError)) {
        const status = callbackError.response?.status;
        const serverMsg = callbackError.response?.data?.message;
        if (typeof serverMsg === "string" && serverMsg.trim()) {
          setError(serverMsg.trim());
        } else if (status === 401 || status === 403) {
          setError("Microsoft authentication failed. Please ensure your account has access.");
        } else if (status && status >= 500) {
          setError("Server error while signing in. Please try again.");
        } else {
          setError("Unable to sign in with Microsoft. Please try again.");
        }
      } else if (callbackError instanceof Error && callbackError.message) {
        setError(callbackError.message);
      } else {
        setError("Unexpected error while signing in.");
      }
      setLoading(false);
    }
  };

  const handleMicrosoftSSO = async () => {
    const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
    const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
    const redirectUri = resolveMicrosoftRedirectUri();

    if (!tenantId || !clientId) {
      setError("Microsoft SSO not configured. Please contact administrator.");
      return;
    }

    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const isSecureOrigin = window.isSecureContext || window.location.protocol === "https:";
    if (!isSecureOrigin && !isLocalhost) {
      setError(
        "Microsoft SSO requires HTTPS or localhost. Open this app on HTTPS, or set VITE_PUBLIC_APP_URL to a registered HTTPS login URL."
      );
      return;
    }

    if (!window.crypto?.subtle) {
      setError(
        "This browser context cannot generate the Microsoft PKCE challenge. Use HTTPS or localhost for SSO."
      );
      return;
    }

    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      sessionStorage.setItem("msal_code_verifier", codeVerifier);

      const authUrl =
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_mode=query&` +
        `scope=User.Read&` +
        `code_challenge=${encodeURIComponent(codeChallenge)}&` +
        `code_challenge_method=S256&` +
        `prompt=select_account`;

      window.location.href = authUrl;
    } catch (ssoError) {
      const message = ssoError instanceof Error ? ssoError.message : "";
      if (message) {
        setError(`Failed to initiate Microsoft login: ${message}`);
      } else {
        setError("Failed to initiate Microsoft login. Please try again.");
      }
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    loginMutation.mutate();
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] min-h-screen w-full max-w-md flex-col justify-center overflow-x-hidden px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-full rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-sm"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Connectplus CRM Mobile
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Task-first workspace</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Sign in to manage hierarchy tasks from the same backend used by the full CRM.
        </p>

        <button
          type="button"
          onClick={() => void handleMicrosoftSSO()}
          disabled={loading || loginMutation.isPending}
          className="mobile-tap mobile-tap-strong mt-6 flex w-full max-w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] disabled:opacity-70"
        >
          <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
          </svg>
          <span>Sign in with Microsoft</span>
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--bg-surface)] px-2 text-[var(--text-muted)]">or</span>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="mt-1 w-full max-w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full max-w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={loginMutation.isPending || loading}
            className="mobile-tap mobile-tap-strong w-full max-w-full rounded-2xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-70"
          >
            {loginMutation.isPending || loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function HrGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  if (!canAccessHr(user)) {
    return <Navigate to={MOBILE_DEFAULT_HOME_PATH} replace />;
  }
  return <>{children}</>;
}

function HrSectionPlaceholderRoute() {
  const { section } = useParams<{ section: string }>();
  const title = section ? section.replace(/-/g, " ") : "HR";
  return <PlaceholderPage title={title} subtitle="This HR module is coming soon." />;
}

function AuthBoot() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .get("/api/auth/me")
      .then(response => {
        const currentUser = response.data?.data?.user as AuthUser | undefined;
        if (currentUser) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        // Ignore boot errors, route guards will handle login.
      })
      .finally(() => setReady(true));
  }, [setUser]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] min-h-screen w-full items-center justify-center overflow-x-hidden p-6 text-center text-sm text-[var(--text-muted)]">
        Loading mobile workspace...
      </div>
    );
  }

  return <Navigate to={user ? MOBILE_DEFAULT_HOME_PATH : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthBoot />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/work/:id" element={<Navigate to={MOBILE_DEFAULT_HOME_PATH} replace />} />
        <Route path="/work" element={<Navigate to={MOBILE_DEFAULT_HOME_PATH} replace />} />
        <Route path="/tasks/team" element={<Navigate to="/tasks/hierarchy" replace />} />
        <Route path="/tasks/work/:id" element={<Navigate to="/tasks/hierarchy" replace />} />
        <Route path="/tasks/work" element={<Navigate to="/tasks/hierarchy" replace />} />
        <Route path="/tasks/hierarchy/:taskId" element={<MobileHierarchyTaskDetailPage />} />
        <Route path="/tasks/hierarchy" element={<MobileHierarchyTasksPage />} />
        <Route
          path="/projects/portfolio/:projectId"
          element={
            <Shell title="Portfolio projects" subtitle="Internal and client POC delivery">
              <MobilePortfolioProjectsPage />
            </Shell>
          }
        />
        <Route
          path="/projects/portfolio"
          element={
            <Shell title="Portfolio projects" subtitle="Internal and client POC delivery">
              <MobilePortfolioProjectsPage />
            </Shell>
          }
        />
        <Route path="/tasks/:id" element={<Navigate to="/tasks/hierarchy" replace />} />
        <Route path="/tasks" element={<Navigate to="/tasks/hierarchy" replace />} />
        <Route
          path="/profile"
          element={
            <Shell title="Profile" subtitle="Account and profile photo">
              <ProfilePage />
            </Shell>
          }
        />
        <Route
          path="/attendance"
          element={
            <Shell title="Attendance" subtitle="Location and face check-in">
              <AttendancePage />
            </Shell>
          }
        />
        <Route
          path="/meeting-rooms"
          element={
            <Shell title="Meeting room booking" subtitle="Reserve rooms and shared spaces">
              <MeetingRoomsPageContent />
            </Shell>
          }
        />
        <Route
          path="/skills"
          element={
            <Shell title="Skills" subtitle="Skills and competencies">
              <MobileSkillsPage />
            </Shell>
          }
        />
        <Route path="/payroll" element={<PayrollMobileLayout />}>
          <Route index element={<Navigate to="conveyance" replace />} />
          <Route path="conveyance" element={<PayrollMobilePlaceholderBody />} />
          <Route path="reimbursement" element={<ReimbursementPageContent />} />
        </Route>
        <Route path="/hr/payroll" element={<Navigate to="/payroll" replace />} />
        <Route path="/leaves" element={<MobileLeavesPage />} />
        <Route
          path="/complaints"
          element={<PlaceholderPage title="Raise a complaint" subtitle="Submit and track internal requests" />}
        />
        <Route path="/hr/leave" element={<Navigate to="/leaves" replace />} />
        <Route
          path="/hr/departments"
          element={
            <HrGate>
              <Shell title="Department management" subtitle="CRM department list">
                <DepartmentManagementContent />
              </Shell>
            </HrGate>
          }
        />
        <Route
          path="/hr/users/:userId"
          element={
            <HrGate>
              <Shell title="Employee profile" subtitle="HR view">
                <HrUserProfileContent />
              </Shell>
            </HrGate>
          }
        />
        <Route
          path="/hr/:section"
          element={
            <HrGate>
              <HrSectionPlaceholderRoute />
            </HrGate>
          }
        />
        <Route
          path="/hr"
          element={
            <HrGate>
              <Shell title="HR" subtitle="Modules and shortcuts">
                <HrHomeContent />
              </Shell>
            </HrGate>
          }
        />
      </Route>
    </Routes>
  );
}
