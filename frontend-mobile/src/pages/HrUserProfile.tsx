import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";

type HrProfileUser = {
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

export function HrUserProfileContent() {
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
      <div className="space-y-4">
        <p className="text-sm text-[var(--danger)]">Invalid user.</p>
        <Link to="/hr/departments" className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)]">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <p className="py-8 text-sm text-[var(--text-muted)]">Loading profile…</p>;
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--danger)]">Could not load this profile.</p>
        <Link to="/hr/departments" className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)]">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
    );
  }

  const u = data;

  return (
    <div className="space-y-6">
      <Link
        to="/hr/departments"
        className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Department management
      </Link>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
            <span className="text-xl font-semibold">{u.name?.charAt(0).toUpperCase() || "U"}</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--text-primary)]">{u.name}</p>
            <p className="text-sm text-[var(--text-muted)]">{u.email}</p>
          </div>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Work</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Role</dt>
            <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{u.role}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Department</dt>
            <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{u.department ?? "—"}</dd>
          </div>
          {u.organization && (
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Organization</dt>
              <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                {u.organization}
                {u.organizationCode ? ` (${u.organizationCode})` : ""}
              </dd>
            </div>
          )}
          {u.reportsTo && (
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Reports to</dt>
              <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{u.reportsTo.name}</dd>
              <dd className="text-xs text-[var(--text-muted)]">{u.reportsTo.email}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Direct reports</dt>
            <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{u.directReportCount}</dd>
          </div>
          {u.tags.length > 0 && (
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Tags</dt>
              <dd className="mt-0.5 text-[var(--text-primary)]">{u.tags.join(", ")}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Account</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Status</dt>
            <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{u.isActive ? "Active" : "Inactive"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-muted)]">User ID</dt>
            <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{u.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Member since</dt>
            <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{format(new Date(u.createdAt), "PPP")}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
