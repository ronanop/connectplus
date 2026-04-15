import type { MouseEventHandler } from "react";
import type { TaskStatus } from "../../lib/hierarchyTasksApi";

const styles: Record<TaskStatus, string> = {
  PENDING: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border border-neutral-500/25",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25",
  ON_HOLD: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/25",
  COMPLETION_PENDING_APPROVAL:
    "bg-violet-500/15 text-violet-800 dark:text-violet-200 border border-violet-500/30",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25",
  CANCELLED: "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/25 line-through",
};

export function StatusBadge({
  status,
  onClick,
  disabled,
}: {
  status: TaskStatus;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}) {
  const label = status.replaceAll("_", " ");
  const className = `inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`;
  if (onClick && !disabled) {
    return (
      <button type="button" onClick={onClick} className={`${className} cursor-pointer hover:opacity-90`}>
        {label}
      </button>
    );
  }
  return <span className={className}>{label}</span>;
}
