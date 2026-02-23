import { useThemeStore } from "../../stores/themeStore";

export function TopBar() {
  const theme = useThemeStore(s => s.theme);
  const toggleTheme = useThemeStore(s => s.toggleTheme);

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)]/95 px-6 backdrop-blur">
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">Today</span>
        <span className="text-sm font-medium text-[var(--text-primary)]">Pipeline overview</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-[11px] font-medium text-neutral-700 shadow-sm transition hover:border-[var(--accent-primary)]/60 hover:text-[var(--accent-primary)]"
        >
          <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-gold)]" />
          <span>{theme === "light" ? "Obsidian dark" : "Ivory light"}</span>
        </button>
      </div>
    </header>
  );
}
