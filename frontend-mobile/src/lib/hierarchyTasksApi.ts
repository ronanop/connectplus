import { api } from "./api";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETION_PENDING_APPROVAL"
  | "COMPLETED"
  | "CANCELLED";

export type DirectTaskStatus = Exclude<TaskStatus, "COMPLETED" | "COMPLETION_PENDING_APPROVAL">;

export type HierarchyTaskAssignmentMode = "DIRECT" | "DEPARTMENT_HANDOFF";

export interface HierarchyPerson {
  id: number;
  name: string;
  email: string;
  department?: string | null;
  role: { name: string };
}

export interface HierarchyTaskListItem {
  id: number;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string;
  department?: string | null;
  assignmentMode?: HierarchyTaskAssignmentMode;
  handoffTargetDepartment?: string | null;
  assignedBy: HierarchyPerson;
  assignees: HierarchyPerson[];
  assignedTo: HierarchyPerson | null;
  createdAt: string;
  updatedAt: string;
}

export function isUserHierarchyAssignee(task: Pick<HierarchyTaskListItem, "assignees">, userId: number): boolean {
  return task.assignees.some(a => a.id === userId);
}

export function formatHierarchyAssigneeNames(task: HierarchyTaskListItem): string {
  if (task.assignees.length === 0) {
    return "—";
  }
  if (task.assignees.length <= 2) {
    return task.assignees.map(a => a.name).join(", ");
  }
  return `${task.assignees[0].name} +${task.assignees.length - 1} others`;
}

export interface HierarchyTaskComment {
  id: number;
  content: string;
  createdAt: string;
  user: { id: number; name: string; email?: string };
}

export interface HierarchyTaskActivity {
  id: number;
  action: string;
  meta: unknown;
  createdAt: string;
  user: { name: string };
}

export interface HierarchyTaskArtifact {
  id: number;
  kind: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  statusFrom: string | null;
  statusTo: string | null;
  createdAt: string;
  uploadedBy: { id: number; name: string };
  downloadPath: string;
}

export interface HierarchyTaskCompletionRequest {
  requestedAt: string;
  requestedBy: { id: number; name: string };
  artifact: HierarchyTaskArtifact | null;
}

export interface HierarchyTaskDetail extends HierarchyTaskListItem {
  artifacts: HierarchyTaskArtifact[];
  completionRequest: HierarchyTaskCompletionRequest | null;
  comments: HierarchyTaskComment[];
  activities: HierarchyTaskActivity[];
}

export interface AssignableUser {
  id: number;
  name: string;
  email: string;
  department?: string | null;
  role: { name: string };
}

type ApiEnvelope<T> = { success: boolean; data: T; message?: string; error?: string };

function coercePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

export function parseCompletionApprovedDuration(
  action: string,
  meta: unknown,
  approvalActivityCreatedAt: string,
  taskCreatedAt: string,
): { durationMs: number; baselineLabel: string } | null {
  if (action !== "COMPLETION_APPROVED") {
    return null;
  }
  const m =
    meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null;
  const primary = coercePositiveNumber(m?.durationMsToComplete);
  const legacy = coercePositiveNumber(m?.durationMsFromCreated);
  const fallbackMs = Math.max(
    0,
    new Date(approvalActivityCreatedAt).getTime() - new Date(taskCreatedAt).getTime(),
  );
  const durationMs = primary ?? legacy ?? fallbackMs;
  const baselineUsed = m?.completionBaselineUsed;
  const baselineLabel =
    baselineUsed === "first_assignee_activity"
      ? "assignee’s first activity on this task"
      : "assignees were assigned this task";
  return { durationMs, baselineLabel };
}

export function formatTaskCompletionDuration(durationMs: number): string {
  let sec = Math.round(Math.max(0, durationMs) / 1000);
  const days = Math.floor(sec / 86400);
  sec -= days * 86400;
  const hours = Math.floor(sec / 3600);
  sec -= hours * 3600;
  const minutes = Math.floor(sec / 60);
  sec -= minutes * 60;
  const parts: string[] = [];
  if (days) {
    parts.push(`${days} day${days === 1 ? "" : "s"}`);
  }
  if (hours) {
    parts.push(`${hours} hr`);
  }
  if (minutes) {
    parts.push(`${minutes} min`);
  }
  if (parts.length === 0 && sec) {
    parts.push(`${sec} sec`);
  }
  if (parts.length === 0) {
    return "under 1 sec";
  }
  return parts.join(", ");
}

export function hierarchyArtifactDownloadUrl(taskId: number, artifactId: number): string {
  const base = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL?.replace(/\/+$/, "") ?? "";
  const path = `/api/hierarchy-tasks/${taskId}/artifacts/${artifactId}/file`;
  return base ? `${base}${path}` : path;
}

export const hierarchyTasksApi = {
  async getAssignableUsers(taskId?: number): Promise<AssignableUser[]> {
    const res = await api.get<ApiEnvelope<{ users: AssignableUser[] }>>("/api/hierarchy-tasks/assignable-users", {
      params: taskId != null ? { taskId: String(taskId) } : undefined,
    });
    return res.data.data.users;
  },

  async listHandoffDepartments(): Promise<string[]> {
    const res = await api.get<ApiEnvelope<{ departments: string[] }>>("/api/hierarchy-tasks/handoff-departments");
    return res.data.data.departments;
  },

  async list(params?: Record<string, string | undefined>): Promise<HierarchyTaskListItem[]> {
    const clean = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")) : {};
    const res = await api.get<ApiEnvelope<{ tasks: HierarchyTaskListItem[] }>>("/api/hierarchy-tasks", {
      params: clean,
    });
    return res.data.data.tasks;
  },

  async get(id: number): Promise<HierarchyTaskDetail> {
    const res = await api.get<ApiEnvelope<{ task: HierarchyTaskDetail }>>(`/api/hierarchy-tasks/${id}`);
    return res.data.data.task;
  },

  async create(data: {
    title: string;
    description?: string;
    priority: TaskPriority;
    deadline: string;
    assignedToIds?: number[];
    assignToDepartment?: string;
  }): Promise<HierarchyTaskDetail> {
    const res = await api.post<ApiEnvelope<{ task: HierarchyTaskDetail }>>("/api/hierarchy-tasks", data);
    return res.data.data.task;
  },

  async update(
    id: number,
    data: Partial<{
      title: string;
      description: string;
      priority: TaskPriority;
      deadline: string;
      assignedToIds: number[];
    }>,
  ): Promise<HierarchyTaskDetail> {
    const res = await api.patch<ApiEnvelope<{ task: HierarchyTaskDetail }>>(`/api/hierarchy-tasks/${id}`, data);
    return res.data.data.task;
  },

  async updateStatus(
    id: number,
    body: { status: DirectTaskStatus; artifactId?: number },
  ): Promise<HierarchyTaskDetail> {
    const res = await api.patch<ApiEnvelope<{ task: HierarchyTaskDetail }>>(`/api/hierarchy-tasks/${id}/status`, body);
    return res.data.data.task;
  },

  async uploadArtifact(
    taskId: number,
    form: FormData,
  ): Promise<{ task: HierarchyTaskDetail; artifactId: number }> {
    const res = await api.post<ApiEnvelope<{ task: HierarchyTaskDetail; artifactId: number }>>(
      `/api/hierarchy-tasks/${taskId}/artifacts`,
      form,
    );
    return res.data.data;
  },

  async requestCompletion(taskId: number, form: FormData): Promise<HierarchyTaskDetail> {
    const res = await api.post<ApiEnvelope<{ task: HierarchyTaskDetail }>>(
      `/api/hierarchy-tasks/${taskId}/request-completion`,
      form,
    );
    return res.data.data.task;
  },

  async approveCompletion(taskId: number): Promise<HierarchyTaskDetail> {
    const res = await api.post<ApiEnvelope<{ task: HierarchyTaskDetail }>>(
      `/api/hierarchy-tasks/${taskId}/approve-completion`,
    );
    return res.data.data.task;
  },

  async rejectCompletion(taskId: number, reason?: string): Promise<HierarchyTaskDetail> {
    const res = await api.post<ApiEnvelope<{ task: HierarchyTaskDetail }>>(
      `/api/hierarchy-tasks/${taskId}/reject-completion`,
      { reason },
    );
    return res.data.data.task;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/hierarchy-tasks/${id}`);
  },

  async addComment(id: number, content: string): Promise<HierarchyTaskDetail> {
    const res = await api.post<ApiEnvelope<{ task: HierarchyTaskDetail }>>(`/api/hierarchy-tasks/${id}/comments`, {
      content,
    });
    return res.data.data.task;
  },

  async syncDirectoryFromMicrosoft(query?: string): Promise<{
    graphConfigured: boolean;
    created: number;
    updated: number;
    matchedDirectory: number;
  }> {
    const res = await api.post<
      ApiEnvelope<{
        graphConfigured: boolean;
        created: number;
        updated: number;
        matchedDirectory: number;
      }>
    >("/api/hierarchy-tasks/directory-sync", { query: query?.trim() || undefined });
    return res.data.data;
  },
};
