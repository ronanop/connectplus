import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  isUserHierarchyAssignee,
  type DirectTaskStatus,
  type HierarchyTaskListItem,
} from "../../lib/hierarchyTasksApi";
import type { TaskStatus } from "../../lib/hierarchyTasksApi";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

const COLUMNS: TaskStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETION_PENDING_APPROVAL",
  "COMPLETED",
  "CANCELLED",
];

function columnTint(status: TaskStatus): string {
  switch (status) {
    case "PENDING":
      return "bg-neutral-500/5";
    case "IN_PROGRESS":
      return "bg-blue-500/5";
    case "ON_HOLD":
      return "bg-amber-500/5";
    case "COMPLETION_PENDING_APPROVAL":
      return "bg-violet-500/5";
    case "COMPLETED":
      return "bg-emerald-500/5";
    case "CANCELLED":
      return "bg-red-500/5";
    default:
      return "";
  }
}

function DraggableCard({
  task,
  disabled,
  onOpen,
}: {
  task: HierarchyTaskListItem;
  disabled: boolean;
  onOpen: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ht-card-${task.id}`,
    data: { task },
    disabled,
  });
  const style = { transform: CSS.Translate.toString(transform) };

  const deadlineMs = new Date(task.deadline).getTime();
  const now = Date.now();
  const overdue =
    task.status !== "COMPLETED" && task.status !== "CANCELLED" && deadlineMs < now;
  const dueSoon =
    !overdue &&
    deadlineMs - now > 0 &&
    deadlineMs - now <= 3 * 60 * 60 * 1000 &&
    task.status !== "COMPLETED" &&
    task.status !== "CANCELLED";

  const borderClass = overdue ? "border-l-4 border-l-red-500" : dueSoon ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-transparent";

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      layout
      className={`${borderClass} ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
    >
      <div
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(task.id);
          }
        }}
        onClick={() => onOpen(task.id)}
        className={`w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-left shadow-sm transition hover:border-[var(--accent-primary)]/30 ${
          isDragging ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
        <p className="mt-2 font-semibold text-[var(--text-primary)]">{task.title}</p>
        <p className={`mt-1 text-xs ${overdue ? "text-red-600" : dueSoon ? "text-amber-600" : "text-neutral-500"}`}>
          {new Date(task.deadline).toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          To:{" "}
          {task.assignees.length
            ? task.assignees.map(a => a.name).join(", ")
            : task.assignedTo?.name ?? "—"}
        </p>
      </div>
    </motion.div>
  );
}

function DroppableColumn({
  status,
  children,
}: {
  status: TaskStatus;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[320px] min-w-[220px] flex-1 flex-col gap-2 rounded-2xl border border-[var(--border)]/80 p-2 ${columnTint(status)} ${
        isOver ? "ring-2 ring-[var(--accent-primary)]/40" : ""
      }`}
    >
      <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">{status.replaceAll("_", " ")}</p>
      {children}
    </div>
  );
}

type Props = {
  tasks: HierarchyTaskListItem[];
  currentUserId: number;
  /** Completion / approval columns are display-only; drag updates use direct statuses only. */
  onStatusChange: (taskId: number, status: DirectTaskStatus) => void;
  onOpenTask: (id: number) => void;
};

export function HierarchyKanbanBoard({ tasks, currentUserId, onStatusChange, onOpenTask }: Props) {
  const [activeTask, setActiveTask] = useState<HierarchyTaskListItem | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStatus = useMemo(() => {
    const m = new Map<TaskStatus, HierarchyTaskListItem[]>();
    for (const s of COLUMNS) {
      m.set(s, []);
    }
    for (const t of tasks) {
      const list = m.get(t.status);
      if (list) {
        list.push(t);
      }
    }
    return m;
  }, [tasks]);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) {
      return;
    }
    const task = active.data.current?.task as HierarchyTaskListItem | undefined;
    if (!task) {
      return;
    }
    const newStatus = over.id as TaskStatus;
    if (!COLUMNS.includes(newStatus) || task.status === newStatus) {
      return;
    }
    if (newStatus === "COMPLETED" || newStatus === "COMPLETION_PENDING_APPROVAL") {
      return;
    }
    if (!isUserHierarchyAssignee(task, currentUserId)) {
      return;
    }
    onStatusChange(task.id, newStatus as DirectTaskStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={e => {
        const t = e.active.data.current?.task as HierarchyTaskListItem | undefined;
        setActiveTask(t ?? null);
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map(status => (
          <DroppableColumn key={status} status={status}>
            {(byStatus.get(status) ?? []).map(task => (
              <DraggableCard
                key={task.id}
                task={task}
                disabled={!isUserHierarchyAssignee(task, currentUserId)}
                onOpen={onOpenTask}
              />
            ))}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="w-64 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-xl">
            <PriorityBadge priority={activeTask.priority} />
            <p className="mt-2 font-semibold">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
