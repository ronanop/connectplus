import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Building2, CalendarClock, Clock, Trash2, Users } from "lucide-react";
import { AnimatedBottomSheet } from "../AnimatedBottomSheet";
import {
  DURATION_OPTIONS,
  MEETING_ROOMS,
  meetingRoomKeys,
  meetingRoomsApi,
  type MeetingRoomBookingRow,
  type MeetingRoomKey,
  useAuthStore,
} from "#meeting-rooms-deps";

function defaultStartLocalValue(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setMinutes(d.getMinutes() + 30);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function roomLabel(key: MeetingRoomKey): string {
  return MEETING_ROOMS.find(r => r.key === key)?.label ?? key;
}

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]";

export function MeetingRoomsPageContent() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [roomKey, setRoomKey] = useState<MeetingRoomKey>("BOSE");
  const [startLocal, setStartLocal] = useState(defaultStartLocalValue);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [attendees, setAttendees] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: meetingRoomKeys.mine(),
    queryFn: () => meetingRoomsApi.listMine(),
    enabled: Boolean(user?.organizationId),
  });

  const createMut = useMutation({
    mutationFn: meetingRoomsApi.create,
    onSuccess: async () => {
      setSheetOpen(false);
      setTitle("");
      setAttendees("");
      setFormError(null);
      setStartLocal(defaultStartLocalValue());
      setDurationMinutes(60);
      setRoomKey("BOSE");
      await queryClient.invalidateQueries({ queryKey: meetingRoomKeys.all });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not create booking.";
      setFormError(String(msg));
    },
  });

  const deleteMut = useMutation({
    mutationFn: meetingRoomsApi.deleteBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meetingRoomKeys.all }),
  });

  const openNewSheet = (initialRoom?: MeetingRoomKey) => {
    setFormError(null);
    setTitle("");
    setAttendees("");
    setStartLocal(defaultStartLocalValue());
    setDurationMinutes(60);
    setRoomKey(initialRoom ?? "BOSE");
    setSheetOpen(true);
  };

  function durationLabel(m: number): string {
    if (m < 60) {
      return `${m} min`;
    }
    const h = Math.floor(m / 60);
    const min = m % 60;
    if (min === 0) {
      return h === 1 ? "1 h" : `${h} h`;
    }
    return `${h} h ${min} min`;
  }

  const { upcoming, past } = useMemo(() => {
    const rows = query.data ?? [];
    const now = Date.now();
    const u: MeetingRoomBookingRow[] = [];
    const p: MeetingRoomBookingRow[] = [];
    for (const b of rows) {
      const t = parseISO(b.endAt).getTime();
      if (t >= now) {
        u.push(b);
      } else {
        p.push(b);
      }
    }
    u.sort((a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime());
    return { upcoming: u, past: p };
  }, [query.data]);

  const submit = () => {
    setFormError(null);
    if (!title.trim()) {
      setFormError("Enter a meeting name.");
      return;
    }
    const start = new Date(startLocal);
    if (Number.isNaN(start.getTime())) {
      setFormError("Pick a valid start date and time.");
      return;
    }
    if (start.getTime() < Date.now() - 60_000) {
      setFormError("Start time must be in the future.");
      return;
    }
    createMut.mutate({
      roomKey,
      title: title.trim(),
      startAt: start.toISOString(),
      durationMinutes,
      attendees: attendees.trim() || null,
    });
  };

  if (!user?.organizationId) {
    return (
      <p className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
        Your account is not linked to an organization. Meeting room booking is available once an administrator assigns you to
        an organization.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-2">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Choose a room</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Tap a room to start a booking, or use the button below.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {MEETING_ROOMS.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => openNewSheet(r.key)}
              className="mobile-tap rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3 text-left text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-elevated)]"
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openNewSheet()}
          className="mobile-tap mt-4 w-full rounded-xl bg-[var(--accent-primary)] py-3 text-sm font-semibold text-white shadow-sm"
        >
          Book a meeting room
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Your bookings</h2>
        {query.isLoading ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Loading…</p>
        ) : query.isError ? (
          <p className="mt-3 text-sm text-red-600">Could not load bookings.</p>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Upcoming</p>
                <ul className="space-y-2">
                  {upcoming.map(b => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      onDelete={() => {
                        if (window.confirm("Cancel this booking?")) {
                          deleteMut.mutate(b.id);
                        }
                      }}
                      deleting={deleteMut.isPending}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
            {past.length > 0 ? (
              <div className={upcoming.length > 0 ? "mt-5 space-y-2" : "mt-3 space-y-2"}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Past</p>
                <ul className="space-y-2">
                  {past.map(b => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </ul>
              </div>
            ) : null}
            {upcoming.length === 0 && past.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">No bookings yet. Pick a room above to schedule one.</p>
            ) : null}
          </>
        )}
      </div>

      <AnimatePresence>
        {sheetOpen ? (
          <AnimatedBottomSheet titleId="mr-book-title" onClose={() => setSheetOpen(false)}>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-[var(--border)] px-5 pb-4 pt-4">
                <div className="mb-3 flex justify-center sm:hidden" aria-hidden>
                  <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
                </div>
                <h2 id="mr-book-title" className="text-lg font-semibold text-[var(--text-primary)]">
                  New booking
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Room, time, duration, and who should join.</p>
              </div>
              <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">
                <div className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mr-title">
                      Meeting name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="mr-title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Q2 planning sync"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Room</span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {MEETING_ROOMS.map(r => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setRoomKey(r.key)}
                          className={`rounded-xl border px-2 py-2.5 text-center text-xs font-medium transition ${
                            roomKey === r.key
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]"
                              : "border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mr-start">
                      Starts
                    </label>
                    <input
                      id="mr-start"
                      type="datetime-local"
                      value={startLocal}
                      onChange={e => setStartLocal(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mr-dur">
                      Duration
                    </label>
                    <select
                      id="mr-dur"
                      value={durationMinutes}
                      onChange={e => setDurationMinutes(Number(e.target.value))}
                      className={inputClass}
                    >
                      {DURATION_OPTIONS.map(m => (
                        <option key={m} value={m}>
                          {durationLabel(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]" htmlFor="mr-att">
                      Attendees <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                    </label>
                    <textarea
                      id="mr-att"
                      value={attendees}
                      onChange={e => setAttendees(e.target.value)}
                      rows={3}
                      placeholder="Names or emails, one per line or comma-separated"
                      className={`${inputClass} min-h-[4.5rem] resize-y`}
                    />
                  </div>
                  {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
                </div>
              </div>
              <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 pt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[max(1rem,var(--safe-bottom))]">
                <button
                  type="button"
                  disabled={createMut.isPending}
                  onClick={submit}
                  className="mobile-tap w-full rounded-xl bg-[var(--accent-primary)] py-3.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                >
                  {createMut.isPending ? "Saving…" : "Confirm booking"}
                </button>
              </div>
            </div>
          </AnimatedBottomSheet>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function BookingCard({
  booking,
  onDelete,
  deleting,
}: {
  booking: MeetingRoomBookingRow;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const start = parseISO(booking.startAt);
  const end = parseISO(booking.endAt);
  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">{booking.title}</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--accent-primary)]">{roomLabel(booking.roomKey)}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              {format(start, "EEE, MMM d · HH:mm")} – {format(end, "HH:mm")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {Math.round((end.getTime() - start.getTime()) / 60000)} min
            </span>
          </div>
          {booking.attendees ? (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-pre-wrap">{booking.attendees}</span>
            </p>
          ) : null}
        </div>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="shrink-0 rounded-lg p-2 text-red-600/80 hover:bg-red-500/10 disabled:opacity-50"
            aria-label="Cancel booking"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
