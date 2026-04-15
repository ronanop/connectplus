import fs from "fs";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import { normalizeDepartmentName } from "../../middleware/departmentAccess";
import {
  canAssignTo,
  effectiveHierarchyRole,
  getAssignableRoles,
  HIERARCHY_LEVELS,
  isOrganizationMemberRole,
} from "../../lib/taskHierarchy";
import {
  HierarchyTaskAssignmentMode,
  HierarchyTaskPriority,
  HierarchyTaskStatus,
  Prisma,
} from "../../generated/prisma";
import { fetchGraphUsersForEmailDomain, upsertGraphUsersForOrganization } from "../../lib/graphDirectorySync";
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "./validators";
import { absolutePathFromStored, toStoredPath } from "./upload";
import {
  hierarchyTaskRecipientUserIds,
  notifyHierarchyTaskUsers,
} from "../../lib/hierarchyTaskNotifications";
import { tagsFromJson } from "../../lib/tagsFromJson";

const userRoleSelect = {
  id: true,
  name: true,
  email: true,
  department: true,
  organizationId: true,
  tagsJson: true,
  role: { select: { name: true } },
  hrEmployeeProfile: {
    select: {
      hrDepartment: { select: { name: true } },
    },
  },
} as const;

type UserRowForHierarchy = Prisma.UserGetPayload<{ select: typeof userRoleSelect }>;

/** CRM `department` string, else HR org unit, else `dept:…` tag from directory sync. */
function effectiveDepartmentRaw(u: UserRowForHierarchy): string | null {
  const d = u.department?.trim();
  if (d) {
    return d;
  }
  const hr = u.hrEmployeeProfile?.hrDepartment?.name?.trim();
  if (hr) {
    return hr;
  }
  for (const t of tagsFromJson(u.tagsJson)) {
    if (/^dept:/i.test(t)) {
      const rest = t.replace(/^dept:\s*/i, "").trim();
      if (rest) {
        return rest;
      }
    }
  }
  return null;
}
const artifactUserSelect = { id: true, name: true } as const;

const assigneeUserSelect = {
  id: true,
  name: true,
  email: true,
  department: true,
  role: { select: { name: true } },
} as const;

const taskListInclude = {
  assignedBy: { select: { id: true, name: true, email: true, role: { select: { name: true } } } },
  assignees: {
    orderBy: { id: "asc" as const },
    include: { user: { select: assigneeUserSelect } },
  },
} as const;

const taskDetailInclude = {
  ...taskListInclude,
  completionRequestedBy: { select: artifactUserSelect },
  completionArtifact: {
    include: { uploadedBy: { select: artifactUserSelect } },
  },
  artifacts: {
    orderBy: { createdAt: "desc" as const },
    take: 80,
    include: { uploadedBy: { select: artifactUserSelect } },
  },
  comments: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  activities: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 100,
  },
} as const;

type TaskListRow = Prisma.HierarchyTaskGetPayload<{ include: typeof taskListInclude }>;
type TaskDetailRow = Prisma.HierarchyTaskGetPayload<{ include: typeof taskDetailInclude }>;

type ArtifactRow = TaskDetailRow["artifacts"][number];

function serializeArtifactRow(a: ArtifactRow, taskId: number) {
  return {
    id: a.id,
    kind: a.kind,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    note: a.note,
    statusFrom: a.statusFrom,
    statusTo: a.statusTo,
    createdAt: a.createdAt.toISOString(),
    uploadedBy: a.uploadedBy,
    downloadPath: `/api/hierarchy-tasks/${taskId}/artifacts/${a.id}/file`,
  };
}

function mapAssigneeUsers(task: TaskListRow | TaskDetailRow) {
  return task.assignees.map(a => ({
    id: a.user.id,
    name: a.user.name,
    email: a.user.email,
    department: a.user.department ?? null,
    role: { name: a.user.role.name },
  }));
}

export function serializeHierarchyTaskList(task: TaskListRow) {
  const assignees = mapAssigneeUsers(task);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    deadline: task.deadline,
    department: task.department,
    assignmentMode: task.assignmentMode,
    handoffTargetDepartment: task.handoffTargetDepartment ?? null,
    assignedBy: {
      id: task.assignedBy.id,
      name: task.assignedBy.name,
      email: task.assignedBy.email,
      role: { name: task.assignedBy.role.name },
    },
    assignees,
    assignedTo: assignees[0] ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function serializeHierarchyTaskDetail(task: TaskDetailRow) {
  const base = serializeHierarchyTaskList(task);
  const artifacts = task.artifacts.map(a => serializeArtifactRow(a, task.id));
  const completionArtifact =
    task.completionArtifact && task.completionArtifact.uploadedBy
      ? serializeArtifactRow(task.completionArtifact as unknown as ArtifactRow, task.id)
      : null;
  const completionRequest =
    task.status === "COMPLETION_PENDING_APPROVAL" &&
    task.completionRequestedAt &&
    task.completionRequestedBy &&
    task.completionArtifactId
      ? {
          requestedAt: task.completionRequestedAt.toISOString(),
          requestedBy: { id: task.completionRequestedBy.id, name: task.completionRequestedBy.name },
          artifact: completionArtifact,
        }
      : null;
  return {
    ...base,
    artifacts,
    completionRequest,
    comments: task.comments.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      user: { id: c.user.id, name: c.user.name, email: c.user.email },
    })),
    activities: task.activities.map(a => ({
      id: a.id,
      action: a.action,
      meta: a.meta,
      createdAt: a.createdAt,
      user: { name: a.user.name },
    })),
  };
}

async function requireOrgUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, department: true, role: { select: { name: true } } },
  });
  if (!user?.organizationId) {
    throw new ApiError(400, "User has no organization; hierarchy tasks are unavailable");
  }
  return { organizationId: user.organizationId, user };
}

function parseStatusFilter(raw: string | undefined): HierarchyTaskStatus[] | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const allowed = new Set<string>(Object.values(HierarchyTaskStatus));
  const parts = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const out = parts.filter(s => allowed.has(s)) as HierarchyTaskStatus[];
  return out.length ? out : undefined;
}

function parsePriorityFilter(raw: string | undefined): HierarchyTaskPriority[] | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const allowed = new Set<string>(Object.values(HierarchyTaskPriority));
  const parts = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const out = parts.filter(s => allowed.has(s)) as HierarchyTaskPriority[];
  return out.length ? out : undefined;
}

function sortTasksByOverdueThenDeadline<T extends { deadline: Date; status: HierarchyTaskStatus }>(tasks: T[]): T[] {
  const now = Date.now();
  const isTerminal = (s: HierarchyTaskStatus) => s === "COMPLETED" || s === "CANCELLED";
  return [...tasks].sort((a, b) => {
    const aOver = !isTerminal(a.status) && new Date(a.deadline).getTime() < now;
    const bOver = !isTerminal(b.status) && new Date(b.deadline).getTime() < now;
    if (aOver !== bOver) {
      return aOver ? -1 : 1;
    }
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}

async function loadUserFull(userId: number) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: userRoleSelect,
  });
  if (!u) {
    throw new ApiError(404, "User not found");
  }
  return u;
}

function assertSameOrg(aOrg: number | null, bOrg: number | null) {
  if (aOrg == null || bOrg == null || aOrg !== bOrg) {
    throw new ApiError(400, "Assignee must belong to the same organization");
  }
}

function assertDepartmentIfNeeded(
  assignerRoleName: string,
  assignerDept: string | null | undefined,
  assigneeDept: string | null | undefined,
) {
  if (isOrganizationMemberRole(assignerRoleName)) {
    return;
  }
  const ad = normalizeDepartmentName(assignerDept);
  /** No department on assigner profile: do not block listing/assign; org + hierarchy rules still apply. */
  if (!ad) {
    return;
  }
  const ed = normalizeDepartmentName(assigneeDept);
  if (!ed || ad !== ed) {
    throw new ApiError(403, "You can only assign tasks within your department", "DEPARTMENT_MISMATCH");
  }
}

function assertCanAssign(assignerRoleName: string, assigneeRoleName: string) {
  if (!canAssignTo(assignerRoleName, assigneeRoleName)) {
    throw new ApiError(403, "You can only assign tasks to users below your level", "HIERARCHY_VIOLATION");
  }
}

async function validateAssigneesForAssigner(
  assigner: Awaited<ReturnType<typeof loadUserFull>>,
  assigneeUserIds: number[],
  handoff: { norm: string; label: string } | null = null,
) {
  const loaded = await Promise.all(assigneeUserIds.map(id => loadUserFull(id)));
  for (const assignee of loaded) {
    assertSameOrg(assigner.organizationId, assignee.organizationId);
    assertDepartmentIfNeeded(assigner.role.name, effectiveDepartmentRaw(assigner), effectiveDepartmentRaw(assignee));
    assertCanAssign(assigner.role.name, assignee.role.name);
    if (handoff?.norm) {
      const ad = normalizeDepartmentName(effectiveDepartmentRaw(assignee));
      if (!ad || ad !== handoff.norm) {
        throw new ApiError(
          403,
          `Everyone on this task must belong to the "${handoff.label}" department.`,
          "DEPARTMENT_MISMATCH",
        );
      }
    }
  }
}

async function resolveCanonicalMasterDepartmentName(trimmedInput: string): Promise<string> {
  const rows = await prisma.department.findMany({ select: { name: true } });
  const inputNorm = normalizeDepartmentName(trimmedInput);
  for (const r of rows) {
    if (normalizeDepartmentName(r.name) === inputNorm) {
      return r.name;
    }
  }
  throw new ApiError(
    400,
    `Unknown department "${trimmedInput}". Use a name from Settings → Departments (or the handoff list).`,
  );
}

async function resolveDepartmentManagerUserIds(organizationId: number, canonicalDeptName: string): Promise<number[]> {
  const targetNorm = normalizeDepartmentName(canonicalDeptName);
  const users = await prisma.user.findMany({
    where: { organizationId, isActive: true },
    select: {
      ...userRoleSelect,
      _count: { select: { directReports: true } },
    },
  });
  const managers: number[] = [];
  for (const u of users) {
    if (normalizeDepartmentName(effectiveDepartmentRaw(u)) !== targetNorm) {
      continue;
    }
    const tags = tagsFromJson(u.tagsJson);
    const tagManager = tags.some(t => t.trim().toLowerCase() === "manager");
    const hasReports = u._count.directReports > 0;
    const roleUpper = u.role.name.trim().toUpperCase();
    const roleManagerLike =
      roleUpper === "MANAGER" || roleUpper === "SENIOR_MANAGER" || roleUpper === "MANAGEMENT";
    if (tagManager || hasReports || roleManagerLike) {
      managers.push(u.id);
    }
  }
  return [...new Set(managers)];
}

export const hierarchyTasksService = {
  async listHandoffDepartmentsForRequester(requesterId: number) {
    const assigner = await loadUserFull(requesterId);
    if (!isOrganizationMemberRole(assigner.role.name)) {
      throw new ApiError(403, "Only organization members can assign tasks by department", "FORBIDDEN");
    }
    const rows = await prisma.department.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });
    return rows.map(r => r.name);
  },

  async createTask(assignerId: number, data: CreateTaskInput) {
    const assigner = await loadUserFull(assignerId);
    const deptHandoff = data.assignToDepartment?.trim();

    let uniqueIds: number[];
    let assignmentMode: HierarchyTaskAssignmentMode = HierarchyTaskAssignmentMode.DIRECT;
    let canonicalDept: string | null = null;

    if (deptHandoff) {
      if (!isOrganizationMemberRole(assigner.role.name)) {
        throw new ApiError(
          403,
          "Only organization-level roles can assign a task to a whole department",
          "FORBIDDEN",
        );
      }
      canonicalDept = await resolveCanonicalMasterDepartmentName(deptHandoff);
      uniqueIds = await resolveDepartmentManagerUserIds(assigner.organizationId!, canonicalDept);
      if (uniqueIds.length === 0) {
        throw new ApiError(
          400,
          `No department manager found for "${canonicalDept}". Mark at least one active user in that department with the Manager tag, give them direct reports, or use a Manager / Management role.`,
        );
      }
      assignmentMode = HierarchyTaskAssignmentMode.DEPARTMENT_HANDOFF;
    } else {
      uniqueIds = [...new Set(data.assignedToIds ?? [])];
      if (uniqueIds.length === 0) {
        throw new ApiError(400, "Assign at least one person");
      }
    }

    await validateAssigneesForAssigner(assigner, uniqueIds, null);

    const first = await loadUserFull(uniqueIds[0]);
    const deadline = new Date(data.deadline);
    const taskDept =
      assignmentMode === HierarchyTaskAssignmentMode.DEPARTMENT_HANDOFF && canonicalDept
        ? canonicalDept
        : first.department ?? null;

    const task = await prisma.hierarchyTask.create({
      data: {
        organizationId: assigner.organizationId!,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority as HierarchyTaskPriority,
        status: "PENDING",
        deadline,
        assignedById: assignerId,
        department: taskDept,
        assignmentMode,
        handoffTargetDepartment:
          assignmentMode === HierarchyTaskAssignmentMode.DEPARTMENT_HANDOFF ? canonicalDept : null,
        assignees: {
          create: uniqueIds.map(userId => ({ userId })),
        },
        activities: {
          create: {
            userId: assignerId,
            action: "TASK_CREATED",
            meta: {
              title: data.title,
              assigneeIds: uniqueIds,
              ...(assignmentMode === HierarchyTaskAssignmentMode.DEPARTMENT_HANDOFF
                ? { departmentHandoff: true, targetDepartment: canonicalDept }
                : {}),
            } as Prisma.InputJsonValue,
          },
        },
      },
      include: taskDetailInclude,
    });
    const newAssignees = uniqueIds.filter(id => id !== assignerId);
    if (newAssignees.length > 0) {
      const isHandoff = assignmentMode === HierarchyTaskAssignmentMode.DEPARTMENT_HANDOFF;
      await notifyHierarchyTaskUsers(newAssignees, {
        type: "hierarchy_task",
        title: isHandoff ? "Department task — assign your team" : "New task assigned",
        message: isHandoff
          ? `${assigner.name} assigned work to the ${canonicalDept} department: "${data.title}". Add the right people to this task.`
          : `${assigner.name} assigned you to "${data.title}".`,
        priority: "high",
        metadata: { hierarchyTaskId: task.id, activity: "TASK_CREATED" },
      });
    }
    return serializeHierarchyTaskDetail(task);
  },

  async listTasksForUser(userId: number, query: ListTasksQuery) {
    const { organizationId, user } = await requireOrgUser(userId);
    const assignerRoleName = user.role.name;

    if (query.scope === "all" && !isOrganizationMemberRole(assignerRoleName)) {
      throw new ApiError(403, "Only organization-level roles can view all tasks", "FORBIDDEN");
    }

    const statusIn = parseStatusFilter(query.status);
    const priorityIn = parsePriorityFilter(query.priority);

    const where: Prisma.HierarchyTaskWhereInput = {
      organizationId,
      ...(statusIn?.length ? { status: { in: statusIn } } : {}),
      ...(priorityIn?.length ? { priority: { in: priorityIn } } : {}),
      ...(query.department?.trim()
        ? { department: { equals: query.department, mode: "insensitive" } }
        : {}),
    };

    if (query.scope === "mine") {
      where.assignees = { some: { userId } };
    } else if (query.scope === "assigned_by_me") {
      where.assignedById = userId;
    } else {
      if (query.assignedToId != null) {
        where.assignees = { some: { userId: query.assignedToId } };
      }
      if (query.assignedById != null) {
        where.assignedById = query.assignedById;
      }
    }

    if (query.dueSoon) {
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000);
      where.deadline = { lte: end, gte: new Date() };
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      const searchClause: Prisma.HierarchyTaskWhereInput = {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { assignees: { some: { user: { name: { contains: q, mode: "insensitive" } } } } },
        ],
      };
      where.AND = Array.isArray(where.AND) ? [...where.AND, searchClause] : where.AND ? [where.AND, searchClause] : [searchClause];
    }

    const tasks = await prisma.hierarchyTask.findMany({
      where,
      include: taskListInclude,
    });

    return sortTasksByOverdueThenDeadline(tasks).map(serializeHierarchyTaskList);
  },

  async getTask(taskId: number, userId: number) {
    const { organizationId, user } = await requireOrgUser(userId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: taskDetailInclude,
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    const assigneeIds = task.assignees.map(a => a.userId);
    const canView =
      isOrganizationMemberRole(user.role.name) || task.assignedById === userId || assigneeIds.includes(userId);
    if (!canView) {
      throw new ApiError(403, "You cannot view this task", "FORBIDDEN");
    }
    return serializeHierarchyTaskDetail(task);
  },

  async updateTask(taskId: number, requesterId: number, data: UpdateTaskInput) {
    const { organizationId, user } = await requireOrgUser(requesterId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    const isOrgMember = isOrganizationMemberRole(user.role.name);
    const isAssigner = task.assignedById === requesterId;
    const isAssignee = task.assignees.some(a => a.userId === requesterId);
    const assigneesOnlyPatch =
      data.assignedToIds != null &&
      data.title === undefined &&
      data.description === undefined &&
      data.priority === undefined &&
      data.deadline === undefined;

    if (!isOrgMember && !isAssigner) {
      if (!(isAssignee && assigneesOnlyPatch)) {
        throw new ApiError(403, "Only the task creator can edit this task", "FORBIDDEN");
      }
    }

    const requester = await loadUserFull(requesterId);
    const isAssigneeOnlyTransfer =
      isAssignee && !isAssigner && !isOrgMember && assigneesOnlyPatch;
    const hierarchyValidator = isAssigneeOnlyTransfer
      ? await loadUserFull(task.assignedById)
      : requester;
    const meta: Record<string, unknown> = {};
    if (data.title != null && data.title !== task.title) {
      meta.title = { from: task.title, to: data.title };
    }
    if (data.description !== undefined && data.description !== task.description) {
      meta.description = true;
    }
    if (data.priority != null && data.priority !== task.priority) {
      meta.priority = { from: task.priority, to: data.priority };
    }
    if (data.deadline != null) {
      const nd = new Date(data.deadline).getTime();
      if (nd !== task.deadline.getTime()) {
        meta.deadline = { from: task.deadline.toISOString(), to: data.deadline };
      }
    }

    let department = task.department;
    if (data.assignedToIds != null) {
      const uniqueIds = [...new Set(data.assignedToIds)];
      if (uniqueIds.length === 0) {
        throw new ApiError(400, "Assign at least one person");
      }
      const handoffNormRaw = normalizeDepartmentName(task.handoffTargetDepartment ?? task.department);
      const handoffLabel = (task.handoffTargetDepartment ?? task.department ?? "").trim();
      const handoffConstraint =
        task.assignmentMode === HierarchyTaskAssignmentMode.DEPARTMENT_HANDOFF && handoffNormRaw
          ? { norm: handoffNormRaw, label: handoffLabel || "target" }
          : null;
      await validateAssigneesForAssigner(hierarchyValidator, uniqueIds, handoffConstraint);
      const prev = task.assignees.map(a => a.userId).sort().join(",");
      const next = uniqueIds.sort().join(",");
      if (prev !== next) {
        meta.assignedToIds = { from: task.assignees.map(a => a.userId), to: uniqueIds };
      }
      if (task.assignmentMode === HierarchyTaskAssignmentMode.DEPARTMENT_HANDOFF && task.handoffTargetDepartment) {
        department = task.handoffTargetDepartment;
      } else if (task.assignmentMode === HierarchyTaskAssignmentMode.DEPARTMENT_HANDOFF && task.department) {
        department = task.department;
      } else {
        const first = await loadUserFull(uniqueIds[0]);
        department = first.department ?? null;
      }
    }

    const updated = await prisma.$transaction(async tx => {
      if (data.assignedToIds != null) {
        const uniqueIds = [...new Set(data.assignedToIds)];
        await tx.hierarchyTaskAssignee.deleteMany({ where: { taskId } });
        await tx.hierarchyTaskAssignee.createMany({
          data: uniqueIds.map(uid => ({ taskId, userId: uid })),
        });
      }
      return tx.hierarchyTask.update({
        where: { id: taskId },
        data: {
          ...(data.title != null ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description ?? null } : {}),
          ...(data.priority != null ? { priority: data.priority as HierarchyTaskPriority } : {}),
          ...(data.deadline != null ? { deadline: new Date(data.deadline) } : {}),
          ...(data.assignedToIds != null ? { department } : {}),
          activities: {
            create: {
              userId: requesterId,
              action: "TASK_UPDATED",
              meta: Object.keys(meta).length ? (meta as Prisma.InputJsonValue) : undefined,
            },
          },
        },
        include: taskDetailInclude,
      });
    });
    const editor = await loadUserFull(requesterId);
    const updateRecipients = hierarchyTaskRecipientUserIds({
      assigneeUserIds: updated.assignees.map(a => a.userId),
      assignedById: updated.assignedById,
      actorUserId: requesterId,
    });
    if (updateRecipients.length > 0) {
      await notifyHierarchyTaskUsers(updateRecipients, {
        type: "hierarchy_task",
        title: "Task updated",
        message: `${editor.name} updated "${updated.title}".`,
        priority: "normal",
        metadata: { hierarchyTaskId: taskId, activity: "TASK_UPDATED" },
      });
    }
    return serializeHierarchyTaskDetail(updated);
  },

  async updateStatus(
    taskId: number,
    requesterId: number,
    body: { status: HierarchyTaskStatus; artifactId?: number },
  ) {
    const { status, artifactId } = body;
    if (status === "COMPLETED") {
      throw new ApiError(
        400,
        "Upload a completion proof and use “request completion” so an assignee can approve before the task is marked completed.",
        "COMPLETION_REQUIRES_APPROVAL",
      );
    }
    if (status === "COMPLETION_PENDING_APPROVAL") {
      throw new ApiError(400, "Use the completion request flow to enter this state.", "INVALID_STATUS");
    }

    const { organizationId, user } = await requireOrgUser(requesterId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    if (task.status === "COMPLETION_PENDING_APPROVAL") {
      throw new ApiError(
        400,
        "This task is waiting for completion approval. Approve or reject it first.",
        "COMPLETION_PENDING",
      );
    }
    const isOrgMember = isOrganizationMemberRole(user.role.name);
    const isAssigner = task.assignedById === requesterId;
    const isAssignee = task.assignees.some(a => a.userId === requesterId);
    if (!isAssignee && !isAssigner && !isOrgMember) {
      throw new ApiError(403, "You cannot change this task status", "FORBIDDEN");
    }

    if (artifactId != null) {
      const art = await prisma.hierarchyTaskArtifact.findFirst({
        where: { id: artifactId, taskId },
      });
      if (!art) {
        throw new ApiError(404, "Artifact not found on this task");
      }
      const canLink = art.uploadedById === requesterId || isOrgMember;
      if (!canLink) {
        throw new ApiError(403, "You cannot attach this file to a status change", "FORBIDDEN");
      }
      if (art.kind === "COMPLETION_PROOF") {
        throw new ApiError(400, "Completion proof is only used for the completion approval flow");
      }
      if (art.kind === "STATUS_CHANGE") {
        if (art.statusFrom !== task.status || art.statusTo !== status) {
          throw new ApiError(400, "This file was uploaded for a different status transition");
        }
      }
    }

    const from = task.status;
    const meta: Record<string, unknown> = { from, to: status };
    if (artifactId != null) {
      meta.artifactId = artifactId;
    }
    const updated = await prisma.hierarchyTask.update({
      where: { id: taskId },
      data: {
        status,
        activities: {
          create: {
            userId: requesterId,
            action: "STATUS_CHANGED",
            meta: meta as Prisma.InputJsonValue,
          },
        },
      },
      include: taskDetailInclude,
    });
    const actorStatus = await loadUserFull(requesterId);
    const statusRecipients = hierarchyTaskRecipientUserIds({
      assigneeUserIds: task.assignees.map(a => a.userId),
      assignedById: task.assignedById,
      actorUserId: requesterId,
    });
    if (statusRecipients.length > 0) {
      const fromLabel = String(from).replace(/_/g, " ");
      const toLabel = String(status).replace(/_/g, " ");
      await notifyHierarchyTaskUsers(statusRecipients, {
        type: "hierarchy_task",
        title: "Task status changed",
        message: `${actorStatus.name} changed status on "${task.title}": ${fromLabel} → ${toLabel}.`,
        priority: "normal",
        metadata: { hierarchyTaskId: taskId, activity: "STATUS_CHANGED" },
      });
    }
    return serializeHierarchyTaskDetail(updated);
  },

  async openArtifactFile(taskId: number, artifactId: number, userId: number) {
    const { organizationId, user } = await requireOrgUser(userId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    const isOrgMember = isOrganizationMemberRole(user.role.name);
    const participant =
      task.assignedById === userId || task.assignees.some(a => a.userId === userId) || isOrgMember;
    if (!participant) {
      throw new ApiError(403, "You cannot access this file", "FORBIDDEN");
    }
    const art = await prisma.hierarchyTaskArtifact.findFirst({
      where: { id: artifactId, taskId },
    });
    if (!art) {
      throw new ApiError(404, "File not found");
    }
    let abs: string;
    try {
      abs = absolutePathFromStored(art.storedPath);
    } catch {
      throw new ApiError(400, "Invalid stored path");
    }
    if (!fs.existsSync(abs)) {
      throw new ApiError(404, "File missing on server");
    }
    return { stream: fs.createReadStream(abs), fileName: art.fileName, mimeType: art.mimeType };
  },

  async addArtifact(
    taskId: number,
    requesterId: number,
    file: Express.Multer.File,
    input: { kind: string; note?: string | null; statusFrom?: string | null; statusTo?: string | null },
  ) {
    if (!file) {
      throw new ApiError(400, "File is required");
    }
    const allowedKinds = ["GENERAL", "STATUS_CHANGE"];
    if (!allowedKinds.includes(input.kind)) {
      throw new ApiError(400, "Invalid kind (use GENERAL or STATUS_CHANGE)");
    }
    if (input.kind === "STATUS_CHANGE") {
      if (!input.statusFrom?.trim() || !input.statusTo?.trim()) {
        throw new ApiError(400, "statusFrom and statusTo are required for STATUS_CHANGE");
      }
      const allowed = new Set(Object.values(HierarchyTaskStatus));
      if (!allowed.has(input.statusFrom as HierarchyTaskStatus) || !allowed.has(input.statusTo as HierarchyTaskStatus)) {
        throw new ApiError(400, "Invalid statusFrom or statusTo");
      }
    }

    const { organizationId, user } = await requireOrgUser(requesterId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    if (task.status === "COMPLETION_PENDING_APPROVAL") {
      throw new ApiError(400, "Finish the completion approval before adding artifacts", "COMPLETION_PENDING");
    }
    const isOrgMember = isOrganizationMemberRole(user.role.name);
    const participant =
      task.assignedById === requesterId || task.assignees.some(a => a.userId === requesterId) || isOrgMember;
    if (!participant) {
      throw new ApiError(403, "You cannot upload files for this task", "FORBIDDEN");
    }

    const storedPath = toStoredPath(taskId, file.filename);
    let createdId: number;
    try {
      const created = await prisma.hierarchyTaskArtifact.create({
        data: {
          taskId,
          uploadedById: requesterId,
          kind: input.kind,
          fileName: file.originalname || file.filename,
          storedPath,
          mimeType: file.mimetype || "application/octet-stream",
          sizeBytes: file.size,
          note: input.note?.trim() || null,
          statusFrom: input.kind === "STATUS_CHANGE" ? input.statusFrom!.trim() : null,
          statusTo: input.kind === "STATUS_CHANGE" ? input.statusTo!.trim() : null,
        },
      });
      createdId = created.id;
      await prisma.hierarchyTaskActivity.create({
        data: {
          taskId,
          userId: requesterId,
          action: "ARTIFACT_UPLOADED",
          meta: {
            kind: input.kind,
            fileName: file.originalname || file.filename,
            artifactId: created.id,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      fs.unlink(file.path, () => {});
      throw e;
    }
    const uploader = await loadUserFull(requesterId);
    const artifactRecipients = hierarchyTaskRecipientUserIds({
      assigneeUserIds: task.assignees.map(a => a.userId),
      assignedById: task.assignedById,
      actorUserId: requesterId,
    });
    if (artifactRecipients.length > 0) {
      await notifyHierarchyTaskUsers(artifactRecipients, {
        type: "hierarchy_task",
        title: "File uploaded",
        message: `${uploader.name} uploaded "${file.originalname || file.filename}" on "${task.title}".`,
        priority: "normal",
        metadata: { hierarchyTaskId: taskId, activity: "ARTIFACT_UPLOADED" },
      });
    }
    const detail = await this.getTask(taskId, requesterId);
    return { task: detail, artifactId: createdId };
  },

  async requestCompletion(
    taskId: number,
    requesterId: number,
    file: Express.Multer.File,
    note?: string | null,
  ) {
    if (!file) {
      throw new ApiError(400, "A completion proof file is required");
    }
    const { organizationId, user } = await requireOrgUser(requesterId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    if (task.status === "COMPLETION_PENDING_APPROVAL") {
      throw new ApiError(400, "Completion approval is already pending");
    }
    if (task.status === "COMPLETED" || task.status === "CANCELLED") {
      throw new ApiError(400, "This task cannot be submitted for completion");
    }
    const isOrgMember = isOrganizationMemberRole(user.role.name);
    const isAssigner = task.assignedById === requesterId;
    const isAssignee = task.assignees.some(a => a.userId === requesterId);
    if (!isAssignee && !isAssigner && !isOrgMember) {
      throw new ApiError(403, "You cannot request completion for this task", "FORBIDDEN");
    }

    const storedPath = toStoredPath(taskId, file.filename);
    try {
      await prisma.$transaction(async tx => {
        const art = await tx.hierarchyTaskArtifact.create({
          data: {
            taskId,
            uploadedById: requesterId,
            kind: "COMPLETION_PROOF",
            fileName: file.originalname || file.filename,
            storedPath,
            mimeType: file.mimetype || "application/octet-stream",
            sizeBytes: file.size,
            note: note?.trim() || null,
            statusFrom: null,
            statusTo: null,
          },
        });
        await tx.hierarchyTask.update({
          where: { id: taskId },
          data: {
            status: "COMPLETION_PENDING_APPROVAL",
            completionRequestedById: requesterId,
            completionRequestedAt: new Date(),
            completionArtifactId: art.id,
            activities: {
              create: {
                userId: requesterId,
                action: "COMPLETION_REQUESTED",
                meta: { artifactId: art.id } as Prisma.InputJsonValue,
              },
            },
          },
        });
      });
    } catch (e) {
      fs.unlink(file.path, () => {});
      throw e;
    }
    const requesterUser = await loadUserFull(requesterId);
    const completionReqRecipients = hierarchyTaskRecipientUserIds({
      assigneeUserIds: task.assignees.map(a => a.userId),
      assignedById: task.assignedById,
      actorUserId: requesterId,
    });
    if (completionReqRecipients.length > 0) {
      await notifyHierarchyTaskUsers(completionReqRecipients, {
        type: "hierarchy_task",
        title: "Completion submitted",
        message: `${requesterUser.name} submitted completion for approval on "${task.title}".`,
        priority: "high",
        metadata: { hierarchyTaskId: taskId, activity: "COMPLETION_REQUESTED" },
      });
    }
    return this.getTask(taskId, requesterId);
  },

  async approveCompletion(taskId: number, approverId: number) {
    const { organizationId, user } = await requireOrgUser(approverId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    if (task.status !== "COMPLETION_PENDING_APPROVAL") {
      throw new ApiError(400, "This task is not waiting for completion approval");
    }
    if (task.completionRequestedById == null) {
      throw new ApiError(500, "Task is missing completion request metadata");
    }
    const isOrgMember = isOrganizationMemberRole(user.role.name);
    const isAssigner = task.assignedById === approverId;
    const isAssignee = task.assignees.some(a => a.userId === approverId);
    if (!isAssignee && !isAssigner && !isOrgMember) {
      throw new ApiError(403, "You cannot approve this completion", "FORBIDDEN");
    }
    if (approverId === task.completionRequestedById) {
      throw new ApiError(403, "You cannot approve your own completion request", "FORBIDDEN");
    }

    const approvedAt = new Date();
    const assigneeIds = task.assignees.map(a => a.userId);
    const firstAssigneeActivity =
      assigneeIds.length > 0
        ? await prisma.hierarchyTaskActivity.findFirst({
            where: {
              taskId,
              userId: { in: assigneeIds },
              action: { not: "TASK_CREATED" },
            },
            orderBy: { createdAt: "asc" },
          })
        : null;

    const baselineAt = firstAssigneeActivity?.createdAt ?? task.createdAt;
    const durationMsToComplete = approvedAt.getTime() - baselineAt.getTime();
    const completionBaselineUsed = firstAssigneeActivity ? "first_assignee_activity" : "task_assigned";
    const durationMsFromCreated = approvedAt.getTime() - task.createdAt.getTime();

    const updated = await prisma.hierarchyTask.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completionRequestedById: null,
        completionRequestedAt: null,
        completionArtifactId: null,
        activities: {
          create: {
            userId: approverId,
            action: "COMPLETION_APPROVED",
            meta: {
              previousStatus: "COMPLETION_PENDING_APPROVAL",
              durationMsToComplete,
              completionBaselineUsed,
              durationMsFromCreated,
            } as Prisma.InputJsonValue,
          },
        },
      },
      include: taskDetailInclude,
    });
    const approverUser = await loadUserFull(approverId);
    const approveRecipients = hierarchyTaskRecipientUserIds({
      assigneeUserIds: task.assignees.map(a => a.userId),
      assignedById: task.assignedById,
      actorUserId: approverId,
    });
    if (approveRecipients.length > 0) {
      await notifyHierarchyTaskUsers(approveRecipients, {
        type: "hierarchy_task",
        title: "Task completed",
        message: `${approverUser.name} approved completion of "${task.title}".`,
        priority: "high",
        metadata: { hierarchyTaskId: taskId, activity: "COMPLETION_APPROVED" },
      });
    }
    return serializeHierarchyTaskDetail(updated);
  },

  async rejectCompletion(taskId: number, approverId: number, reason?: string | null) {
    const { organizationId, user } = await requireOrgUser(approverId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    if (task.status !== "COMPLETION_PENDING_APPROVAL") {
      throw new ApiError(400, "This task is not waiting for completion approval");
    }
    if (task.completionRequestedById == null) {
      throw new ApiError(500, "Task is missing completion request metadata");
    }
    const isOrgMember = isOrganizationMemberRole(user.role.name);
    const isAssigner = task.assignedById === approverId;
    const isAssignee = task.assignees.some(a => a.userId === approverId);
    if (!isAssignee && !isAssigner && !isOrgMember) {
      throw new ApiError(403, "You cannot reject this completion", "FORBIDDEN");
    }
    if (approverId === task.completionRequestedById) {
      throw new ApiError(403, "You cannot reject your own completion request", "FORBIDDEN");
    }

    const updated = await prisma.hierarchyTask.update({
      where: { id: taskId },
      data: {
        status: "IN_PROGRESS",
        completionRequestedById: null,
        completionRequestedAt: null,
        completionArtifactId: null,
        activities: {
          create: {
            userId: approverId,
            action: "COMPLETION_REJECTED",
            meta: { reason: reason?.trim() || null } as Prisma.InputJsonValue,
          },
        },
      },
      include: taskDetailInclude,
    });
    const rejector = await loadUserFull(approverId);
    const rejectRecipients = hierarchyTaskRecipientUserIds({
      assigneeUserIds: task.assignees.map(a => a.userId),
      assignedById: task.assignedById,
      actorUserId: approverId,
    });
    if (rejectRecipients.length > 0) {
      const reasonSuffix = reason?.trim() ? ` Reason: ${reason.trim()}.` : "";
      await notifyHierarchyTaskUsers(rejectRecipients, {
        type: "hierarchy_task",
        title: "Completion rejected",
        message: `${rejector.name} rejected completion on "${task.title}".${reasonSuffix}`,
        priority: "high",
        metadata: { hierarchyTaskId: taskId, activity: "COMPLETION_REJECTED" },
      });
    }
    return serializeHierarchyTaskDetail(updated);
  },

  async deleteTask(taskId: number, requesterId: number) {
    const { organizationId, user } = await requireOrgUser(requesterId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    const isOrgMember = isOrganizationMemberRole(user.role.name);
    const isAssigner = task.assignedById === requesterId;
    if (!isOrgMember && !isAssigner) {
      throw new ApiError(403, "Only the task creator can delete this task", "FORBIDDEN");
    }
    const deleter = await loadUserFull(requesterId);
    const deleteRecipients = hierarchyTaskRecipientUserIds({
      assigneeUserIds: task.assignees.map(a => a.userId),
      assignedById: task.assignedById,
      actorUserId: requesterId,
    });
    if (deleteRecipients.length > 0) {
      await notifyHierarchyTaskUsers(deleteRecipients, {
        type: "hierarchy_task",
        title: "Task deleted",
        message: `${deleter.name} deleted "${task.title}".`,
        priority: "normal",
        metadata: { hierarchyTaskId: taskId, activity: "DELETED" },
      });
    }
    await prisma.hierarchyTask.delete({ where: { id: taskId } });
  },

  async addComment(taskId: number, userId: number, content: string) {
    const { organizationId, user } = await requireOrgUser(userId);
    const task = await prisma.hierarchyTask.findFirst({
      where: { id: taskId, organizationId },
      include: { assignees: { select: { userId: true } } },
    });
    if (!task) {
      throw new ApiError(404, "Task not found");
    }
    const isOrgMember = isOrganizationMemberRole(user.role.name);
    const participant =
      task.assignedById === userId || task.assignees.some(a => a.userId === userId) || isOrgMember;
    if (!participant) {
      throw new ApiError(403, "You cannot comment on this task", "FORBIDDEN");
    }
    await prisma.hierarchyTaskComment.create({
      data: { taskId, userId, content },
    });
    const author = await loadUserFull(userId);
    const commentRecipients = hierarchyTaskRecipientUserIds({
      assigneeUserIds: task.assignees.map(a => a.userId),
      assignedById: task.assignedById,
      actorUserId: userId,
    });
    if (commentRecipients.length > 0) {
      await notifyHierarchyTaskUsers(commentRecipients, {
        type: "hierarchy_task",
        title: "New comment",
        message: `${author.name} commented on "${task.title}".`,
        priority: "normal",
        metadata: { hierarchyTaskId: taskId, activity: "COMMENT" },
      });
    }
    return this.getTask(taskId, userId);
  },

  async getAssignableUsers(requesterId: number, taskId?: number) {
    const requester = await loadUserFull(requesterId);
    if (!requester.organizationId) {
      throw new ApiError(400, "User has no organization");
    }

    let roleSource = requester;
    let handoffConstraint: { norm: string; label: string } | null = null;

    if (taskId != null) {
      const task = await prisma.hierarchyTask.findFirst({
        where: { id: taskId, organizationId: requester.organizationId },
        select: {
          assignedById: true,
          assignmentMode: true,
          department: true,
          handoffTargetDepartment: true,
          assignees: { select: { userId: true } },
        },
      });
      if (!task) {
        throw new ApiError(404, "Task not found");
      }
      const isAssigner = task.assignedById === requesterId;
      const isAssignee = task.assignees.some(a => a.userId === requesterId);
      const reqOrgMember = isOrganizationMemberRole(requester.role.name);
      if (!isAssigner && !isAssignee && !reqOrgMember) {
        throw new ApiError(403, "You cannot list assignable users for this task", "FORBIDDEN");
      }
      if (isAssignee && !isAssigner && !reqOrgMember) {
        roleSource = await loadUserFull(task.assignedById);
      }
      const handoffNormRaw = normalizeDepartmentName(task.handoffTargetDepartment ?? task.department);
      const handoffLabel = (task.handoffTargetDepartment ?? task.department ?? "").trim();
      if (task.assignmentMode === HierarchyTaskAssignmentMode.DEPARTMENT_HANDOFF && handoffNormRaw) {
        handoffConstraint = { norm: handoffNormRaw, label: handoffLabel || "target" };
      }
    }

    const assignableCanonical = new Set(getAssignableRoles(roleSource.role.name));
    if (assignableCanonical.size === 0) {
      return [];
    }

    const users = await prisma.user.findMany({
      where: {
        organizationId: requester.organizationId,
        isActive: true,
        id: { not: requesterId },
      },
      select: userRoleSelect,
    });

    const isOrgMember = isOrganizationMemberRole(roleSource.role.name);
    const reqDept = normalizeDepartmentName(effectiveDepartmentRaw(roleSource));

    const out: {
      id: number;
      name: string;
      email: string;
      department: string | null;
      role: { name: string };
    }[] = [];

    for (const u of users) {
      const eff = effectiveHierarchyRole(u.role.name);
      if (!eff || !assignableCanonical.has(eff)) {
        continue;
      }
      if (handoffConstraint?.norm) {
        const ud = normalizeDepartmentName(effectiveDepartmentRaw(u));
        if (!ud || ud !== handoffConstraint.norm) {
          continue;
        }
      } else if (!isOrgMember && reqDept) {
        const ud = normalizeDepartmentName(effectiveDepartmentRaw(u));
        if (!ud || ud !== reqDept) {
          continue;
        }
      }
      out.push({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department ?? null,
        role: { name: u.role.name },
      });
    }

    const level = (name: string) => {
      const e = effectiveHierarchyRole(name);
      return e ? HIERARCHY_LEVELS[e] : 0;
    };
    out.sort((a, b) => level(b.role.name) - level(a.role.name) || a.name.localeCompare(b.name));
    return out;
  },

  async syncAssignableDirectory(requesterId: number, searchQuery?: string) {
    const requester = await loadUserFull(requesterId);
    if (!requester.organizationId) {
      throw new ApiError(400, "User has no organization; link your account to an organization first.");
    }
    const defaultRole = await prisma.role.findFirst({ where: { name: "USER" } });
    if (!defaultRole) {
      throw new ApiError(500, "Cannot sync directory: USER role not found in database.");
    }
    const fetchRes = await fetchGraphUsersForEmailDomain(requester.email, {
      textSearch: searchQuery?.trim() || undefined,
    });
    if (!fetchRes.ok) {
      if (fetchRes.reason === "graph_not_configured") {
        return {
          graphConfigured: false,
          created: 0,
          updated: 0,
          matchedDirectory: 0,
        };
      }
      throw new ApiError(502, fetchRes.message || "Microsoft Graph directory request failed");
    }
    const { created, updated } = await upsertGraphUsersForOrganization(
      requester.organizationId,
      fetchRes.users,
      defaultRole.id,
    );
    return {
      graphConfigured: true,
      created,
      updated,
      matchedDirectory: fetchRes.users.length,
    };
  },
};
