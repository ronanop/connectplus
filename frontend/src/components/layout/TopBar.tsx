import { NotificationsMenu } from "./NotificationsMenu";

export function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-surface)]/95 px-6 backdrop-blur">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">Today</span>
        <span className="truncate text-sm font-medium text-[var(--text-primary)]">Pipeline overview</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationsMenu />
      </div>
    </header>
  );
}
