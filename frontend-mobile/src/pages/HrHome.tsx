/** HR landing copy; module links live under HR home in the sidebar menu. */
export function HrHomeContent() {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-[var(--text-muted)]">
        Use the menu (<span className="font-medium text-[var(--text-primary)]">☰</span>) and expand{" "}
        <span className="font-medium text-[var(--text-primary)]">HR home</span> to open HR modules. Employee directory:
        Microsoft 365.
      </p>
    </div>
  );
}
