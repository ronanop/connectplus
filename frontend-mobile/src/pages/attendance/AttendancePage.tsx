import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { api } from "../../lib/api";
import { attendanceApi, type AttendanceRecord, type AttendanceStatus } from "../../lib/attendanceApi";
import { useAuthStore } from "../../stores/authStore";
import { AttendanceFlow, type AttendanceFlowMode } from "../../components/attendance/AttendanceFlow";

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-500",
  ABSENT: "bg-red-500",
  FACE_FAILED: "bg-orange-500",
  GEO_FAILED: "bg-amber-500",
  PENDING: "bg-neutral-400",
  MANUAL_PRESENT: "bg-blue-500",
  MANUAL_ABSENT: "bg-red-300",
};

function statusLabel(s: AttendanceStatus): string {
  return s.replace(/_/g, " ");
}

export default function AttendancePage() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowMode, setFlowMode] = useState<AttendanceFlowMode>("checkIn");
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));

  const monthStr = format(calMonth, "yyyy-MM");

  const { data: meData } = useQuery({
    queryKey: ["user-profile"],
    enabled: !!user,
    queryFn: async () => {
      const res = await api.get("/api/auth/me");
      return res.data?.data?.user as {
        hasFaceRegistered?: boolean;
        profilePhotoUrl?: string | null;
      };
    },
  });

  const hasFace = Boolean(meData?.hasFaceRegistered);

  const { data: todayData, refetch: refetchToday } = useQuery({
    queryKey: ["attendance-today"],
    enabled: !!user && hasFace,
    queryFn: async () => {
      const res = await attendanceApi.getMyToday();
      return res.data.data.attendance as AttendanceRecord | null;
    },
  });

  const { data: monthRecords = [] } = useQuery({
    queryKey: ["attendance-my", monthStr],
    enabled: !!user && hasFace,
    queryFn: async () => {
      const res = await attendanceApi.getMyAttendance(monthStr);
      return res.data.data.records as AttendanceRecord[];
    },
  });

  const recordByDate = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    for (const r of monthRecords) {
      const d = typeof r.date === "string" ? r.date.slice(0, 10) : format(new Date(r.date), "yyyy-MM-dd");
      m.set(d, r);
    }
    return m;
  }, [monthRecords]);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) }),
    [calMonth],
  );

  const today = todayData;
  const isPresent = today?.status === "PRESENT" && today.checkInAt;
  const isFaceFailed = today?.status === "FACE_FAILED";

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-hidden pb-8">
      <div className="grid w-full grid-cols-1 gap-6">
        <div className="min-w-0 max-w-full rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-4 shadow-sm sm:p-6">
          <LiveClockHeader />

          {!hasFace ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                Face ID not set up. To mark attendance, set your profile photo and register your face.
              </div>
              <Link
                to="/profile"
                className="mobile-tap mobile-tap-strong inline-flex min-h-[48px] max-w-full items-center rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white"
              >
                Set up Face ID →
              </Link>
              <button
                type="button"
                disabled
                title="Set up Face ID first"
                className="mt-2 w-full min-h-[48px] rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-400"
              >
                Mark Attendance
              </button>
            </div>
          ) : isFaceFailed ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-orange-600">Face Verification Failed</p>
              <p className="text-sm text-neutral-600">Contact admin for a manual override.</p>
              <Link to="/profile" className="text-sm text-[var(--accent-primary)] underline">
                Review profile photo
              </Link>
            </div>
          ) : isPresent ? (
            <div className="space-y-4">
              <p className="text-lg font-semibold text-emerald-600">Present ✓</p>
              <div className="space-y-1 text-sm text-neutral-700">
                <p>
                  Check-in:{" "}
                  {today.checkInAt
                    ? format(new Date(today.checkInAt), "p")
                    : "—"}
                </p>
                {today.faceMatchScore != null && (
                  <p>Face match: {Math.round(Number(today.faceMatchScore) * 100)}%</p>
                )}
                {today.checkInDistance != null && (
                  <p>Distance from office: {Math.round(today.checkInDistance)}m</p>
                )}
                {today.checkOutAt && today.checkOutFaceMatchScore != null && (
                  <p>Check-out face match: {Math.round(Number(today.checkOutFaceMatchScore) * 100)}%</p>
                )}
                {today.checkOutAt && today.checkOutDistance != null && (
                  <p>Check-out distance: {Math.round(today.checkOutDistance)}m</p>
                )}
              </div>
              {!today.checkOutAt ? (
                <button
                  type="button"
                  onClick={() => {
                    setFlowMode("checkOut");
                    setFlowOpen(true);
                  }}
                  className="mobile-tap mobile-tap-strong inline-flex min-h-[48px] max-w-full items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  Check out
                </button>
              ) : (
                <p className="text-sm text-neutral-600">
                  Checked out at {format(new Date(today.checkOutAt), "p")}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">Not checked in today.</p>
              <button
                type="button"
                onClick={() => {
                  setFlowMode("checkIn");
                  setFlowOpen(true);
                }}
                className="mobile-tap mobile-tap-strong w-full min-h-[48px] max-w-full rounded-xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-semibold text-white"
              >
                Mark Attendance
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0 max-w-full rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/95 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex min-w-0 flex-col gap-3">
            <h2 className="shrink-0 text-lg font-semibold text-[var(--text-primary)]">Calendar</h2>
            <div className="flex min-w-0 w-full items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                className="mobile-tap rounded-lg p-2 hover:bg-[var(--bg-elevated)]"
                onClick={() => setCalMonth(m => addMonths(m, -1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-0 flex-1 truncate text-center text-sm font-medium">
                {format(calMonth, "MMMM yyyy")}
              </span>
              <button
                type="button"
                aria-label="Next month"
                className="mobile-tap rounded-lg p-2 hover:bg-[var(--bg-elevated)]"
                onClick={() => setCalMonth(m => addMonths(m, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="grid w-full min-w-0 grid-cols-7 gap-0.5 text-center text-[10px] text-neutral-500 sm:gap-1 sm:text-xs">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="py-1 font-medium">
                {d}
              </div>
            ))}
            {days.map(day => {
              const key = format(day, "yyyy-MM-dd");
              const rec = recordByDate.get(key);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={key}
                  title={rec ? `${key}: ${statusLabel(rec.status)}` : key}
                  className={`flex min-h-[2.25rem] flex-col items-center justify-center rounded-lg border border-transparent text-[11px] ${
                    isToday ? "ring-1 ring-[var(--accent-primary)]" : ""
                  }`}
                >
                  <span className={isSameMonth(day, calMonth) ? "text-[var(--text-primary)]" : "text-neutral-400"}>
                    {format(day, "d")}
                  </span>
                  {rec ? (
                    <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${STATUS_COLORS[rec.status]}`} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AttendanceFlow
        open={flowOpen}
        mode={flowMode}
        onClose={() => setFlowOpen(false)}
        onSuccess={() => {
          void refetchToday();
          void queryClient.invalidateQueries({ queryKey: ["attendance-my"] });
          void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        }}
      />
    </div>
  );
}

function LiveClockHeader() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mb-6 border-b border-[var(--border)]/60 pb-4">
      <p className="text-sm text-neutral-500">{format(now, "EEEE")}</p>
      <p className="text-xl font-semibold text-[var(--text-primary)]">{format(now, "MMMM d, yyyy")}</p>
      <p className="text-sm text-neutral-600">{format(now, "p")}</p>
    </div>
  );
}
