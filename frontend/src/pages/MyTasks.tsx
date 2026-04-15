import { Outlet } from "react-router-dom";

export function MyTasksLayout() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Task Board</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Assign and track work across your organization hierarchy.
        </p>
      </div>

      <Outlet />
    </div>
  );
}
