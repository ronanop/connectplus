import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatedBottomSheet } from "../AnimatedBottomSheet";
import { api, canAccessHr, useAuthStore } from "#leave-deps";

export type LeaveRow = {
  id: number;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
  status: string;
  reviewedAt: string | null;
  hrComment: string | null;
  createdAt: string;
  user: { id: number; name: string; email: string; department?: string | null };
  reviewedBy: { id: number; name: string; email: string } | null;
};

type OrgHistoryResponse = {
  leaves: LeaveRow[];
  departments: string[];
  hasUnassignedDepartment: boolean;
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  ANNUAL: "Annual / PTO",
  OTHER: "Other",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ymdInRange(ymd: string, start: string, end: string): boolean {
  return ymd >= start && ymd <= end;
}

function leaveForDay(day: Date, leaves: LeaveRow[]): LeaveRow | undefined {
  const ymd = format(day, "yyyy-MM-dd");
  return leaves.find(
    L => (L.status === "PENDING" || L.status === "APPROVED") && ymdInRange(ymd, L.startDate, L.endDate),
  );
}

function statusDotClass(status: string): string {
  if (status === "APPROVED") return "bg-emerald-500";
  if (status === "DENIED") return "bg-red-500";
  return "bg-amber-500";
}

export type LeavesPageContentProps = {
  /** Hint under the calendar (touch vs mouse). */
  actionHint?: string;
};

export function LeavesPageContent({
  actionHint = "Tap a date to request leave for that day.",
}: LeavesPageContentProps) {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const showHr = canAccessHr(user);
  const [tab, setTab] = useState<"calendar" | "hr">("calendar");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const [requestOpen, setRequestOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<"CASUAL" | "SICK" | "ANNUAL" | "OTHER">("OTHER");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [reviewLeave, setReviewLeave] = useState<LeaveRow | null>(null);
  const [hrComment, setHrComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [hrHistoryStatus, setHrHistoryStatus] = useState<"APPROVED" | "DENIED" | "ALL">("APPROVED");
  const [hrHistorySort, setHrHistorySort] = useState<
    "startDate_desc" | "startDate_asc" | "reviewedAt_desc" | "reviewedAt_asc" | "employee_asc"
  >("startDate_desc");
  const [hrHistoryDepartment, setHrHistoryDepartment] = useState<string>("ALL");
  const [hrHistoryFrom, setHrHistoryFrom] = useState("");
  const [hrHistoryTo, setHrHistoryTo] = useState("");

  const { data: myLeaves = [], isLoading: loadingMine } = useQuery({
    queryKey: ["leaves", "mine"],
    queryFn: async () => {
      const res = await api.get("/api/leaves/mine");
      return (res.data?.data?.leaves ?? []) as LeaveRow[];
    },
    enabled: Boolean(user),
  });

  const { data: pendingLeaves = [], isLoading: loadingPending } = useQuery({
    queryKey: ["leaves", "pending"],
    queryFn: async () => {
      const res = await api.get("/api/leaves/pending");
      return (res.data?.data?.leaves ?? []) as LeaveRow[];
    },
    enabled: Boolean(user) && showHr,
  });

  const orgHistoryQueryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("status", hrHistoryStatus);
    p.set("sort", hrHistorySort);
    if (hrHistoryDepartment && hrHistoryDepartment !== "ALL") {
      p.set("department", hrHistoryDepartment);
    }
    if (hrHistoryFrom) {
      p.set("from", hrHistoryFrom);
    }
    if (hrHistoryTo) {
      p.set("to", hrHistoryTo);
    }
    return p.toString();
  }, [hrHistoryStatus, hrHistorySort, hrHistoryDepartment, hrHistoryFrom, hrHistoryTo]);

  const { data: orgHistoryData, isLoading: loadingOrgHistory } = useQuery({
    queryKey: [
      "leaves",
      "org-history",
      hrHistoryStatus,
      hrHistorySort,
      hrHistoryDepartment,
      hrHistoryFrom,
      hrHistoryTo,
    ],
    queryFn: async () => {
      const res = await api.get(`/api/leaves/org-history?${orgHistoryQueryString}`);
      return (res.data?.data ?? {
        leaves: [],
        departments: [],
        hasUnassignedDepartment: false,
      }) as OrgHistoryResponse;
    },
    enabled: Boolean(user) && showHr && tab === "hr",
  });

  const historyLeaves = orgHistoryData?.leaves ?? [];
  const historyDepartments = orgHistoryData?.departments ?? [];
  const historyHasUnassigned = orgHistoryData?.hasUnassignedDepartment ?? false;

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/leaves", {
        startDate,
        endDate,
        leaveType,
        reason: reason.trim(),
      });
    },
    onSuccess: async () => {
      setRequestOpen(false);
      setReason("");
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["leaves", "mine"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not submit leave.";
      setFormError(String(msg));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/leaves/${id}/approve`, { hrComment: hrComment.trim() || null });
    },
    onSuccess: async () => {
      setReviewLeave(null);
      setHrComment("");
      setReviewError(null);
      await queryClient.invalidateQueries({ queryKey: ["leaves", "pending"] });
      await queryClient.invalidateQueries({ queryKey: ["leaves", "mine"] });
      await queryClient.invalidateQueries({ queryKey: ["leaves", "org-history"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not approve.";
      setReviewError(String(msg));
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/leaves/${id}/deny`, { hrComment: hrComment.trim() || null });
    },
    onSuccess: async () => {
      setReviewLeave(null);
      setHrComment("");
      setReviewError(null);
      await queryClient.invalidateQueries({ queryKey: ["leaves", "pending"] });
      await queryClient.invalidateQueries({ queryKey: ["leaves", "mine"] });
      await queryClient.invalidateQueries({ queryKey: ["leaves", "org-history"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not deny.";
      setReviewError(String(msg));
    },
  });

  const openRequestForDay = (day: Date) => {
    const ymd = format(day, "yyyy-MM-dd");
    setStartDate(ymd);
    setEndDate(ymd);
    setLeaveType("OTHER");
    setReason("");
    setFormError(null);
    setRequestOpen(true);
  };

  const submitRequest = () => {
    setFormError(null);
    if (reason.trim().length < 3) {
      setFormError("Please enter a reason (at least 3 characters).");
      return;
    }
    if (startDate > endDate) {
      setFormError("End date must be on or after start date.");
      return;
    }
    createMutation.mutate();
  };

  if (!user?.organizationId) {
    return (
      <p className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
        Your account is not linked to an organization. Leave requests are available once an administrator assigns you to an
        organization.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {showHr && (
        <div className="flex gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={() => setTab("calendar")}
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold ${
              tab === "calendar" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)]"
            }`}
          >
            My calendar
          </button>
          <button
            type="button"
            onClick={() => setTab("hr")}
            className={`relative flex-1 rounded-xl py-2.5 text-xs font-semibold ${
              tab === "hr" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)]"
            }`}
          >
            HR inbox
            {pendingLeaves.length > 0 && tab !== "hr" ? (
              <span className="absolute right-2 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {pendingLeaves.length > 9 ? "9+" : pendingLeaves.length}
              </span>
            ) : null}
          </button>
        </div>
      )}

      {tab === "calendar" && (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setViewMonth((m: Date) => subMonths(m, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{format(viewMonth, "MMMM yyyy")}</p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewMonth((m: Date) => addMonths(m, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)]"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-2 text-center text-[11px] text-[var(--text-muted)]">
              Today is {format(new Date(), "EEEE, MMM d, yyyy · HH:mm")}
            </p>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {WEEKDAYS.map(d => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarDays.map((day: Date) => {
                const inMonth = isSameMonth(day, viewMonth);
                const hit = leaveForDay(day, myLeaves);
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => openRequestForDay(day)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-medium transition active:scale-[0.97] ${
                      inMonth ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]/50"
                    } ${today ? "ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--bg-surface)]" : ""} ${
                      hit ? "bg-[var(--bg-base)]" : "hover:bg-[var(--bg-base)]/80"
                    }`}
                  >
                    <span>{format(day, "d")}</span>
                    {hit ? <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${statusDotClass(hit.status)}`} /> : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[10px] text-[var(--text-muted)]">{actionHint}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Your requests</p>
            {loadingMine ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">Loading…</p>
            ) : myLeaves.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">No leave requests yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {myLeaves.map((L: LeaveRow) => (
                  <li
                    key={L.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-xs text-[var(--text-muted)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {L.startDate === L.endDate ? L.startDate : `${L.startDate} → ${L.endDate}`}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          L.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-700"
                            : L.status === "DENIED"
                              ? "bg-red-500/15 text-red-700"
                              : "bg-amber-500/15 text-amber-800"
                        }`}
                      >
                        {L.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px]">{LEAVE_TYPE_LABEL[L.leaveType] ?? L.leaveType}</p>
                    <p className="mt-1 line-clamp-2 text-[11px]">{L.reason}</p>
                    {L.hrComment ? <p className="mt-1 text-[11px] text-[var(--text-primary)]">HR: {L.hrComment}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === "hr" && showHr && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Pending approvals</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Same organization only. Open a request to approve or deny.</p>
            {loadingPending ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">Loading…</p>
            ) : pendingLeaves.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">No pending requests.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {pendingLeaves.map((L: LeaveRow) => (
                  <li key={L.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setReviewLeave(L);
                        setHrComment("");
                        setReviewError(null);
                      }}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3 text-left transition active:bg-[var(--bg-elevated)]"
                    >
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{L.user.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{L.user.email}</p>
                      <p className="mt-2 text-xs text-[var(--text-primary)]">
                        {L.startDate === L.endDate ? L.startDate : `${L.startDate} → ${L.endDate}`} ·{" "}
                        {LEAVE_TYPE_LABEL[L.leaveType] ?? L.leaveType}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Past leave decisions</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Approved and denied requests. Filter by status, employee department, and leave start dates.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Status</label>
                  <select
                    value={hrHistoryStatus}
                    onChange={e => setHrHistoryStatus(e.target.value as typeof hrHistoryStatus)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                  >
                    <option value="APPROVED">Approved only</option>
                    <option value="DENIED">Denied only</option>
                    <option value="ALL">Approved & denied</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sort by</label>
                  <select
                    value={hrHistorySort}
                    onChange={e => setHrHistorySort(e.target.value as typeof hrHistorySort)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                  >
                    <option value="startDate_desc">Leave start (newest first)</option>
                    <option value="startDate_asc">Leave start (oldest first)</option>
                    <option value="reviewedAt_desc">Reviewed (newest first)</option>
                    <option value="reviewedAt_asc">Reviewed (oldest first)</option>
                    <option value="employee_asc">Employee name (A–Z)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Department</label>
                <select
                  value={hrHistoryDepartment}
                  onChange={e => setHrHistoryDepartment(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                >
                  <option value="ALL">All departments</option>
                  {historyHasUnassigned ? (
                    <option value="__UNASSIGNED__">No department assigned</option>
                  ) : null}
                  {historyDepartments.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Leave from (start date)
                  </label>
                  <input
                    type="date"
                    value={hrHistoryFrom}
                    onChange={e => setHrHistoryFrom(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Leave to (start date)
                  </label>
                  <input
                    type="date"
                    value={hrHistoryTo}
                    onChange={e => setHrHistoryTo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {loadingOrgHistory ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">Loading history…</p>
            ) : historyLeaves.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">No records match these filters.</p>
            ) : (
              <ul className="mt-4 max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto pr-1">
                {historyLeaves.map((L: LeaveRow) => (
                  <li
                    key={L.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-xs text-[var(--text-muted)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">{L.user.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          L.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-red-500/15 text-red-700"
                        }`}
                      >
                        {L.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px]">{L.user.email}</p>
                    <p className="mt-1 text-[11px]">
                      Dept:{" "}
                      <span className="text-[var(--text-primary)]">
                        {L.user.department?.trim() ? L.user.department : "—"}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-primary)]">
                      {L.startDate === L.endDate ? L.startDate : `${L.startDate} → ${L.endDate}`} ·{" "}
                      {LEAVE_TYPE_LABEL[L.leaveType] ?? L.leaveType}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px]">{L.reason}</p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                      Reviewed:{" "}
                      {L.reviewedAt
                        ? format(parseISO(L.reviewedAt), "MMM d, yyyy · HH:mm")
                        : "—"}
                      {L.reviewedBy ? ` · ${L.reviewedBy.name}` : ""}
                    </p>
                    {L.hrComment ? (
                      <p className="mt-1 text-[11px] text-[var(--text-primary)]">Note: {L.hrComment}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {requestOpen ? (
          <AnimatedBottomSheet key="leave-request" titleId="leave-request-title" onClose={() => setRequestOpen(false)}>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-[var(--border)] px-5 pb-4 pt-4">
                <div className="mb-3 flex justify-center sm:hidden" aria-hidden>
                  <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p id="leave-request-title" className="text-lg font-semibold text-[var(--text-primary)]">
                    Request leave
                  </p>
                  <button
                    type="button"
                    onClick={() => setRequestOpen(false)}
                    className="rounded-xl border border-[var(--border)] p-2 hover:bg-[var(--bg-base)]"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">
                <label className="block text-xs font-medium text-[var(--text-muted)]">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm"
                />
                <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm"
                />
                <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">Type</label>
                <select
                  value={leaveType}
                  onChange={e => setLeaveType(e.target.value as typeof leaveType)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm"
                >
                  <option value="CASUAL">Casual</option>
                  <option value="SICK">Sick</option>
                  <option value="ANNUAL">Annual / PTO</option>
                  <option value="OTHER">Other</option>
                </select>
                <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">Reason</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why you need leave…"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent-primary)]"
                />
                {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
              </div>
              <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 pt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(1rem,var(--safe-bottom))]">
                <button
                  type="button"
                  disabled={createMutation.isPending}
                  onClick={submitRequest}
                  className="w-full rounded-2xl bg-[var(--accent-primary)] py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createMutation.isPending ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </div>
          </AnimatedBottomSheet>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {reviewLeave ? (
          <AnimatedBottomSheet
            key={`leave-review-${reviewLeave.id}`}
            titleId="leave-review-title"
            onClose={() => setReviewLeave(null)}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-[var(--border)] px-5 pb-4 pt-4">
                <div className="mb-3 flex justify-center sm:hidden" aria-hidden>
                  <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p id="leave-review-title" className="text-lg font-semibold text-[var(--text-primary)]">
                    Leave request
                  </p>
                  <button
                    type="button"
                    onClick={() => setReviewLeave(null)}
                    className="rounded-xl border border-[var(--border)] p-2 hover:bg-[var(--bg-base)]"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">{reviewLeave.user.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{reviewLeave.user.email}</p>
                <p className="mt-3 text-sm text-[var(--text-primary)]">
                  {reviewLeave.startDate === reviewLeave.endDate
                    ? reviewLeave.startDate
                    : `${reviewLeave.startDate} → ${reviewLeave.endDate}`}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {LEAVE_TYPE_LABEL[reviewLeave.leaveType] ?? reviewLeave.leaveType}
                </p>
                <p className="mt-3 rounded-xl bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  {reviewLeave.reason}
                </p>
                <label className="mt-4 block text-xs font-medium text-[var(--text-muted)]">Note to employee (optional)</label>
                <textarea
                  value={hrComment}
                  onChange={e => setHrComment(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm"
                />
                {reviewError ? <p className="mt-2 text-sm text-red-600">{reviewError}</p> : null}
              </div>
              <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 pt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(1rem,var(--safe-bottom))]">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={denyMutation.isPending || approveMutation.isPending}
                    onClick={() => denyMutation.mutate(reviewLeave.id)}
                    className="flex-1 rounded-2xl border border-red-300 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    disabled={approveMutation.isPending || denyMutation.isPending}
                    onClick={() => approveMutation.mutate(reviewLeave.id)}
                    className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </AnimatedBottomSheet>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
