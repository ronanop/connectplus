import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";

const TEAM_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGEMENT"];

export const tasksService = {
  async listMyTasks(userId: number, status?: string) {
    const tasks = await prisma.projectTask.findMany({
      where: {
        assignedToId: userId,
        ...(status ? { status } : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            customer: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            dailyUpdates: true,
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return tasks.map(task => ({
      ...task,
      updatesCount: task._count.dailyUpdates,
    }));
  },

  async getTaskById(taskId: number, userId: number, role: string) {
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            customer: true,
            teamMembers: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        dailyUpdates: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            submittedAt: "desc",
          },
        },
      },
    });

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    if (task.assignedToId !== userId && !TEAM_ROLES.includes(role)) {
      throw new ApiError(403, "Forbidden");
    }

    return {
      ...task,
      updates: task.dailyUpdates,
    };
  },

  async updateTaskStatus(taskId: number, userId: number, role: string, status: string) {
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        assignedToId: true,
      },
    });

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    if (task.assignedToId !== userId && !TEAM_ROLES.includes(role)) {
      throw new ApiError(403, "Forbidden");
    }

    return prisma.projectTask.update({
      where: { id: taskId },
      data: { status },
    });
  },

  async createDailyUpdate(taskId: number, userId: number, role: string, updateText: string, evidenceUrl?: string | null) {
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        assignedToId: true,
      },
    });

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    if (task.assignedToId !== userId && !TEAM_ROLES.includes(role)) {
      throw new ApiError(403, "Forbidden");
    }

    return prisma.dailyUpdate.create({
      data: {
        taskId,
        memberId: userId,
        updateText,
        evidenceUrl: evidenceUrl ?? null,
        submittedAt: new Date(),
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async listTeamTasks() {
    const tasks = await prisma.projectTask.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
            customer: true,
            teamMembers: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            dailyUpdates: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });

    const userIds = Array.from(
      new Set(
        tasks.flatMap(task => {
          const teamMembers = Array.isArray(task.project.teamMembers) ? task.project.teamMembers : [];
          return teamMembers.map(member => Number((member as Record<string, unknown>).id)).filter(Number.isFinite);
        }),
      ),
    );

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          include: { role: true },
        })
      : [];

    const userMap = new Map(
      users.map(user => [
        user.id,
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name,
        },
      ]),
    );

    return tasks.map(task => {
      const teamMembers = Array.isArray(task.project.teamMembers) ? task.project.teamMembers : [];
      return {
        ...task,
        updatesCount: task._count.dailyUpdates,
        projectTeam: teamMembers
          .map(member => userMap.get(Number((member as Record<string, unknown>).id)))
          .filter((member): member is NonNullable<typeof member> => Boolean(member)),
      };
    });
  },

  async assignTask(taskId: number, assignedToId: number | null) {
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            teamMembers: true,
          },
        },
      },
    });

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    if (assignedToId != null) {
      const teamMembers = Array.isArray(task.project.teamMembers) ? task.project.teamMembers : [];
      const isInProjectTeam = teamMembers.some(member => Number((member as Record<string, unknown>).id) === assignedToId);
      if (!isInProjectTeam) {
        throw new ApiError(400, "Assignee must belong to the project team");
      }
    }

    return prisma.projectTask.update({
      where: { id: taskId },
      data: {
        assignedToId,
      },
    });
  },
};
