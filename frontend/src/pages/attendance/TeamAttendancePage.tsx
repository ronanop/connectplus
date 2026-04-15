import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { attendanceApi, type AttendanceStatus } from "../../lib/attendanceApi";

type TeamRow = {
  id: number;
  userId: number;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInDistance: number | null;
  faceMatchScore: number | null;
  status: AttendanceStatus;
  durationMinutes?: number | null;
  userName?: string;
  userEmail?: string;
  department?: string | null;
  role?: string;
};

function formatTimeInOffice(r: TeamRow): string {
  if (r.durationMinutes != null && Number.isFinite(r.durationMinutes) && r.durationMinutes >= 0) {
    return formatDurationMinutes(r.durationMinutes);
  }
  if (r.checkInAt && r.checkOutAt) {
    const ms = new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime();
    if (ms >= 0) return formatDurationMinutes(Math.round(ms / 60000));
  }
  return "—";
}

function formatDurationMinutes(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function toCsv(rows: TeamRow[]): string {
  const headers = [
    "Employee",
    "Email",
    "Department",
    "Role",
    "Date",
    "Check-in",
    "Check-out",
    "Time in office",
    "Distance m",
    "Match %",
    "Status",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const match = r.faceMatchScore != null ? Math.round(Number(r.faceMatchScore) * 100) : "";
    const office = formatTimeInOffice(r);
    lines.push(
      [
        JSON.stringify(r.userName ?? ""),
        JSON.stringify(r.userEmail ?? ""),
        JSON.stringify(r.department ?? ""),
        JSON.stringify(r.role ?? ""),
        typeof r.date === "string" ? r.date.slice(0, 10) : "",
        r.checkInAt ? format(new Date(r.checkInAt), "yyyy-MM-dd HH:mm") : "",
        r.checkOutAt ? format(new Date(r.checkOutAt), "yyyy-MM-dd HH:mm") : "",
        JSON.stringify(office === "—" ? "" : office),
        r.checkInDistance != null ? Math.round(r.checkInDistance) : "",
        match,
        r.status,
      ].join(","),
    );
  }
  return lines.join("\n");
}

function toExcel(rows: TeamRow[], fileDate: string) {
  const data = rows.map(r => {
    const office = formatTimeInOffice(r);
    return {
      Employee: r.userName ?? "",
      Email: r.userEmail ?? "",
      Department: r.department ?? "",
      Role: r.role ?? "",
      Date: typeof r.date === "string" ? r.date.slice(0, 10) : "",
      "Check-in": r.checkInAt ? format(new Date(r.checkInAt), "yyyy-MM-dd HH:mm") : "",
      "Check-out": r.checkOutAt ? format(new Date(r.checkOutAt), "yyyy-MM-dd HH:mm") : "",
      "Time in office": office === "—" ? "" : office,
      "Distance (m)": r.checkInDistance != null ? Math.round(r.checkInDistance) : "",
      "Match %": r.faceMatchScore != null ? Math.round(Number(r.faceMatchScore) * 100) : "",
      Status: r.status,
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  XLSX.writeFile(wb, `attendance-${fileDate}.xlsx`);
}

export default function TeamAttendancePage() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState<AttendanceStatus | "">("");
  const [search, setSearch] = useState("");
  const [heatmap, setHeatmap] = useState(false);
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));

  const { data: summaryRes } = useQuery({
    queryKey: ["attendance-today-summary"],
    queryFn: async () => {
      const res = await attendanceApi.getTodaySummary();
      return res.data.data.summary;
    },
  });

  const { data: teamRes, refetch } = useQuery({
    queryKey: ["attendance-team", date, department, status, search],
    queryFn: async () => {
      const res = await attendanceApi.getTeamAttendance({
        date,
        department: department || undefined,
        status: status || undefined,
        search: search || undefined,
        page: 1,
        pageSize: 100,
      });
      return res.data.data;
    },
  });

  const { data: heatmapRes } = useQuery({
    queryKey: ["attendance-heatmap", month],
    enabled: heatmap,
    queryFn: async () => {
      const res = await attendanceApi.getTeamHeatmap(month);
      return res.data.data.rows as Array<{
        userId: number;
        date: string;
        status: AttendanceStatus;
        user: { name: string };
      }>;
    },
  });

  const records = (teamRes?.records ?? []) as TeamRow[];

  const downloadCsv = () => {
    const csv = toCsv(records);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started");
  };

  const downloadExcel = () => {
    try {
      toExcel(records, date);
      toast.success("Excel download started");
    } catch {
      toast.error("Excel export failed");
    }
  };

  const heatmapGrid = useMemo(() => {
    if (!heatmapRes?.length) {
      return null;
    }
    const users = [...new Map(heatmapRes.map(r => [r.userId, r.user?.name ?? "?"])).entries()];
    const days: string[] = [];
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = 1; d <= last; d++) {
      days.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    const key = (uid: number, ds: string) =>
      heatmapRes.find(
        r =>
          r.userId === uid &&
          (typeof r.date === "string" ? r.date.slice(0, 10) : format(new Date(r.date), "yyyy-MM-dd")) === ds,
      );
    return { users, days, key };
  }, [heatmapRes, month]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Team attendance</h1>
      </div>

      {summaryRes ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Present", summaryRes.present],
            ["Absent", summaryRes.absent],
            ["Face failed", summaryRes.faceFailed],
            ["Manual +/-", summaryRes.manualPresent + summaryRes.manualAbsent],
            ["Pending", summaryRes.pending],
            ["Staff", summaryRes.totalUsers],
          ].map(([label, val]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-4 shadow-sm"
            >
              <p className="text-xs text-neutral-500">{label}</p>
              <p className="text-2xl font-semibold">{val}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-4">
        <label className="text-xs text-neutral-500">
          Date
          <input
            type="date"
            className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-sm"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </label>
        <label className="text-xs text-neutral-500">
          Department
          <input
            className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-sm"
            value={department}
            onChange={e => setDepartment(e.target.value)}
            placeholder="Exact match"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Status
          <select
            className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-sm"
            value={status}
            onChange={e => setStatus(e.target.value as AttendanceStatus | "")}
          >
            <option value="">All</option>
            <option value="PRESENT">Present</option>
            <option value="FACE_FAILED">Face failed</option>
            <option value="PENDING">Pending</option>
            <option value="MANUAL_PRESENT">Manual present</option>
            <option value="MANUAL_ABSENT">Manual absent</option>
            <option value="ABSENT">Absent</option>
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          Search
          <input
            className="mt-1 block rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name or email"
          />
        </label>
        <button
          type="button"
          className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm text-white"
          onClick={() => void refetch()}
        >
          Apply
        </button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={downloadCsv}>
          Export CSV
        </button>
        <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={downloadExcel}>
          Export Excel
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={heatmap} onChange={e => setHeatmap(e.target.checked)} />
          Heatmap
        </label>
        {heatmap ? (
          <input
            type="month"
            className="rounded-lg border px-2 py-2 text-sm"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
        ) : null}
      </div>

      {heatmap && heatmapGrid ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                <th className="border-b p-2">Employee</th>
                {heatmapGrid.days.map(d => (
                  <th key={d} className="border-b p-1 text-center">
                    {d.slice(-2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapGrid.users.map(([uid, name]) => (
                <tr key={uid}>
                  <td className="border-b p-2 font-medium">{name}</td>
                  {heatmapGrid.days.map(d => {
                    const r = heatmapGrid.key(uid, d);
                    const color =
                      r?.status === "PRESENT"
                        ? "bg-emerald-500"
                        : r?.status === "FACE_FAILED"
                          ? "bg-orange-500"
                          : r
                            ? "bg-blue-400"
                            : "bg-neutral-200";
                    return (
                      <td key={d} className="border-b p-0.5 text-center" title={r?.status}>
                        <div className={`mx-auto h-4 w-4 rounded ${color}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/50">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Department</th>
                <th className="p-3">Role</th>
                <th className="p-3">Check-in</th>
                <th className="p-3">Check-out</th>
                <th className="p-3">Time in office</th>
                <th className="p-3">Distance</th>
                <th className="p-3">Match</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b border-[var(--border)]/60">
                  <td className="p-3">{r.userName}</td>
                  <td className="p-3">{r.department ?? "—"}</td>
                  <td className="p-3">{r.role ?? "—"}</td>
                  <td className="p-3">{r.checkInAt ? format(new Date(r.checkInAt), "p") : "—"}</td>
                  <td className="p-3">{r.checkOutAt ? format(new Date(r.checkOutAt), "p") : "—"}</td>
                  <td className="p-3 text-neutral-700">{formatTimeInOffice(r)}</td>
                  <td className="p-3">{r.checkInDistance != null ? `${Math.round(r.checkInDistance)}m` : "—"}</td>
                  <td className="p-3">
                    {r.faceMatchScore != null ? `${Math.round(Number(r.faceMatchScore) * 100)}%` : "—"}
                  </td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">
                    <OverrideButton row={r} onDone={() => void refetch()} />
                  </td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-neutral-500">
                    No records for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OverrideButton({ row, onDone }: { row: TeamRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (st: "MANUAL_PRESENT" | "MANUAL_ABSENT") => {
    setBusy(true);
    try {
      const d = typeof row.date === "string" ? row.date.slice(0, 10) : format(new Date(row.date), "yyyy-MM-dd");
      await attendanceApi.manualOverride({ userId: row.userId, date: d, status: st, note: note || undefined });
      toast.success("Updated");
      setOpen(false);
      onDone();
    } catch {
      toast.error("Override failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="text-sm text-[var(--accent-primary)] underline" onClick={() => setOpen(true)}>
        Override
      </button>
      {open ? (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Manual override</h3>
            <p className="mt-2 text-sm text-neutral-600">{row.userName}</p>
            <textarea
              className="mt-3 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
              placeholder="Note (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
                onClick={() => void run("MANUAL_PRESENT")}
              >
                Mark present
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white"
                onClick={() => void run("MANUAL_ABSENT")}
              >
                Mark absent
              </button>
              <button type="button" className="ml-auto text-sm text-neutral-500" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
