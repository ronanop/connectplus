import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { tasksService } from "./service";
import { ApiError } from "../../middleware/errorHandler";
import { listMyTasksQuerySchema } from "./validation";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

export const listMyTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const parsed = listMyTasksQuerySchema.parse(req.query);
  const tasks = await tasksService.listMyTasks(user.id, parsed.status);

  res.json({
    success: true,
    data: { tasks },
    message: "",
  });
};

export const getTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseInt(req.params.id, 10);
  const task = await tasksService.getTaskById(taskId, user.id, user.role);

  res.json({
    success: true,
    data: { task },
    message: "",
  });
};

export const updateTaskStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseInt(req.params.id, 10);
  const { status } = req.body as { status: string };
  const task = await tasksService.updateTaskStatus(taskId, user.id, user.role, status);

  res.json({
    success: true,
    data: { task },
    message: "",
  });
};

export const createDailyUpdate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseInt(req.params.id, 10);
  const { updateText, evidenceUrl } = req.body as { updateText: string; evidenceUrl?: string | null };
  const update = await tasksService.createDailyUpdate(taskId, user.id, user.role, updateText, evidenceUrl);

  res.status(201).json({
    success: true,
    data: { update },
    message: "",
  });
};

export const listTeamTasks = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tasks = await tasksService.listTeamTasks();

  res.json({
    success: true,
    data: { tasks },
    message: "",
  });
};

export const assignTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const taskId = parseInt(req.params.id, 10);
  const { assignedToId } = req.body as { assignedToId: number | null };
  const task = await tasksService.assignTask(taskId, assignedToId);

  res.json({
    success: true,
    data: { task },
    message: "",
  });
};
