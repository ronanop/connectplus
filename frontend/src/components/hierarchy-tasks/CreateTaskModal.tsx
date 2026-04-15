import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { Loader2, Search, X } from "lucide-react";
import {
  hierarchyTasksApi,
  type AssignableUser,
  type TaskPriority,
} from "../../lib/hierarchyTasksApi";
import { hierarchyTaskKeys } from "../../lib/queryKeys";
import { getHierarchyErrorMessage } from "../../lib/hierarchyError";
import { RoleBadge } from "./RoleBadge";
import { PriorityBadge } from "./PriorityBadge";

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Organization-level roles can route a task to a department (managers add ICs). */
  allowDepartmentHandoff?: boolean;
};

export function CreateTaskModal({ open, onClose, allowDepartmentHandoff = false }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [assignMode, setAssignMode] = useState<"people" | "department">("people");
  const [handoffDepartment, setHandoffDepartment] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [deadlineError, setDeadlineError] = useState("");
  const assigneeSearchRef = useRef(assigneeSearch);
  assigneeSearchRef.current = assigneeSearch;
  const syncedDirectoryQueriesRef = useRef<Set<string>>(new Set());
  const directorySyncInFlightRef = useRef(false);

  const { data: assignable = [], isLoading: loadingUsers } = useQuery({
    queryKey: hierarchyTaskKeys.assignableUsers(),
    queryFn: () => hierarchyTasksApi.getAssignableUsers(),
    enabled: open && assignMode === "people",
  });

  const { data: handoffDepartments = [], isLoading: loadingHandoffDepts } = useQuery({
    queryKey: hierarchyTaskKeys.handoffDepartments(),
    queryFn: () => hierarchyTasksApi.listHandoffDepartments(),
    enabled: open && allowDepartmentHandoff && assignMode === "department",
  });

  const filteredAssignable = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) {
      return assignable;
    }
    return assignable.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.name.toLowerCase().includes(q) ||
        (u.department?.toLowerCase().includes(q) ?? false),
    );
  }, [assignable, assigneeSearch]);

  const directorySyncMutation = useMutation({
    mutationFn: (q: string) => hierarchyTasksApi.syncDirectoryFromMicrosoft(q),
  });

  useEffect(() => {
    if (!open) {
      syncedDirectoryQueriesRef.current.clear();
      setAssignMode("people");
      setHandoffDepartment("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const q = assigneeSearch.trim();
    if (q.length < 2) {
      return;
    }
    const t = window.setTimeout(() => {
      const latest = assigneeSearchRef.current.trim();
      if (latest.length < 2) {
        return;
      }
      if (syncedDirectoryQueriesRef.current.has(latest) || directorySyncMutation.isPending || directorySyncInFlightRef.current) {
        return;
      }
      const cached = queryClient.getQueryData<AssignableUser[]>(hierarchyTaskKeys.assignableUsers());
      const list = cached ?? assignable;
      const ql = latest.toLowerCase();
      const hit = list.some(
        u =>
          u.name.toLowerCase().includes(ql) ||
          u.email.toLowerCase().includes(ql) ||
          (u.department?.toLowerCase().includes(ql) ?? false),
      );
      if (hit) {
        return;
      }
      directorySyncInFlightRef.current = true;
      directorySyncMutation.mutate(latest, {
        onSuccess: async data => {
          syncedDirectoryQueriesRef.current.add(latest);
          await queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.assignableUsers() });
          if (data.graphConfigured && data.matchedDirectory === 0) {
            toast.info("No Microsoft 365 users matched that search for your domain.");
          } else if (data.graphConfigured && (data.created > 0 || data.updated > 0)) {
            toast.success(
              `Synced from Microsoft 365: ${data.created} new, ${data.updated} updated (${data.matchedDirectory} matched).`,
            );
          } else if (!data.graphConfigured) {
            toast.info("Microsoft Graph is not configured; ask an admin to set Azure app credentials.");
          }
        },
        onError: err => {
          toast.error(getHierarchyErrorMessage(err));
        },
        onSettled: () => {
          directorySyncInFlightRef.current = false;
        },
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [open, assigneeSearch, assignable, queryClient, directorySyncMutation]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!date || !time) {
        throw new Error("Please choose date and time");
      }
      const local = new Date(`${date}T${time}:00`);
      if (Number.isNaN(local.getTime())) {
        throw new Error("Invalid deadline");
      }
      if (local.getTime() < Date.now()) {
        throw new Error("Deadline cannot be in the past");
      }
      if (assignMode === "department") {
        if (!handoffDepartment.trim()) {
          throw new Error("Choose a department");
        }
      } else if (selectedAssigneeIds.length === 0) {
        throw new Error("Choose at least one assignee");
      }
      const deadline = local.toISOString();
      if (assignMode === "department") {
        return hierarchyTasksApi.create({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          deadline,
          assignToDepartment: handoffDepartment.trim(),
        });
      }
      return hierarchyTasksApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        deadline,
        assignedToIds: selectedAssigneeIds,
      });
    },
    onSuccess: task => {
      const handoff = task.assignmentMode === "DEPARTMENT_HANDOFF";
      const names = task.assignees.map(a => a.name).join(", ");
      toast.success(
        handoff
          ? `Task sent to ${task.handoffTargetDepartment ?? "department"} managers (${names || "notified"})`
          : names
            ? `Task assigned to ${names}`
            : "Task created",
      );
      queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.lists() });
      onClose();
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setDate("");
      setTime("09:00");
      setSelectedAssigneeIds([]);
      setAssignMode("people");
      setHandoffDepartment("");
      setAssigneeSearch("");
      setDeadlineError("");
    },
    onError: err => {
      toast.error(getHierarchyErrorMessage(err));
    },
  });

  const toggleAssignee = (id: number) => {
    setSelectedAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const removeAssignee = (id: number) => {
    setSelectedAssigneeIds(prev => prev.filter(x => x !== id));
  };

  const selectedUsers = useMemo(() => {
    const map = new Map(assignable.map(u => [u.id, u]));
    return selectedAssigneeIds.map(sid => map.get(sid)).filter(Boolean) as AssignableUser[];
  }, [assignable, selectedAssigneeIds]);

  const validateDeadline = () => {
    if (!date || !time) {
      setDeadlineError("");
      return;
    }
    const local = new Date(`${date}T${time}:00`);
    if (Number.isNaN(local.getTime())) {
      setDeadlineError("Invalid date or time");
      return;
    }
    if (local.getTime() < Date.now()) {
      setDeadlineError("Deadline cannot be in the past");
      return;
    }
    setDeadlineError("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
          onClick={onClose}
        >
          <motion.div
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Assign task</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-neutral-500 hover:bg-[var(--bg-elevated)]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-500">Title *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-500">Description</label>
                <textarea
                  className="mt-1 min-h-[88px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-500">Assign to *</label>
                {allowDepartmentHandoff ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignMode("people")}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        assignMode === "people"
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]"
                          : "border-[var(--border)] text-neutral-600"
                      }`}
                    >
                      Specific people
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignMode("department")}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        assignMode === "department"
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]"
                          : "border-[var(--border)] text-neutral-600"
                      }`}
                    >
                      Whole department
                    </button>
                  </div>
                ) : null}
                {assignMode === "department" ? (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Department managers get the task first; they add the right teammates. Managers are users with the
                    Manager tag, direct reports, or a Manager role in that department.
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    Click names to add or remove. You can pick several people.
                  </p>
                )}
                {assignMode === "department" ? (
                  <div className="mt-2">
                    <label className="text-[11px] text-neutral-500">Department (from Settings → Departments)</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      value={handoffDepartment}
                      onChange={e => setHandoffDepartment(e.target.value)}
                      disabled={loadingHandoffDepts}
                    >
                      <option value="">Select department…</option>
                      {handoffDepartments.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {assignMode === "people" && selectedUsers.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedUsers.map(u => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[var(--text-primary)]"
                      >
                        {u.name}
                        <button
                          type="button"
                          onClick={() => removeAssignee(u.id)}
                          className="rounded-full p-0.5 text-neutral-500 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                          aria-label={`Remove ${u.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {assignMode === "people" ? (
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)]"
                    placeholder="Search people…"
                    value={assigneeSearch}
                    onChange={e => setAssigneeSearch(e.target.value)}
                  />
                </div>
                ) : null}
                {assignMode === "people" ? (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[var(--border)]/80 bg-[var(--bg-elevated)]/60">
                  {loadingUsers || directorySyncMutation.isPending ? (
                    <p className="p-3 text-xs text-neutral-500">
                      {directorySyncMutation.isPending
                        ? "Syncing people from Microsoft 365…"
                        : "Loading…"}
                    </p>
                  ) : filteredAssignable.length === 0 ? (
                    <p className="p-3 text-xs text-neutral-500">
                      {assigneeSearch.trim().length >= 2
                        ? "No matching people. If they exist in Microsoft 365, we try to sync them when you search."
                        : "No matching people."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--border)]/60" role="listbox" aria-multiselectable="true">
                      {filteredAssignable.map(u => {
                        const selected = selectedAssigneeIds.includes(u.id);
                        return (
                          <li key={u.id} role="option" aria-selected={selected}>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => toggleAssignee(u.id)}
                              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-surface)] ${
                                selected ? "bg-[var(--accent-primary)]/15 ring-2 ring-inset ring-[var(--accent-primary)]/40" : ""
                              }`}
                            >
                              <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                                {selected ? (
                                  <span className="text-[10px] font-bold text-[var(--accent-primary)]">✓</span>
                                ) : null}
                                {u.name}
                              </span>
                              <span className="flex shrink-0 items-center gap-1">
                                <RoleBadge roleName={u.role.name} />
                                {u.department ? (
                                  <span className="text-[10px] text-neutral-500">{u.department}</span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                ) : null}
              </div>

              <div>
                <p className="text-xs font-medium text-neutral-500">Priority *</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`rounded-xl border px-2 py-1 transition ${
                        priority === p
                          ? "border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30"
                          : "border-[var(--border)] opacity-80 hover:opacity-100"
                      }`}
                    >
                      <PriorityBadge priority={p} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p id="deadline-label" className="text-xs font-medium text-neutral-500">
                  Deadline *
                </p>
                <div className="mt-1 flex gap-2">
                  <input
                    type="date"
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={date}
                    onChange={e => {
                      setDate(e.target.value);
                      setTimeout(validateDeadline, 0);
                    }}
                    aria-describedby={deadlineError ? "deadline-err" : undefined}
                  />
                  <input
                    type="time"
                    className="w-36 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={time}
                    onChange={e => {
                      setTime(e.target.value);
                      setTimeout(validateDeadline, 0);
                    }}
                    aria-describedby={deadlineError ? "deadline-err" : undefined}
                  />
                </div>
                {deadlineError ? (
                  <p id="deadline-err" className="mt-1 text-xs text-red-600" role="alert">
                    {deadlineError}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                disabled={
                  mutation.isPending ||
                  !title.trim() ||
                  (assignMode === "people" ? selectedAssigneeIds.length === 0 : !handoffDepartment.trim())
                }
                onClick={() => {
                  if (!date || !time) {
                    setDeadlineError("Pick date and time");
                    return;
                  }
                  const local = new Date(`${date}T${time}:00`);
                  if (Number.isNaN(local.getTime())) {
                    setDeadlineError("Invalid date or time");
                    return;
                  }
                  if (local.getTime() < Date.now()) {
                    setDeadlineError("Deadline cannot be in the past");
                    return;
                  }
                  setDeadlineError("");
                  mutation.mutate();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Assign task
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
