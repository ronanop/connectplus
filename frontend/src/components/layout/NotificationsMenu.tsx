import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import {
  fetchNotifications,
  markNotificationRead,
  type AppNotification,
} from "../../lib/notificationsApi";
import { useAuthStore } from "../../stores/authStore";

export function NotificationsMenu() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: payload, refetch } = useQuery({
    queryKey: ["app-notifications"],
    queryFn: () => fetchNotifications(80),
    enabled: Boolean(user),
    staleTime: 20_000,
    refetchInterval: 45_000,
  });

  const notifications: AppNotification[] = payload?.notifications ?? [];
  const unreadCount = payload?.unreadCount ?? 0;

  useEffect(() => {
    if (open && user) {
      void refetch();
    }
  }, [open, user, refetch]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!user) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <Bell className="h-4 w-4" strokeWidth={2.25} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Notifications</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">Task &amp; workspace alerts</p>
          </div>
          <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto h-9 w-9 text-neutral-300" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Assignments, status changes, comments, and uploads appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]/80">
                {notifications.map(n => {
                  const taskId =
                    n.metadata && typeof n.metadata.hierarchyTaskId === "number"
                      ? n.metadata.hierarchyTaskId
                      : null;
                  const unread = !n.readAt;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`w-full px-4 py-3 text-left transition hover:bg-[var(--bg-elevated)]/70 ${
                          unread ? "bg-[var(--accent-primary)]/[0.06]" : ""
                        }`}
                        onClick={async () => {
                          if (!n.readAt) {
                            try {
                              await markNotificationRead(n.id);
                              await queryClient.invalidateQueries({ queryKey: ["app-notifications"] });
                            } catch {
                              /* ignore */
                            }
                          }
                          setOpen(false);
                          if (taskId != null) {
                            navigate(`/tasks/hierarchy/${taskId}`);
                          }
                        }}
                      >
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{n.title}</p>
                        <p className="mt-1 break-words text-xs text-neutral-600">{n.message}</p>
                        <p className="mt-1.5 text-[10px] text-neutral-400">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
