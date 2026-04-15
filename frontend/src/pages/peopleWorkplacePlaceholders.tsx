import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { MeetingRoomsPageContent } from "../shared/meetingRooms/MeetingRoomsPageContent";
import { ReimbursementPageContent } from "../shared/reimbursement/ReimbursementPageContent";

/**
 * Placeholders for People & workplace modules — parity with frontend-mobile until APIs ship.
 */

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">People & workplace</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function AttendancePlaceholderPage() {
  return (
    <Shell title="Attendance" subtitle="Check-in, history, and exceptions">
      <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-8 shadow-sm">
        <p className="text-sm leading-relaxed text-neutral-600">
          This module is available from the same menu on the ConnectPlus mobile app. Web workflows will appear here as they are
          enabled for your organization.
        </p>
      </div>
    </Shell>
  );
}

export function MeetingRoomsPage() {
  return (
    <Shell title="Meeting room booking" subtitle="Reserve rooms and shared spaces">
      <MeetingRoomsPageContent />
    </Shell>
  );
}

const payrollTabClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-medium transition-colors ${
    isActive
      ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border)]/60"
      : "text-neutral-500 hover:text-[var(--text-primary)]"
  }`;

/** Payroll shell with Conveyance / Reimbursement sub-sections — render nested routes in an `<Outlet />`. */
export function PayrollPage() {
  return (
    <Shell title="Payroll" subtitle="Pay and compensation">
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 shadow-sm">
        <div className="flex gap-1 border-b border-[var(--border)]/80 bg-[var(--bg-elevated)]/40 p-2">
          <NavLink to="/payroll/conveyance" className={payrollTabClass} end>
            Conveyance
          </NavLink>
          <NavLink to="/payroll/reimbursement" className={payrollTabClass} end>
            Reimbursement
          </NavLink>
        </div>
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </Shell>
  );
}

export function PayrollConveyancePage() {
  return (
    <p className="text-sm leading-relaxed text-neutral-600">
      Travel and conveyance will appear here when this workflow is enabled for your organization.
    </p>
  );
}

export function PayrollReimbursementPage() {
  return <ReimbursementPageContent />;
}

export function ComplaintsPlaceholderPage() {
  return (
    <Shell title="Raise a complaint" subtitle="Submit and track internal requests">
      <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-8 shadow-sm">
        <p className="text-sm leading-relaxed text-neutral-600">
          This module is available from the same menu on the ConnectPlus mobile app. Web workflows will appear here as they are
          enabled for your organization.
        </p>
      </div>
    </Shell>
  );
}
