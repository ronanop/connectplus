export function TopBar() {
  return (
    <header className="flex h-14 items-center border-b border-[var(--border)] bg-[var(--bg-surface)]/95 px-6 backdrop-blur">
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">Today</span>
        <span className="text-sm font-medium text-[var(--text-primary)]">Pipeline overview</span>
      </div>
    </header>
  );
}
