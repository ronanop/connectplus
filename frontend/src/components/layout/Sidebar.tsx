import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

const items = [
  {
    group: "OVERVIEW",
    links: [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/tasks", label: "My Tasks" },
    ],
  },
  {
    group: "SALES",
    links: [
      { to: "/crm/leads", label: "Leads" },
      { to: "/crm/opportunities", label: "Opportunities" },
      { to: "/presales", label: "Presales", icon: "FileSearch" as const, showPresalesBadge: true },
    ],
  },
  {
    group: "TOOLS",
    links: [{ to: "/api-fetcher", label: "API Fetcher" }],
  },
  { group: "ADMIN", links: [{ to: "/settings/users", label: "Users" }] },
];

export function Sidebar() {
  const location = useLocation();
  const user = useAuthStore(s => s.user);

  const role = user?.role ?? null;
  const canSeePresales = role != null;

  const { data: presalesSummary } = useQuery({
    queryKey: ["presales-summary"],
    enabled: canSeePresales,
    queryFn: async () => {
      const response = await api.get("/api/presales/projects/summary");
      return response.data?.data as { activeCount: number };
    },
  });

  const activePresalesCount = presalesSummary?.activeCount;

  return (
    <aside className="relative w-64 border-r border-[var(--border)] bg-[var(--bg-surface)]/95">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[var(--accent-primary)]/40 to-transparent" />
      <div className="px-4 py-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--bg-elevated)]/60 via-[var(--bg-surface)]/80 to-[var(--bg-elevated)]/60 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>Cachedigitech CRM</span>
        </div>
        <p className="mt-3 text-sm font-semibold tracking-tight text-[var(--text-primary)]">Operations Command Console</p>
      </div>
      <nav className="space-y-4 px-2 pb-4">
        {items.map(group => {
          const links =
            group.group === "SALES"
              ? group.links.filter(link => link.label !== "Presales" || canSeePresales)
              : group.links;

          if (links.length === 0) {
            return null;
          }

          return (
            <div key={group.group}>
              <div className="px-3 pb-1 text-[11px] font-medium tracking-[0.22em] text-neutral-500">{group.group}</div>
              <div className="space-y-1">
                {links.map(link => {
                  const active = location.pathname.startsWith(link.to);
                  const showPresalesBadge = link.label === "Presales" && canSeePresales && activePresalesCount != null;
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
                        {link.icon === "FileSearch" && <FileSearch className="h-4 w-4" />}
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
    </aside>
  );
}
