import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ClipboardList,
  UserPlus,
  Building2,
  TrendingUp,
  FileSearch,
  Truck,
  Rocket,
  Cloud,
  Code,
  ShieldCheck,
  Users,
  LogOut,
  User,
  Inbox,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { canSeeNavGroup, normalizeDepartmentName } from "../../lib/accessControl";

const items = [
  {
    group: "Overview",
    links: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/tasks", label: "My Tasks", icon: ClipboardList },
      { to: "/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  {
    group: "Sales",
    links: [
      { to: "/crm/companies", label: "Company", icon: Building2 },
      { to: "/crm/leads", label: "Leads", icon: UserPlus },
      { to: "/crm/opportunities", label: "Opportunities", icon: TrendingUp },
    ],
  },
  {
    group: "Presales",
    links: [{ to: "/presales", label: "Presales", icon: FileSearch, showPresalesBadge: true }],
  },
  {
    group: "SCM",
    links: [{ to: "/scm", label: "SCM Flow", icon: Truck }],
  },
  {
    group: "Deployment",
    links: [{ to: "/deployments", label: "Deployment Flow", icon: Rocket }],
  },
  {
    group: "Cloud",
    links: [{ to: "/cloud", label: "Cloud Flow", icon: Cloud }],
  },
  {
    group: "Tools",
    links: [{ to: "/api-fetcher", label: "API Fetcher", icon: Code }],
  },
  { group: "Admin", links: [{ to: "/settings/users", label: "Users", icon: Users }] },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const clearUser = useAuthStore(s => s.clearUser);

  const role = user?.role ?? null;

  // Fetch full user details if user exists and doesn't have name/email yet
  const { data: userDetails } = useQuery({
    queryKey: ["user-details"],
    enabled: !!user && (!user.name || !user.email),
    queryFn: async () => {
      const response = await api.get("/api/auth/me");
      return response.data?.data?.user;
    },
    retry: 1,
  });

  // Update user store with full details
  React.useEffect(() => {
    if (userDetails && user) {
      useAuthStore.getState().setUser({ ...user, ...userDetails });
    }
  }, [userDetails, user]);

  // Use userDetails if available, otherwise fall back to user
  const displayUser = userDetails || user;
  const effectiveEmail = (displayUser?.email || user?.email || "").toLowerCase();
  const canSeeAdminPanel =
    (role === "SUPER_ADMIN" || role === "ADMIN") && effectiveEmail === "connectplus@cachedigitech.com";

  const navUser =
    user &&
    ({
      role: user.role,
      department: displayUser?.department ?? user.department ?? null,
    } as { role: string; department?: string | null });

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
      // Ignore errors on logout
    } finally {
      clearUser();
      navigate("/login");
    }
  };

  const canSeePresalesBadge =
    role === "SUPER_ADMIN" || normalizeDepartmentName(displayUser?.department ?? user?.department) === "presales";

  const { data: presalesSummary } = useQuery({
    queryKey: ["presales-summary"],
    enabled: canSeePresalesBadge,
    queryFn: async () => {
      const response = await api.get("/api/presales/projects/summary");
      return response.data?.data as { activeCount: number };
    },
  });

  const activePresalesCount = presalesSummary?.activeCount;

  return (
    <aside className="relative flex h-screen w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]/95">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[var(--accent-primary)]/40 to-transparent" />
      <div className="px-4 py-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--bg-elevated)]/60 via-[var(--bg-surface)]/80 to-[var(--bg-elevated)]/60 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>Connectplus CRM</span>
        </div>
        <p className="mt-3 text-sm font-semibold tracking-tight text-[var(--text-primary)]">Operations Command Console</p>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {[
          ...items.filter(g => navUser && canSeeNavGroup(g.group, navUser)),
          ...(canSeeAdminPanel
            ? [{ group: "Super admin", links: [{ to: "/super-admin", label: "Admin Panel", icon: ShieldCheck }] }]
            : []),
        ].map(group => {
          const links = group.links;

          if (links.length === 0) {
            return null;
          }

          return (
            <div key={group.group}>
              <div className="px-3 pb-1 text-[11px] font-medium tracking-[0.12em] text-neutral-500">{group.group}</div>
              <div className="space-y-1">
                {links.map(link => {
                  const active = location.pathname.startsWith(link.to);
                  const showPresalesBadge = link.label === "Presales" && canSeePresalesBadge && activePresalesCount != null;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                        active
                          ? "bg-gradient-to-r from-[var(--bg-elevated)] to-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm"
                          : "text-neutral-600 hover:bg-[var(--bg-elevated)]/80"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {link.icon && <link.icon className="h-4 w-4" />}
                        <span>{link.label}</span>
                      </span>
                      {showPresalesBadge && (
                        <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-neutral-500">
                          {activePresalesCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      {user && (
        <div className="mt-auto border-t border-[var(--border)] bg-[var(--bg-surface)]/95 p-4">
          <button
            onClick={() => navigate("/profile")}
            className="mb-2 flex w-full items-center gap-3 rounded-xl bg-[var(--bg-elevated)]/60 p-3 transition hover:bg-[var(--bg-elevated)]/80"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-gold)]/20 text-[var(--accent-primary)]">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {displayUser?.name || "User"}
              </p>
              <p className="truncate text-xs text-neutral-500">
                {displayUser?.email || displayUser?.role || user.role}
              </p>
              {displayUser?.department && (
                <p className="truncate text-[10px] text-neutral-400">{displayUser.department}</p>
              )}
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-neutral-600 transition hover:bg-[var(--bg-elevated)]/80 hover:text-[var(--accent-primary)]"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </aside>
  );
}
