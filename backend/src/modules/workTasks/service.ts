import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import { Prisma } from "../../generated/prisma";
import { tagsFromJson } from "../../lib/tagsFromJson";
import {
  allowedFlowKeysForUser,
  defaultStatusForFlow,
  isTaskFlowKey,
  isValidStatusForFlow,
  type TaskFlowKey,
} from "../../lib/taskFlowRegistry";

const ELEVATED = ["ADMIN", "SUPER_ADMIN", "MANAGEMENT"];

export function isElevatedRole(role: string): boolean {
  return ELEVATED.includes(role);
}

const taskIncludeList = {
  assignee: {
    select: { id: true, name: true, email: true },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
} as const;

const taskDetailInclude = {
  ...taskIncludeList,
  comments: {
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" as const },
    take: 100,
  },
  activities: {
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
};

async function directReportIds(managerId: number): Promise<number[]> {
  const rows = await prisma.user.findMany({
    where: { reportsToId: managerId },
    select: { id: true },
  });
  return rows.map(r => r.id);
}

async function assertUserInSameOrg(userId: number, organizationId: number) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!u || u.organizationId !== organizationId) {
    throw new ApiError(400, "User must belong to the same organization");
  }
}

async function getUserTags(userId: number): Promise<string[]> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { tagsJson: true },
  });
  return tagsFromJson(u?.tagsJson);
}

async function assertCreatorMayUseFlow(flowKey: TaskFlowKey, creatorId: number, role: string) {
  if (isElevatedRole(role)) {
    return;
  }
  const tags = await getUserTags(creatorId);
  if (!allowedFlowKeysForUser(tags).includes(flowKey)) {
    throw new ApiError(403, "Your profile tags do not allow creating tasks in this flow");
  }
}

async function assertAssigneeMayParticipateInFlow(flowKey: TaskFlowKey, assigneeId: number | null, role: string) {
  if (assigneeId == null) {
    return;
  }
  if (isElevatedRole(role)) {
    return;
  }
  const tags = await getUserTags(assigneeId);
  if (!allowedFlowKeysForUser(tags).includes(flowKey)) {
    throw new ApiError(403, "Assignee does not have a profile tag for this task flow");
  }
}

export const workTasksService = {
  async list(
    userId: number,
    role: string,
    params: {
      scope: "mine" | "team" | "org";
      status?: string;
      taskFlowKey?: string;
      skip?: number;
      take?: number;
    },
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      throw new ApiError(400, "User has no organization; workplace tasks are unavailable");
    }
    const orgId = user.organizationId;
    const take = params.take ?? 50;
    const skip = params.skip ?? 0;
    const statusFilter = params.status ? { status: params.status } : {};
    const flowFilter =
      params.taskFlowKey && isTaskFlowKey(params.taskFlowKey) ? { taskFlowKey: params.taskFlowKey } : {};

    if (params.scope === "org") {
      if (!isElevatedRole(role)) {
        throw new ApiError(403, "Org scope requires elevated role");
      }
      return prisma.workTask.findMany({
        where: { organizationId: orgId, ...statusFilter, ...flowFilter },
        include: taskIncludeList,
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        skip,
        take,
      });
    }

    if (params.scope === "team") {
      if (isElevatedRole(role)) {
        return prisma.workTask.findMany({
          where: { organizationId: orgId, ...statusFilter, ...flowFilter },
          include: taskIncludeList,
          orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
          skip,
          take,
        });
      }
      const reports = await directReportIds(userId);
      if (reports.length === 0) {
        throw new ApiError(403, "Team scope requires at least one direct report");
      }
      const teamAssignees = [...reports, userId];
      return prisma.workTask.findMany({
        where: {
          organizationId: orgId,
          ...statusFilter,
          ...flowFilter,
          OR: [{ assigneeId: { in: teamAssignees } }, { createdById: userId }],
        },
        include: taskIncludeList,
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        skip,
        take,
      });
    }

    // mine
    return prisma.workTask.findMany({
      where: {
        organizationId: orgId,
        ...statusFilter,
        ...flowFilter,
        OR: [{ assigneeId: userId }, { createdById: userId }],
      },
      include: taskIncludeList,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      skip,
      take,
    });
  },

  async getById(taskId: number, userId: number, role: string) {
    const task = await prisma.workTask.findUnique({
      where: { id: taskId },
      include: taskDetailInclude,
    });
    if (!task) {
      throw new ApiError(404, "Work task not found");
    }
    await this.assertCanView(task, userId, role);
    return task;
  },

  async assertCanView(
    task: { organizationId: number; assigneeId: number | null; createdById: number },
    userId: number,
    role: string,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId || user.organizationId !== task.organizationId) {
      throw new ApiError(403, "Forbidden");
    }
    if (isElevatedRole(role)) {
      return;
    }
    if (task.assigneeId === userId || task.createdById === userId) {
      return;
    }
    const reports = await directReportIds(userId);
    if (task.assigneeId != null && reports.includes(task.assigneeId)) {
      return;
    }
    throw new ApiError(403, "Forbidden");
  },

  async assertCanModify(
    task: { organizationId: number; assigneeId: number | null; createdById: number },
    userId: number,
    role: string,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId || user.organizationId !== task.organizationId) {
      throw new ApiError(403, "Forbidden");
    }
    if (isElevatedRole(role)) {
      return;
    }
    if (task.assigneeId === userId || task.createdById === userId) {
      return;
    }
    const reports = await directReportIds(userId);
    if (task.assigneeId != null && reports.includes(task.assigneeId)) {
      return;
    }
    throw new ApiError(403, "Forbidden");
  },

  async validateAssigneeId(
    actorId: number,
    role: string,
    organizationId: number,
    assigneeId: number | null | undefined,
  ) {
    if (assigneeId == null) {
      return;
    }
    await assertUserInSameOrg(assigneeId, organizationId);
    if (isElevatedRole(role)) {
      return;
    }
    if (assigneeId === actorId) {
      return;
    }
    const reports = await directReportIds(actorId);
    if (reports.includes(assigneeId)) {
      return;
    }
    throw new ApiError(403, "You can only assign tasks to yourself or your direct reports");
  },

  async create(
    userId: number,
    role: string,
    data: {
      title: string;
      description?: string | null;
      taskFlowKey: TaskFlowKey;
      status?: string;
      priority: string;
      dueDate?: Date | null;
      assigneeId?: number | null;
    },
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      throw new ApiError(400, "User has no organization");
    }
    const orgId = user.organizationId;
    const flowKey = data.taskFlowKey;
    await assertCreatorMayUseFlow(flowKey, userId, role);
    await this.validateAssigneeId(userId, role, orgId, data.assigneeId ?? null);
    await assertAssigneeMayParticipateInFlow(flowKey, data.assigneeId ?? null, role);

    let status = data.status ?? defaultStatusForFlow(flowKey);
    if (!isValidStatusForFlow(flowKey, status)) {
      throw new ApiError(400, `Invalid status for this task flow: ${status}`);
    }

    const task = await prisma.workTask.create({
      data: {
        organizationId: orgId,
        taskFlowKey: flowKey,
        title: data.title,
        description: data.description ?? null,
        status,
        priority: data.priority,
        dueDate: data.dueDate ?? null,
        createdById: userId,
        assigneeId: data.assigneeId ?? null,
      },
      include: taskIncludeList,
    });

    await prisma.workTaskActivity.create({
      data: {
        workTaskId: task.id,
        actorId: userId,
        action: "CREATED",
        metadata: { taskFlowKey: flowKey } as Prisma.InputJsonValue,
      },
    });

    return task;
  },

  async patch(
    taskId: number,
    userId: number,
    role: string,
    data: {
      title?: string;
      description?: string | null;
      status?: string;
      priority?: string;
      dueDate?: Date | null;
    },
  ) {
    const existing = await prisma.workTask.findUnique({ where: { id: taskId } });
    if (!existing) {
      throw new ApiError(404, "Work task not found");
    }
    await this.assertCanModify(existing, userId, role);

    const prevStatus = existing.status;
    const flowKey = isTaskFlowKey(existing.taskFlowKey) ? existing.taskFlowKey : "employee";
    if (data.status !== undefined && !isValidStatusForFlow(flowKey, data.status)) {
      throw new ApiError(400, `Invalid status for this task flow: ${data.status}`);
    }

    const task = await prisma.workTask.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      },
      include: taskDetailInclude,
    });

    if (data.status !== undefined && data.status !== prevStatus) {
      await prisma.workTaskActivity.create({
        data: {
          workTaskId: taskId,
          actorId: userId,
          action: "STATUS_CHANGED",
          metadata: { from: prevStatus, to: data.status } as Prisma.InputJsonValue,
        },
      });
    }

    return task;
  },

  async assign(taskId: number, userId: number, role: string, assigneeId: number | null) {
    const existing = await prisma.workTask.findUnique({ where: { id: taskId } });
    if (!existing) {
      throw new ApiError(404, "Work task not found");
    }
    await this.assertCanModify(existing, userId, role);
    await this.validateAssigneeId(userId, role, existing.organizationId, assigneeId);
    const flowKey = isTaskFlowKey(existing.taskFlowKey) ? existing.taskFlowKey : "employee";
    await assertAssigneeMayParticipateInFlow(flowKey, assigneeId, role);

    const prev = existing.assigneeId;
    const task = await prisma.workTask.update({
      where: { id: taskId },
      data: { assigneeId },
      include: taskDetailInclude,
    });

    await prisma.workTaskActivity.create({
      data: {
        workTaskId: taskId,
        actorId: userId,
        action: "ASSIGNED",
        metadata: { from: prev, to: assigneeId } as Prisma.InputJsonValue,
      },
    });

    return task;
  },

  async addComment(taskId: number, userId: number, role: string, body: string) {
    const existing = await prisma.workTask.findUnique({ where: { id: taskId } });
    if (!existing) {
      throw new ApiError(404, "Work task not found");
    }
    await this.assertCanView(existing, userId, role);

    const comment = await prisma.workTaskComment.create({
      data: {
        workTaskId: taskId,
        authorId: userId,
        body,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.workTaskActivity.create({
      data: {
        workTaskId: taskId,
        actorId: userId,
        action: "COMMENTED",
        metadata: { commentId: comment.id } as Prisma.InputJsonValue,
      },
    });

    return comment;
  },

  async listAssignableUsers(userId: number, role: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      throw new ApiError(400, "User has no organization");
    }
    const orgId = user.organizationId;

    if (isElevatedRole(role)) {
      return prisma.user.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
    }

    const reports = await directReportIds(userId);
    const ids = [...new Set([userId, ...reports])];
    return prisma.user.findMany({
      where: { id: { in: ids }, organizationId: orgId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
  },
};
