import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { api } from "../../lib/api";

export type HrProfileUser = {
  id: number;
  name: string;
  email: string;
  department: string | null;
  isActive: boolean;
  createdAt: string;
  tags: string[];
  role: string;
  organization: string | null;
  organizationCode: string | null;
  organizationId: number | null;
  reportsToId: number | null;
  reportsTo: { id: number; name: string; email: string } | null;
  directReportCount: number;
  isManager: boolean;
};

export function HrUserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const idNum = userId ? Number(userId) : NaN;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["hr-user-profile", idNum],
    enabled: Number.isFinite(idNum) && idNum >= 1,
    queryFn: async () => {
      const res = await api.get(`/api/hr/users/${idNum}/profile`);
      return res.data?.data?.user as HrProfileUser;
    },
  });

  if (!Number.isFinite(idNum) || idNum < 1) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-red-600">Invalid user.</p>
        <Link to="/hr/departments" className="mt-4 inline-block text-sm text-[var(--accent-primary)] hover:underline">
          Back to departments
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <p className="text-sm text-neutral-500">Loading profile…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-red-600">Could not load this profile.</p>
        <Link to="/hr/departments" className="mt-4 inline-block text-sm text-[var(--accent-primary)] hover:underline">
          Back to departments
        </Link>
      </div>
    );
  }

  const u = data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          to="/hr/departments"
          className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to department management
        </Link>
        <p className="mt-4 text-xs uppercase tracking-[0.25em] text-neutral-500">HR · Employee profile</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{u.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">Read-only view for HR.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Personal & work</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-gold)]/20 text-[var(--accent-primary)]">
                <span className="text-2xl font-semibold">{u.name?.charAt(0).toUpperCase() || "U"}</span>
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{u.name}</p>
                <p className="text-sm text-neutral-500">{u.email}</p>
              </div>
            </div>

            <div className="space-y-3 border-t border-[var(--border)]/50 pt-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Role</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{u.role}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Department</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{u.department ?? "—"}</p>
              </div>
              {u.organization && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Organization</p>
                  <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                    {u.organization}
                    {u.organizationCode ? (
                      <span className="ml-2 text-neutral-500">({u.organizationCode})</span>
                    ) : null}
                  </p>
                </div>
              )}
              {u.reportsTo && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Reports to</p>
                  <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{u.reportsTo.name}</p>
                  <p className="text-xs text-neutral-500">{u.reportsTo.email}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Direct reports</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{u.directReportCount}</p>
              </div>
              {u.tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Tags</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">{u.tags.join(", ")}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">User ID</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{u.id}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Account</h2>
          <div className="space-y-4">
            <div className="rounded-lg bg-[var(--bg-elevated)]/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Status</p>
              <p className="mt-2 text-sm text-[var(--text-primary)]">{u.isActive ? "Active" : "Inactive"}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-elevated)]/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Manager</p>
              <p className="mt-2 text-sm text-[var(--text-primary)]">{u.isManager ? "Yes" : "No"}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-elevated)]/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">Member since</p>
              <p className="mt-2 text-sm text-[var(--text-primary)]">
                {format(new Date(u.createdAt), "PPP")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
