import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "react-toastify";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileDown,
  Loader2,
  Paperclip,
  Pencil,
  Search,
  Trash2,
  UserRound,
  X,
  GitBranch,
  MessageSquare,
} from "lucide-react";
import {
  formatTaskCompletionDuration,
  hierarchyArtifactDownloadUrl,
  hierarchyTasksApi,
  isUserHierarchyAssignee,
  parseCompletionApprovedDuration,
  type AssignableUser,
  type DirectTaskStatus,
  type HierarchyTaskDetail,
  type TaskStatus,
} from "../../lib/hierarchyTasksApi";
import { hierarchyTaskKeys } from "../../lib/queryKeys";
import { getHierarchyErrorMessage } from "../../lib/hierarchyError";
import { isOrganizationMemberRole } from "../../lib/taskHierarchy";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";
import { RoleBadge } from "./RoleBadge";

const DIRECT_STATUS_FLOW: DirectTaskStatus[] = ["PENDING", "IN_PROGRESS", "ON_HOLD", "CANCELLED"];

type Props = {
  taskId: number | null;
  open: boolean;
  onClose: () => void;
  currentUserId: number;
  currentUserRole: string;
  onDeleted?: () => void;
};

export function TaskDetailDrawer({
  taskId,
  open,
  onClose,
  currentUserId,
  currentUserRole,
  onDeleted,
}: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [titleEdit, setTitleEdit] = useState("");
  const [descEdit, setDescEdit] = useState("");
  const [priorityEdit, setPriorityEdit] = useState<HierarchyTaskDetail["priority"]>("MEDIUM");
  const [dateEdit, setDateEdit] = useState("");
  const [timeEdit, setTimeEdit] = useState("");
  const [selectedDirectStatus, setSelectedDirectStatus] = useState<DirectTaskStatus | null>(null);
  const [statusChangeNote, setStatusChangeNote] = useState("");
  const [statusChangeFile, setStatusChangeFile] = useState<File | null>(null);
  const [recordNote, setRecordNote] = useState("");
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: task, isLoading } = useQuery({
    queryKey: taskId != null ? hierarchyTaskKeys.detail(taskId) : ["hierarchyTasks", "detail", "none"],
    queryFn: () => hierarchyTasksApi.get(taskId!),
    enabled: open && taskId != null,
  });

  useEffect(() => {
    if (task) {
      setTitleEdit(task.title);
      setDescEdit(task.description ?? "");
      setPriorityEdit(task.priority);
      const d = new Date(task.deadline);
      setDateEdit(format(d, "yyyy-MM-dd"));
      setTimeEdit(format(d, "HH:mm"));
      setSelectedDirectStatus(null);
      setStatusChangeNote("");
      setStatusChangeFile(null);
      setRecordNote("");
      setRecordFile(null);
      setCompletionNote("");
      setCompletionFile(null);
      setRejectReason("");
    }
  }, [task]);

  const isOrgMember = isOrganizationMemberRole(currentUserRole);
  const canEdit = Boolean(task && (task.assignedBy.id === currentUserId || isOrgMember));
  const assigneeWorkflowOpen = Boolean(
    task &&
      task.status !== "COMPLETED" &&
      task.status !== "CANCELLED" &&
      task.status !== "COMPLETION_PENDING_APPROVAL",
  );
  const usesTaskScopedAssignable = Boolean(
    task &&
      isUserHierarchyAssignee(task, currentUserId) &&
      task.assignedBy.id !== currentUserId &&
      !isOrgMember,
  );
  const canManageAssignees = Boolean(
    task &&
      assigneeWorkflowOpen &&
      (task.assignedBy.id === currentUserId || isOrgMember || isUserHierarchyAssignee(task, currentUserId)),
  );
  const canStatus = Boolean(
    task &&
      (isUserHierarchyAssignee(task, currentUserId) ||
        task.assignedBy.id === currentUserId ||
        isOrgMember),
  );
  const canComment = canStatus;

  const [assigneeIdsDraft, setAssigneeIdsDraft] = useState<number[]>([]);
  const [assigneeSearchEdit, setAssigneeSearchEdit] = useState("");

  const assigneeRowsKey = task
    ? (task.assignees.length ? task.assignees : task.assignedTo ? [task.assignedTo] : [])
        .map(a => a.id)
        .sort()
        .join(",")
    : "";

  useEffect(() => {
    if (!task) {
      return;
    }
    const rows = task.assignees.length ? task.assignees : task.assignedTo ? [task.assignedTo] : [];
    setAssigneeIdsDraft(rows.map(a => a.id));
    setAssigneeSearchEdit("");
  }, [task?.id, assigneeRowsKey]);

  const { data: assignableForEdit = [], isLoading: loadingAssignableEdit } = useQuery({
    queryKey: hierarchyTaskKeys.assignableUsers(usesTaskScopedAssignable && taskId != null ? taskId : undefined),
    queryFn: () =>
      usesTaskScopedAssignable && taskId != null
        ? hierarchyTasksApi.getAssignableUsers(taskId)
        : hierarchyTasksApi.getAssignableUsers(),
    enabled: open && taskId != null && canManageAssignees,
  });

  const mergedAssignableForEdit = useMemo(() => {
    if (!task) {
      return assignableForEdit;
    }
    const map = new Map<number, AssignableUser>(assignableForEdit.map(u => [u.id, u]));
    const rows = task.assignees.length ? task.assignees : task.assignedTo ? [task.assignedTo] : [];
    for (const a of rows) {
      if (!map.has(a.id)) {
        map.set(a.id, {
          id: a.id,
          name: a.name,
          email: a.email,
          department: a.department,
          role: { name: a.role.name },
        });
      }
    }
    return [...map.values()];
  }, [task, assignableForEdit]);

  const filteredAssignableEdit = useMemo(() => {
    const q = assigneeSearchEdit.trim().toLowerCase();
    if (!q) {
      return mergedAssignableForEdit;
    }
    return mergedAssignableForEdit.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.name.toLowerCase().includes(q) ||
        (u.department?.toLowerCase().includes(q) ?? false),
    );
  }, [mergedAssignableForEdit, assigneeSearchEdit]);

  const selectedAssignableUsers = useMemo(() => {
    const map = new Map(mergedAssignableForEdit.map(u => [u.id, u]));
    return assigneeIdsDraft.map(sid => map.get(sid)).filter(Boolean) as AssignableUser[];
  }, [mergedAssignableForEdit, assigneeIdsDraft]);

  const assigneesDraftDirty = useMemo(() => {
    if (!task) {
      return false;
    }
    const cur = (task.assignees.length ? task.assignees : task.assignedTo ? [task.assignedTo] : [])
      .map(a => a.id)
      .sort()
      .join(",");
    const dr = [...assigneeIdsDraft].sort().join(",");
    return cur !== dr;
  }, [task, assigneeIdsDraft]);

  const completionRequesterId = task?.completionRequest?.requestedBy.id;
  const canApproveCompletion = Boolean(
    task &&
      task.status === "COMPLETION_PENDING_APPROVAL" &&
      completionRequesterId != null &&
      completionRequesterId !== currentUserId &&
      canStatus,
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.lists() });
    if (taskId != null) {
      await queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.detail(taskId) });
    }
  };

  const applyDirectStatusMutation = useMutation({
    mutationFn: async ({
      target,
      file,
      note,
      fromStatus,
    }: {
      target: DirectTaskStatus;
      file: File | null;
      note: string;
      fromStatus: TaskStatus;
    }) => {
      const id = taskId!;
      let artifactId: number | undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", "STATUS_CHANGE");
        fd.append("statusFrom", fromStatus);
        fd.append("statusTo", target);
        if (note.trim()) {
          fd.append("note", note.trim());
        }
        const up = await hierarchyTasksApi.uploadArtifact(id, fd);
        artifactId = up.artifactId;
      }
      return hierarchyTasksApi.updateStatus(id, { status: target, artifactId });
    },
    onSuccess: async () => {
      toast.success("Status updated");
      setSelectedDirectStatus(null);
      setStatusChangeFile(null);
      setStatusChangeNote("");
      await invalidate();
    },
    onError: err => toast.error(getHierarchyErrorMessage(err)),
  });

  const addRecordFileMutation = useMutation({
    mutationFn: async ({ file, note }: { file: File; note: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "GENERAL");
      if (note.trim()) {
        fd.append("note", note.trim());
      }
      return hierarchyTasksApi.uploadArtifact(taskId!, fd);
    },
    onSuccess: async () => {
      toast.success("File added to task");
      setRecordFile(null);
      setRecordNote("");
      await invalidate();
    },
    onError: err => toast.error(getHierarchyErrorMessage(err)),
  });

  const requestCompletionMutation = useMutation({
    mutationFn: async ({ file, note }: { file: File; note: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      if (note.trim()) {
        fd.append("note", note.trim());
      }
      return hierarchyTasksApi.requestCompletion(taskId!, fd);
    },
    onSuccess: async () => {
      toast.success("Sent for completion approval");
      setCompletionFile(null);
      setCompletionNote("");
      await invalidate();
    },
    onError: err => toast.error(getHierarchyErrorMessage(err)),
  });

  const approveCompletionMutation = useMutation({
    mutationFn: () => hierarchyTasksApi.approveCompletion(taskId!),
    onSuccess: async () => {
      toast.success("Completion approved — task marked completed");
      await invalidate();
    },
    onError: err => toast.error(getHierarchyErrorMessage(err)),
  });

  const rejectCompletionMutation = useMutation({
    mutationFn: () => hierarchyTasksApi.rejectCompletion(taskId!, rejectReason.trim() || undefined),
    onSuccess: async () => {
      toast.success("Completion rejected — task returned to in progress");
      setRejectReason("");
      await invalidate();
    },
    onError: err => toast.error(getHierarchyErrorMessage(err)),
  });

  const updateAssigneesMutation = useMutation({
    mutationFn: () => hierarchyTasksApi.update(taskId!, { assignedToIds: assigneeIdsDraft }),
    onSuccess: async () => {
      toast.success(usesTaskScopedAssignable ? "Transfer saved" : "Assignees updated");
      await invalidate();
    },
    onError: err => toast.error(getHierarchyErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const local = new Date(`${dateEdit}T${timeEdit}:00`);
      return hierarchyTasksApi.update(taskId!, {
        title: titleEdit.trim(),
        description: descEdit,
        priority: priorityEdit,
        deadline: local.toISOString(),
      });
    },
    onSuccess: async () => {
      toast.success("Task updated");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: hierarchyTaskKeys.detail(taskId!) });
      await invalidate();
    },
    onError: err => toast.error(getHierarchyErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => hierarchyTasksApi.delete(taskId!),
    onSuccess: async () => {
      toast.success("Task deleted");
      await invalidate();
      onDeleted?.();
      onClose();
    },
    onError: err => toast.error(getHierarchyErrorMessage(err)),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => hierarchyTasksApi.addComment(taskId!, content),
    onSuccess: async () => {
      await invalidate();
    },
    onError: err => toast.error(getHierarchyErrorMessage(err)),
  });

  const [commentText, setCommentText] = useState("");

  const deadlineMs = task ? new Date(task.deadline).getTime() : 0;
  const now = Date.now();
  const terminalForDue = (s: TaskStatus) => s === "COMPLETED" || s === "CANCELLED";
  const overdue = task && !terminalForDue(task.status) && deadlineMs < now;
  const dueSoon3h =
    task &&
    !overdue &&
    deadlineMs - now > 0 &&
    deadlineMs - now <= 3 * 60 * 60 * 1000 &&
    !terminalForDue(task.status);

  const statusWorkflowOpen =
    task &&
    task.status !== "COMPLETED" &&
    task.status !== "CANCELLED" &&
    task.status !== "COMPLETION_PENDING_APPROVAL";

  const effectiveTarget = selectedDirectStatus ?? (task && DIRECT_STATUS_FLOW.includes(task.status as DirectTaskStatus) ? (task.status as DirectTaskStatus) : null);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close drawer overlay"
            className="fixed inset-0 z-[70] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-[75] flex h-full w-full max-w-[480px] flex-col border-l border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)]/80 p-4">
              <div className="min-w-0 flex-1">
                {editing && canEdit ? (
                  <input
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-base font-semibold text-[var(--text-primary)]"
                    value={titleEdit}
                    onChange={e => setTitleEdit(e.target.value)}
                  />
                ) : (
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">{task?.title ?? "…"}</h2>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {task ? <PriorityBadge priority={task.priority} /> : null}
                  {task ? <StatusBadge status={task.status} /> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-neutral-500 hover:bg-[var(--bg-elevated)]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoading || !task ? (
                <div className="space-y-3">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-24 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
                </div>
              ) : (
                <>
                  {task.assignmentMode === "DEPARTMENT_HANDOFF" ? (
                    <div className="mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100">
                      <p className="font-semibold text-[var(--text-primary)]">Department handoff</p>
                      <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                        Routed to the <strong>{task.handoffTargetDepartment ?? task.department ?? "department"}</strong>{" "}
                        department. Managers on this task should add the right people; new assignees must stay in that
                        department.
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-3 rounded-xl border border-[var(--border)]/80 bg-[var(--bg-elevated)]/50 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-neutral-500" />
                      <span className="text-neutral-500">Assigned by</span>
                      <span className="font-medium text-[var(--text-primary)]">{task.assignedBy.name}</span>
                      <RoleBadge roleName={task.assignedBy.role.name} />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-start sm:gap-2">
                      <div className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 shrink-0 text-neutral-500" />
                        <span className="text-neutral-500">Assigned to</span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {(task.assignees.length ? task.assignees : task.assignedTo ? [task.assignedTo] : []).map(
                          a => (
                            <div key={a.id} className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)]">{a.name}</span>
                              <RoleBadge roleName={a.role.name} />
                              {a.department ? (
                                <span className="text-xs text-neutral-500">· {a.department}</span>
                              ) : null}
                            </div>
                          ),
                        )}
                        {task.assignees.length === 0 && !task.assignedTo ? (
                          <span className="text-sm text-neutral-500">—</span>
                        ) : null}
                      </div>
                      {task.department ? (
                        <span className="text-xs text-neutral-500 sm:ml-auto">Dept: {task.department}</span>
                      ) : null}
                    </div>
                    {canManageAssignees ? (
                      <div className="border-t border-[var(--border)]/60 pt-3">
                        <p className="text-xs font-medium text-neutral-500">
                          {usesTaskScopedAssignable ? "Transfer task" : "Add or remove assignees"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {usesTaskScopedAssignable
                            ? task.assignmentMode === "DEPARTMENT_HANDOFF"
                              ? "Search and pick one or more people in the handoff department. Who can be chosen matches what the assigner could pick."
                              : "Search and pick one or more teammates. Choices follow the same rules as when this task was assigned."
                            : task.assignmentMode === "DEPARTMENT_HANDOFF"
                              ? "Add people only from the handoff department (same scope as this task)."
                              : "Same rules as new tasks: your role and department apply."}
                        </p>
                        {selectedAssignableUsers.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {selectedAssignableUsers.map(u => (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[var(--text-primary)]"
                              >
                                {u.name}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAssigneeIdsDraft(prev => (prev.length <= 1 ? prev : prev.filter(x => x !== u.id)))
                                  }
                                  className="rounded-full p-0.5 text-neutral-500 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                                  aria-label={`Remove ${u.name}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="relative mt-2">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                          <input
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)]"
                            placeholder="Search people…"
                            value={assigneeSearchEdit}
                            onChange={e => setAssigneeSearchEdit(e.target.value)}
                          />
                        </div>
                        <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-[var(--border)]/80 bg-[var(--bg-elevated)]/60">
                          {loadingAssignableEdit ? (
                            <p className="p-2 text-xs text-neutral-500">Loading…</p>
                          ) : filteredAssignableEdit.length === 0 ? (
                            <p className="p-2 text-xs text-neutral-500">No matching people.</p>
                          ) : (
                            <ul className="divide-y divide-[var(--border)]/60" role="listbox">
                              {filteredAssignableEdit.map(u => {
                                const selected = assigneeIdsDraft.includes(u.id);
                                return (
                                  <li key={u.id} role="option" aria-selected={selected}>
                                    <button
                                      type="button"
                                      onMouseDown={e => e.preventDefault()}
                                      onClick={() =>
                                        setAssigneeIdsDraft(prev => {
                                          if (selected) {
                                            if (prev.length <= 1) {
                                              return prev;
                                            }
                                            return prev.filter(x => x !== u.id);
                                          }
                                          return [...prev, u.id];
                                        })
                                      }
                                      className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-[var(--bg-surface)] ${
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
                        <button
                          type="button"
                          disabled={
                            updateAssigneesMutation.isPending ||
                            !assigneesDraftDirty ||
                            assigneeIdsDraft.length === 0
                          }
                          onClick={() => updateAssigneesMutation.mutate()}
                          className="mt-2 w-full rounded-lg bg-[var(--accent-primary)] py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {updateAssigneesMutation.isPending ? (
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          ) : usesTaskScopedAssignable ? (
                            "Save transfer"
                          ) : (
                            "Save assignees"
                          )}
                        </button>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-neutral-500" />
                      <span className={overdue ? "font-medium text-red-600" : dueSoon3h ? "font-medium text-amber-600" : ""}>
                        {format(new Date(task.deadline), "PPp")}
                      </span>
                      {overdue ? <span className="text-xs text-red-600">Overdue</span> : null}
                    </div>
                    <p className="text-xs text-neutral-500">Created {format(new Date(task.createdAt), "PPp")}</p>
                  </div>

                  {task.status === "COMPLETION_PENDING_APPROVAL" && task.completionRequest ? (
                    <div className="mt-6 rounded-xl border border-violet-500/35 bg-violet-500/10 p-3 text-sm">
                      <p className="font-semibold text-[var(--text-primary)]">Completion approval pending</p>
                      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                        Submitted by {task.completionRequest.requestedBy.name}{" "}
                        {formatDistanceToNow(new Date(task.completionRequest.requestedAt), { addSuffix: true })}.
                        Another assignee or the task creator must review the proof and approve.
                      </p>
                      {task.completionRequest.artifact ? (
                        <a
                          href={hierarchyArtifactDownloadUrl(task.id, task.completionRequest.artifact.id)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          Download completion proof
                        </a>
                      ) : null}
                      {canApproveCompletion ? (
                        <div className="mt-4 space-y-2 border-t border-violet-500/20 pt-3">
                          <button
                            type="button"
                            disabled={approveCompletionMutation.isPending}
                            onClick={() => approveCompletionMutation.mutate()}
                            className="w-full rounded-lg bg-[var(--accent-primary)] py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {approveCompletionMutation.isPending ? (
                              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                            ) : (
                              "Approve completion"
                            )}
                          </button>
                          <textarea
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs"
                            placeholder="Reason if rejecting (optional)"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            rows={2}
                          />
                          <button
                            type="button"
                            disabled={rejectCompletionMutation.isPending}
                            onClick={() => rejectCompletionMutation.mutate()}
                            className="w-full rounded-lg border border-red-500/40 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
                          >
                            {rejectCompletionMutation.isPending ? (
                              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                            ) : (
                              "Reject & return to in progress"
                            )}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {canStatus && statusWorkflowOpen ? (
                    <div className="mt-6 space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Change status</p>
                        <p className="mb-2 text-[11px] text-neutral-500">
                          Pick a status, optionally attach a file, then apply. Completed is only available after approval.
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {DIRECT_STATUS_FLOW.map((s, i) => {
                            const active = effectiveTarget === s;
                            return (
                              <div key={s} className="flex items-center">
                                {i > 0 ? <div className="mx-0.5 h-px w-3 bg-[var(--border)]" /> : null}
                                <button
                                  type="button"
                                  disabled={applyDirectStatusMutation.isPending}
                                  onClick={() => setSelectedDirectStatus(s)}
                                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase transition ${
                                    active
                                      ? "bg-[var(--accent-primary)] text-white"
                                      : "bg-[var(--bg-elevated)] text-neutral-600 hover:bg-[var(--border)]/40"
                                  }`}
                                >
                                  {active ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                                  {s.replaceAll("_", " ")}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {selectedDirectStatus != null && selectedDirectStatus !== task.status ? (
                        <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-elevated)]/40 p-3 text-sm">
                          <p className="text-xs font-medium text-neutral-600">
                            Move to <strong>{selectedDirectStatus.replaceAll("_", " ")}</strong>
                          </p>
                          <label className="mt-2 block text-[11px] text-neutral-500">Attach file (optional)</label>
                          <input
                            type="file"
                            className="mt-1 block w-full text-xs"
                            onChange={e => setStatusChangeFile(e.target.files?.[0] ?? null)}
                          />
                          <label className="mt-2 block text-[11px] text-neutral-500">Note (optional)</label>
                          <input
                            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
                            value={statusChangeNote}
                            onChange={e => setStatusChangeNote(e.target.value)}
                            placeholder="Context for this change…"
                          />
                          <button
                            type="button"
                            disabled={applyDirectStatusMutation.isPending}
                            onClick={() => {
                              if (selectedDirectStatus === "CANCELLED" && !window.confirm("Mark this task as cancelled?")) {
                                return;
                              }
                              applyDirectStatusMutation.mutate({
                                target: selectedDirectStatus,
                                file: statusChangeFile,
                                note: statusChangeNote,
                                fromStatus: task.status,
                              });
                            }}
                            className="mt-3 w-full rounded-lg bg-[var(--accent-primary)] py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {applyDirectStatusMutation.isPending ? (
                              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                            ) : (
                              "Apply status change"
                            )}
                          </button>
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--bg-elevated)]/40 p-3 text-sm">
                        <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                          <Paperclip className="h-3.5 w-3.5" />
                          Add file to task record
                        </p>
                        <p className="mt-1 text-[11px] text-neutral-500">
                          Store evidence or updates without changing status.
                        </p>
                        <input
                          type="file"
                          className="mt-2 block w-full text-xs"
                          onChange={e => setRecordFile(e.target.files?.[0] ?? null)}
                        />
                        <input
                          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
                          value={recordNote}
                          onChange={e => setRecordNote(e.target.value)}
                          placeholder="Optional note…"
                        />
                        <button
                          type="button"
                          disabled={addRecordFileMutation.isPending || !recordFile}
                          onClick={() => recordFile && addRecordFileMutation.mutate({ file: recordFile, note: recordNote })}
                          className="mt-2 w-full rounded-lg border border-[var(--border)] py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          {addRecordFileMutation.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Upload"}
                        </button>
                      </div>

                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Mark complete (approval required)</p>
                        <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400">
                          Upload proof of work. Assignees or the task creator (other than you) must approve before the task
                          shows as completed.
                        </p>
                        <input
                          type="file"
                          className="mt-2 block w-full text-xs"
                          onChange={e => setCompletionFile(e.target.files?.[0] ?? null)}
                        />
                        <input
                          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
                          value={completionNote}
                          onChange={e => setCompletionNote(e.target.value)}
                          placeholder="Optional note for reviewers…"
                        />
                        <button
                          type="button"
                          disabled={requestCompletionMutation.isPending || !completionFile}
                          onClick={() => completionFile && requestCompletionMutation.mutate({ file: completionFile, note: completionNote })}
                          className="mt-2 w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {requestCompletionMutation.isPending ? (
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          ) : (
                            "Submit for completion approval"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {(task.artifacts ?? []).length > 0 ? (
                    <div className="mt-6">
                      <p className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
                        <Paperclip className="h-4 w-4" />
                        Artefacts
                      </p>
                      <ul className="space-y-2">
                        {(task.artifacts ?? []).map(a => (
                          <li
                            key={a.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)]/60 px-2 py-2 text-xs"
                          >
                            <div>
                              <p className="font-medium text-[var(--text-primary)]">{a.fileName}</p>
                              <p className="text-neutral-500">
                                {a.kind.replaceAll("_", " ")} · {a.uploadedBy.name} ·{" "}
                                {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                              </p>
                              {a.note ? <p className="mt-0.5 text-neutral-600">{a.note}</p> : null}
                            </div>
                            <a
                              href={hierarchyArtifactDownloadUrl(task.id, a.id)}
                              className="inline-flex shrink-0 items-center gap-1 text-[var(--accent-primary)] hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                              Open
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {canEdit && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!editing ? (
                        <button
                          type="button"
                          onClick={() => setEditing(true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => updateMutation.mutate()}
                            disabled={updateMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-sm text-white"
                          >
                            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(false);
                              setTitleEdit(task.title);
                              setDescEdit(task.description ?? "");
                              setPriorityEdit(task.priority);
                              const d = new Date(task.deadline);
                              setDateEdit(format(d, "yyyy-MM-dd"));
                              setTimeEdit(format(d, "HH:mm"));
                            }}
                            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Delete this task permanently?")) {
                            deleteMutation.mutate();
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}

                  {editing && canEdit && (
                    <div className="mt-4 space-y-3 rounded-xl border border-[var(--border)]/80 p-3">
                      <div>
                        <label className="text-xs text-neutral-500">Description</label>
                        <textarea
                          className="mt-1 min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-sm"
                          value={descEdit}
                          onChange={e => setDescEdit(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-sm"
                          value={priorityEdit}
                          onChange={e => setPriorityEdit(e.target.value as HierarchyTaskDetail["priority"])}
                        >
                          {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map(p => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-sm"
                          value={dateEdit}
                          onChange={e => setDateEdit(e.target.value)}
                        />
                        <input
                          type="time"
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-sm"
                          value={timeEdit}
                          onChange={e => setTimeEdit(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Description</p>
                    <p className="whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
                      {task.description?.trim() ? task.description : "No description."}
                    </p>
                  </div>

                  <div className="mt-6">
                    <p className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
                      <GitBranch className="h-4 w-4" />
                      Activity
                    </p>
                    <ul className="space-y-2">
                      {task.activities.map(a => {
                        const completionInfo = parseCompletionApprovedDuration(
                          a.action,
                          a.meta,
                          a.createdAt,
                          task.createdAt,
                        );
                        return (
                          <li key={a.id} className="flex gap-2 text-xs text-neutral-600">
                            <span className="mt-0.5 text-neutral-400">{a.action.replaceAll("_", " ")}</span>
                            <span className="flex-1">
                              <span className="font-medium text-[var(--text-primary)]">{a.user.name}</span>
                              <span className="text-neutral-400">
                                {" "}
                                · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                              </span>
                              {completionInfo ? (
                                <span className="mt-0.5 block font-medium text-neutral-600 dark:text-neutral-400">
                                  Completed in {formatTaskCompletionDuration(completionInfo.durationMs)} from{" "}
                                  {completionInfo.baselineLabel}.
                                </span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="mt-6">
                    <p className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
                      <MessageSquare className="h-4 w-4" />
                      Comments
                    </p>
                    <ul className="max-h-48 space-y-3 overflow-y-auto">
                      {task.comments.map(c => (
                        <li key={c.id} className="rounded-lg border border-[var(--border)]/60 p-2 text-sm">
                          <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                            <span className="font-medium text-[var(--text-primary)]">{c.user.name}</span>
                            <span>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                          </div>
                          <p className="mt-1 text-neutral-700 dark:text-neutral-300">{c.content}</p>
                        </li>
                      ))}
                    </ul>
                    {canComment && (
                      <div className="mt-3 flex gap-2">
                        <input
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-2 text-sm"
                          placeholder="Write a comment…"
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              const t = commentText.trim();
                              if (t) {
                                commentMutation.mutate(t);
                                setCommentText("");
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={!commentText.trim() || commentMutation.isPending}
                          onClick={() => {
                            const t = commentText.trim();
                            if (t) {
                              commentMutation.mutate(t);
                              setCommentText("");
                            }
                          }}
                          className="rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-sm text-white disabled:opacity-50"
                        >
                          {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
