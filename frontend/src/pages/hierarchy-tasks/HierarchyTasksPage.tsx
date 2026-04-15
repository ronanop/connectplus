import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { format, formatDistanceToNow } from "date-fns";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import {
  formatHierarchyAssigneeNames,
  hierarchyTasksApi,
  isUserHierarchyAssignee,
  type DirectTaskStatus,
  type HierarchyTaskListItem,
  type TaskStatus,
} from "../../lib/hierarchyTasksApi";
import { hierarchyTaskKeys } from "../../lib/queryKeys";
import { getHierarchyErrorMessage } from "../../lib/hierarchyError";
import { canUserAssignTasks, isOrganizationMemberRole } from "../../lib/taskHierarchy";
import { CreateTaskModal } from "../../components/hierarchy-tasks/CreateTaskModal";
import { TaskDetailDrawer } from "../../components/hierarchy-tasks/TaskDetailDrawer";
import { HierarchyKanbanBoard } from "../../components/hierarchy-tasks/HierarchyKanbanBoard";
import { PriorityBadge } from "../../components/hierarchy-tasks/PriorityBadge";
import { StatusBadge } from "../../components/hierarchy-tasks/StatusBadge";
import { RoleBadge } from "../../components/hierarchy-tasks/RoleBadge";

const STATUS_OPTIONS: Array<TaskStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETION_PENDING_APPROVAL",
  "COMPLETED",
  "CANCELLED",
];
const PRIORITY_OPTIONS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const STATUS_ORDER: TaskStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETION_PENDING_APPROVAL",
  "COMPLETED",
  "CANCELLED",
];

const INLINE_STATUS_CHANGE: DirectTaskStatus[] = ["PENDING", "IN_PROGRESS", "ON_HOLD", "CANCELLED"];

function TaskCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--border)]/80 bg-[var(--bg-surface)] p-4">
      <div className="h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="mt-3 h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="mt-2 h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}

export default function HierarchyTasksPage() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const params = useParams();
  const taskIdParam = params.taskId ? parseInt(params.taskId, 10) : NaN;
  const queryClient = useQueryClient();

  const [scope, setScope] = useState<"mine" | "assigned_by_me" | "all">("mine");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [dueSoon, setDueSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [statusMenuTaskId, setStatusMenuTaskId] = useState<number | null>(null);

  const drawerTaskId = Number.isFinite(taskIdParam) ? taskIdParam : null;
  const drawerOpen = drawerTaskId != null;

  const setDrawerTask = useCallback(
    (id: number | null) => {
      if (id == null) {
        navigate("/tasks/hierarchy");
      } else {
        navigate(`/tasks/hierarchy/${id}`);
      }
    },
    [navigate],
  );

  const listParams = useMemo(() => {
    const p: Record<string, string> = { scope };
    if (statusFilter.length) {
      p.status = statusFilter.join(",");
    }
    if (priorityFilter !== "ALL") {
      p.priority = priorityFilter;
    }
    if (departmentFilter.trim()) {
      p.department = departmentFilter.trim();
    }
    if (dueSoon) {
      p.dueSoon = "true";
    }
    if (search.trim()) {
      p.search = search.trim();
    }
    return p;
  }, [scope, statusFilter, priorityFilter, departmentFilter, dueSoon, search]);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: hierarchyTaskKeys.list(listParams),
    queryFn: () => hierarchyTasksApi.list(listParams),
  });

  const departments = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) {
      if (t.department?.trim()) {
        s.add(t.department.trim());
      }
    }
    return [...s].sort();
  }, [tasks]);

  const canAssign = user?.role ? canUserAssignTasks(user.role) : false;
  const showAllTab = user?.role ? isOrganizationMemberRole(user.role) : false;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: DirectTaskStatus }) =>
      hierarchyTasksApi.updateStatus(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: hierarchyTaskKeys.list(listParams) });
      const prev = queryClient.getQueryData<HierarchyTaskListItem[]>(hierarchyTaskKeys.list(listParams));
      if (prev) {
        queryClient.setQueryData(
          hierarchyTaskKeys.list(listParams),
          prev.map(t => (t.id === id ? { ...t, status } : t)),
        );
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(hierarchyTaskKeys.list(listParams), ctx.prev);
      }
      toast.error(getHierarchyErrorMessage(err));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.lists() });
      if (drawerTaskId != null) {
        queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.detail(drawerTaskId) });
      }
    },
  });

  const toggleStatusChip = (s: TaskStatus) => {
    setStatusFilter(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
  };

  const groupedList = useMemo(() => {
    const m = new Map<TaskStatus, HierarchyTaskListItem[]>();
    for (const s of STATUS_ORDER) {
      m.set(s, []);
    }
    for (const t of tasks) {
      const arr = m.get(t.status);
      if (arr) {
        arr.push(t);
      }
    }
    return m;
  }, [tasks]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Workspace</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Task Board</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-300">{user.name}</span>
            <RoleBadge roleName={user.role} />
          </div>
        </div>
        {canAssign ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Assign task
          </button>
        ) : null}
      </div>

      {!canAssign && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Your role cannot assign tasks, but you can still track tasks assigned to you.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)]/60 pb-4">
        <button
          type="button"
          onClick={() => setScope("mine")}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            scope === "mine" ? "bg-[var(--accent-primary)] text-white" : "border border-[var(--border)] bg-[var(--bg-elevated)]"
          }`}
        >
          My tasks
        </button>
        <button
          type="button"
          onClick={() => setScope("assigned_by_me")}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            scope === "assigned_by_me" ? "bg-[var(--accent-primary)] text-white" : "border border-[var(--border)] bg-[var(--bg-elevated)]"
          }`}
        >
          Assigned by me
        </button>
        {showAllTab ? (
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              scope === "all" ? "bg-[var(--accent-primary)] text-white" : "border border-[var(--border)] bg-[var(--bg-elevated)]"
            }`}
          >
            All
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-[var(--border)]/80 bg-[var(--bg-surface)]/90 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">Status</span>
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (s === "ALL") {
                    setStatusFilter([]);
                  } else {
                    toggleStatusChip(s);
                  }
                }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${
                  s === "ALL"
                    ? statusFilter.length === 0
                      ? "bg-[var(--accent-primary)] text-white"
                      : "bg-[var(--bg-elevated)]"
                    : statusFilter.includes(s)
                      ? "bg-[var(--accent-primary)] text-white"
                      : "bg-[var(--bg-elevated)]"
                }`}
              >
                {s === "ALL" ? "All" : s.replaceAll("_", " ")}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">Priority</span>
            <select
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-sm"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>
                  {p === "ALL" ? "All" : p}
                </option>
              ))}
            </select>
            <span className="text-xs font-medium text-neutral-500">Department</span>
            <select
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-sm"
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
            >
              <option value="">All</option>
              {departments.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={dueSoon} onChange={e => setDueSoon(e.target.checked)} />
              Due soon (24h)
            </label>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-2 pl-9 pr-3 text-sm"
              placeholder="Search title or assignee…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex rounded-xl border border-[var(--border)]/80 p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${view === "list" ? "bg-[var(--accent-primary)] text-white" : ""}`}
          >
            <List className="h-4 w-4" />
            List
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${view === "kanban" ? "bg-[var(--accent-primary)] text-white" : ""}`}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/40 py-16 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">No tasks match your filters</p>
          <p className="mt-1 text-xs text-neutral-500">Try clearing filters or switching tabs.</p>
        </div>
      ) : view === "kanban" ? (
        <HierarchyKanbanBoard
          tasks={tasks}
          currentUserId={user.id}
          onOpenTask={id => setDrawerTask(id)}
          onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
        />
      ) : (
        <div className="space-y-8">
          {STATUS_ORDER.map(status => {
            const section = groupedList.get(status) ?? [];
            if (section.length === 0) {
              return null;
            }
            return (
              <div key={status}>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">{status.replaceAll("_", " ")}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {section.map(task => {
                    const deadlineMs = new Date(task.deadline).getTime();
                    const now = Date.now();
                    const overdue =
                      task.status !== "COMPLETED" && task.status !== "CANCELLED" && deadlineMs < now;
                    const dueSoon3h =
                      !overdue &&
                      deadlineMs - now > 0 &&
                      deadlineMs - now <= 3 * 60 * 60 * 1000 &&
                      task.status !== "COMPLETED" &&
                      task.status !== "CANCELLED";
                    const borderClass = overdue
                      ? "border-l-4 border-l-red-500"
                      : dueSoon3h
                        ? "border-l-4 border-l-amber-500"
                        : "border-l-4 border-l-transparent";
                    const isAssignee = isUserHierarchyAssignee(task, user.id);
                    return (
                      <div
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDrawerTask(task.id);
                          }
                        }}
                        onClick={() => setDrawerTask(task.id)}
                        className={`cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-left shadow-sm transition hover:border-[var(--accent-primary)]/40 ${borderClass}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <PriorityBadge priority={task.priority} />
                          <div className="relative">
                            {isAssignee ? (
                              <>
                                <StatusBadge
                                  status={task.status}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setStatusMenuTaskId(statusMenuTaskId === task.id ? null : task.id);
                                  }}
                                />
                                {statusMenuTaskId === task.id ? (
                                  <div
                                    className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1 shadow-lg"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {INLINE_STATUS_CHANGE.map(s => (
                                      <button
                                        key={s}
                                        type="button"
                                        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg-elevated)]"
                                        onClick={() => {
                                          if (s === "CANCELLED" && !window.confirm("Cancel this task?")) {
                                            return;
                                          }
                                          statusMutation.mutate({ id: task.id, status: s });
                                          setStatusMenuTaskId(null);
                                        }}
                                      >
                                        {s.replaceAll("_", " ")}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <StatusBadge status={task.status} />
                            )}
                          </div>
                        </div>
                        <p className="mt-2 font-semibold text-[var(--text-primary)]">{task.title}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {isAssignee ? (
                            <span className="rounded-full bg-[var(--accent-primary)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-primary)]">
                              Assigned to me
                            </span>
                          ) : (
                            <>To: {formatHierarchyAssigneeNames(task)}</>
                          )}
                        </p>
                        <p className={`mt-2 text-xs ${overdue ? "font-medium text-red-600" : dueSoon3h ? "text-amber-600" : "text-neutral-500"}`}>
                          {formatDistanceToNow(new Date(task.deadline), { addSuffix: true })} · {format(new Date(task.deadline), "p")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        allowDepartmentHandoff={user?.role ? isOrganizationMemberRole(user.role) : false}
      />

      <TaskDetailDrawer
        open={drawerOpen}
        taskId={drawerTaskId}
        currentUserId={user.id}
        currentUserRole={user.role}
        onClose={() => setDrawerTask(null)}
        onDeleted={() => setDrawerTask(null)}
      />
    </div>
  );
}
