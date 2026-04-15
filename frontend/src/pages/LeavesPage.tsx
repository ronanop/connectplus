import { LeavesPageContent } from "../shared/leaves/LeavesPageContent";

export function LeavesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">People & workplace</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Leaves</h1>
        <p className="mt-1 text-sm text-neutral-500">Time off requests and balances</p>
      </div>
      <div className="max-w-3xl">
        <LeavesPageContent actionHint="Click a date to request leave for that day." />
      </div>
    </div>
  );
}
