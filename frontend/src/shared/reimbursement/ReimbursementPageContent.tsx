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
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatedBottomSheet } from "../AnimatedBottomSheet";
import { api, canAccessHr, useAuthStore } from "#reimbursement-deps";

export type ReimbursementClaimRow = {
  id: number;
  expenseDate: string;
  amount: string;
  notes: string | null;
  status: string;
  reviewedAt: string | null;
  hrComment: string | null;
  createdAt: string;
  user: { id: number; name: string; email: string; department?: string | null };
  reviewedBy: { id: number; name: string; email: string } | null;
  attachments: { id: number; originalName: string; mimeType: string; downloadUrl: string }[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function statusDotClass(status: string): string {
  if (status === "APPROVED") return "bg-emerald-500";
  if (status === "DENIED") return "bg-red-500";
  return "bg-amber-500";
}

function claimPriority(status: string): number {
  if (status === "PENDING") return 0;
  if (status === "APPROVED") return 1;
  return 2;
}

function claimForDay(day: Date, claims: ReimbursementClaimRow[]): ReimbursementClaimRow | undefined {
  const ymd = format(day, "yyyy-MM-dd");
  const hits = claims.filter(c => c.expenseDate === ymd);
  if (hits.length === 0) return undefined;
  return [...hits].sort((a, b) => claimPriority(a.status) - claimPriority(b.status))[0];
}

function apiBaseUrl(): string {
  const raw = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
  return typeof raw === "string" ? raw.replace(/\/+$/, "") : "";
}

function attachmentHref(downloadUrl: string): string {
  if (downloadUrl.startsWith("http")) return downloadUrl;
  const base = apiBaseUrl();
  return base ? `${base}${downloadUrl}` : downloadUrl;
}

export type ReimbursementPageContentProps = {
  actionHint?: string;
};

export function ReimbursementPageContent({
  actionHint = "Tap a date to add reimbursement for that day (amount + bills).",
}: ReimbursementPageContentProps) {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const showHr = canAccessHr(user);
  const [tab, setTab] = useState<"calendar" | "hr">("calendar");
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const [formOpen, setFormOpen] = useState(false);
  const [selectedYmd, setSelectedYmd] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [reviewClaim, setReviewClaim] = useState<ReimbursementClaimRow | null>(null);
  const [hrComment, setHrComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const from = format(monthStart, "yyyy-MM-dd");
  const to = format(monthEnd, "yyyy-MM-dd");

  const { data: myClaims = [], isLoading: loadingMine } = useQuery({
    queryKey: ["reimbursements", "mine", from, to],
    queryFn: async () => {
      const res = await api.get<{ data: { claims: ReimbursementClaimRow[] } }>(
        `/api/reimbursements/mine?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      return res.data?.data?.claims ?? [];
    },
    enabled: Boolean(user?.organizationId),
  });

  const { data: pendingClaims = [], isLoading: loadingPending } = useQuery({
    queryKey: ["reimbursements", "pending"],
    queryFn: async () => {
      const res = await api.get<{ data: { claims: ReimbursementClaimRow[] } }>("/api/reimbursements/pending");
      return res.data?.data?.claims ?? [];
    },
    enabled: Boolean(showHr && user?.organizationId),
  });

  const calendarDays = useMemo(() => {
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [monthStart, monthEnd]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("expenseDate", selectedYmd);
      fd.append("amount", amount.trim());
      if (notes.trim()) fd.append("notes", notes.trim());
      const list = files ? Array.from(files) : [];
      for (const f of list) {
        fd.append("files", f);
      }
      await api.post("/api/reimbursements", fd);
    },
    onSuccess: async () => {
      setFormOpen(false);
      setAmount("");
      setNotes("");
      setFiles(null);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["reimbursements", "mine"] });
      await queryClient.invalidateQueries({ queryKey: ["reimbursements", "pending"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not submit claim.";
      setFormError(String(msg));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/reimbursements/${id}/approve`, { hrComment: hrComment.trim() || null });
    },
    onSuccess: async () => {
      setReviewClaim(null);
      setHrComment("");
      setReviewError(null);
      await queryClient.invalidateQueries({ queryKey: ["reimbursements", "pending"] });
      await queryClient.invalidateQueries({ queryKey: ["reimbursements", "mine"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not approve.";
      setReviewError(String(msg));
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/reimbursements/${id}/deny`, { hrComment: hrComment.trim() || null });
    },
    onSuccess: async () => {
      setReviewClaim(null);
      setHrComment("");
      setReviewError(null);
      await queryClient.invalidateQueries({ queryKey: ["reimbursements", "pending"] });
      await queryClient.invalidateQueries({ queryKey: ["reimbursements", "mine"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not deny.";
      setReviewError(String(msg));
    },
  });

  const openFormForDay = (day: Date) => {
    const ymd = format(day, "yyyy-MM-dd");
    setSelectedYmd(ymd);
    setAmount("");
    setNotes("");
    setFiles(null);
    setFormError(null);
    setFormOpen(true);
  };

  const submitForm = () => {
    setFormError(null);
    const n = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      setFormError("Enter a valid total amount.");
      return;
    }
    if (!files || files.length === 0) {
      setFormError("Upload at least one bill or receipt.");
      return;
    }
    createMutation.mutate();
  };

  if (!user?.organizationId) {
    return (
      <p className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
        Your account is not linked to an organization. Reimbursements are available once an administrator assigns you to an
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
            {pendingClaims.length > 0 && tab !== "hr" ? (
              <span className="absolute right-2 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {pendingClaims.length > 9 ? "9+" : pendingClaims.length}
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
                onClick={() => setViewMonth(m => subMonths(m, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{format(viewMonth, "MMMM yyyy")}</p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setViewMonth(m => addMonths(m, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)]"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {WEEKDAYS.map(d => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarDays.map(day => {
                const inMonth = isSameMonth(day, viewMonth);
                const hit = claimForDay(day, myClaims);
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => openFormForDay(day)}
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
            <p className="text-sm font-semibold text-[var(--text-primary)]">Your claims (this month)</p>
            {loadingMine ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">Loading…</p>
            ) : myClaims.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">No reimbursement claims in this month yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {myClaims.map(c => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-xs text-[var(--text-muted)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {c.expenseDate} · {c.amount}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          c.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-700"
                            : c.status === "DENIED"
                              ? "bg-red-500/15 text-red-700"
                              : "bg-amber-500/15 text-amber-800"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.notes ? <p className="mt-1 line-clamp-2 text-[11px]">{c.notes}</p> : null}
                    {c.attachments.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {c.attachments.map(a => (
                          <li key={a.id}>
                            <a
                              href={attachmentHref(a.downloadUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[var(--accent-primary)] underline"
                            >
                              {a.originalName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {c.hrComment ? <p className="mt-1 text-[11px] text-[var(--text-primary)]">HR: {c.hrComment}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === "hr" && showHr && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Pending approvals</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Same organization only. HR users can approve or deny.</p>
          {loadingPending ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">Loading…</p>
          ) : pendingClaims.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">No pending reimbursement claims.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {pendingClaims.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewClaim(c);
                      setHrComment("");
                      setReviewError(null);
                    }}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3 text-left transition active:bg-[var(--bg-elevated)]"
                  >
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{c.user.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{c.user.email}</p>
                    <p className="mt-2 text-xs text-[var(--text-primary)]">
                      {c.expenseDate} · {c.amount}
                    </p>
                    {c.notes ? <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]">{c.notes}</p> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AnimatePresence>
        {formOpen ? (
          <AnimatedBottomSheet
            key={`reimburse-${selectedYmd}`}
            titleId="reimbursement-form-title"
            onClose={() => setFormOpen(false)}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-[var(--border)] px-5 pb-4 pt-4">
                <div className="mb-3 flex justify-center sm:hidden" aria-hidden>
                  <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p id="reimbursement-form-title" className="text-lg font-semibold text-[var(--text-primary)]">
                      Reimbursement
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Expense date: {selectedYmd}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setFormOpen(false)}
                    className="shrink-0 rounded-xl border border-[var(--border)] p-2 hover:bg-[var(--bg-base)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">
                <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Total amount
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                />
                <label className="mt-3 block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Bills / receipts
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => setFiles(e.target.files)}
                  className="mt-1 w-full text-xs text-[var(--text-muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--bg-elevated)] file:px-3 file:py-2 file:text-xs file:font-medium"
                />
                <label className="mt-3 block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                  placeholder="Short description"
                />
                {formError ? <p className="mt-2 text-xs text-red-600">{formError}</p> : null}
              </div>
              <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 pt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(1rem,var(--safe-bottom))]">
                <button
                  type="button"
                  onClick={submitForm}
                  disabled={createMutation.isPending}
                  className="mobile-tap w-full rounded-xl bg-[var(--accent-primary)] py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {createMutation.isPending ? "Submitting…" : "Submit for approval"}
                </button>
              </div>
            </div>
          </AnimatedBottomSheet>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {reviewClaim ? (
          <AnimatedBottomSheet
            key={`reimburse-review-${reviewClaim.id}`}
            titleId="reimbursement-review-title"
            onClose={() => setReviewClaim(null)}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-[var(--border)] px-5 pb-4 pt-4">
                <div className="mb-3 flex justify-center sm:hidden" aria-hidden>
                  <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p id="reimbursement-review-title" className="text-lg font-semibold text-[var(--text-primary)]">
                      {reviewClaim.user.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{reviewClaim.expenseDate}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setReviewClaim(null)}
                    className="shrink-0 rounded-xl border border-[var(--border)] p-2 hover:bg-[var(--bg-base)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">
                <p className="text-lg font-semibold text-[var(--text-primary)]">{reviewClaim.amount}</p>
                {reviewClaim.notes ? <p className="mt-2 text-sm text-[var(--text-muted)]">{reviewClaim.notes}</p> : null}
                {reviewClaim.attachments.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {reviewClaim.attachments.map(a => (
                      <li key={a.id}>
                        <a
                          href={attachmentHref(a.downloadUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-[var(--accent-primary)] underline"
                        >
                          {a.originalName}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <label className="mt-4 block text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  HR comment (optional)
                </label>
                <textarea
                  value={hrComment}
                  onChange={e => setHrComment(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
                />
                {reviewError ? <p className="mt-2 text-xs text-red-600">{reviewError}</p> : null}
              </div>
              <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 pt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(1rem,var(--safe-bottom))]">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => denyMutation.mutate(reviewClaim.id)}
                    disabled={denyMutation.isPending || approveMutation.isPending}
                    className="flex-1 rounded-xl border border-red-300 bg-red-50 py-3 text-sm font-semibold text-red-800 disabled:opacity-60"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate(reviewClaim.id)}
                    disabled={denyMutation.isPending || approveMutation.isPending}
                    className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
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
