import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { TaskPriority } from "../../lib/hierarchyTasksApi";

const styles: Record<
  TaskPriority,
  { className: string; Icon: typeof AlertTriangle; label: string }
> = {
  CRITICAL: {
    className: "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30",
    Icon: AlertTriangle,
    label: "Critical priority",
  },
  HIGH: {
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30",
    Icon: ArrowUp,
    label: "High priority",
  },
  MEDIUM: {
    className: "bg-amber-400/20 text-amber-800 dark:text-amber-200 border border-amber-500/25",
    Icon: Minus,
    label: "Medium priority",
  },
  LOW: {
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25",
    Icon: ArrowDown,
    label: "Low priority",
  },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = styles[priority];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.className}`}
      aria-label={cfg.label}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {priority.replace("_", " ")}
    </span>
  );
}
