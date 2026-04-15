import { LayoutGrid } from "lucide-react";

export function HrHomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] text-[var(--accent-primary)]">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">HR workspace</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Access requires an HR department assignment or HR tag (same rules as CRM). Use Microsoft 365 for the employee
            directory. Open HR modules from the sidebar under <span className="font-medium text-[var(--text-primary)]">HR home</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
