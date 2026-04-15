import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { listFlowsForApi } from "../../lib/taskFlowRegistry";
import { workTasksService } from "./service";
import {
  assignWorkTaskSchema,
  commentWorkTaskSchema,
  createWorkTaskSchema,
  listWorkTasksQuerySchema,
  patchWorkTaskSchema,
} from "./validation";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

export const listTaskFlows = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: { flows: listFlowsForApi() },
    message: "",
  });
};

export const listWorkTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const parsed = listWorkTasksQuerySchema.parse(req.query);
  const tasks = await workTasksService.list(user.id, user.role, {
    scope: parsed.scope,
    status: parsed.status,
    taskFlowKey: parsed.taskFlowKey,
    skip: parsed.skip,
    take: parsed.take,
  });

  res.json({
    success: true,
    data: { tasks },
    message: "",
  });
};

export const getWorkTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseInt(req.params.id, 10);
  const task = await workTasksService.getById(taskId, user.id, user.role);

  res.json({
    success: true,
    data: { task },
    message: "",
  });
};

export const createWorkTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const parsed = createWorkTaskSchema.parse(req.body);
  const task = await workTasksService.create(user.id, user.role, {
    title: parsed.title,
    description: parsed.description,
    taskFlowKey: parsed.taskFlowKey,
    status: parsed.status,
    priority: parsed.priority,
    dueDate: parsed.dueDate ?? null,
    assigneeId: parsed.assigneeId ?? null,
  });

  res.status(201).json({
    success: true,
    data: { task },
    message: "",
  });
};

export const patchWorkTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseInt(req.params.id, 10);
  const parsed = patchWorkTaskSchema.parse(req.body);
  const task = await workTasksService.patch(taskId, user.id, user.role, {
    title: parsed.title,
    description: parsed.description,
    status: parsed.status,
    priority: parsed.priority,
    dueDate: parsed.dueDate,
  });

  res.json({
    success: true,
    data: { task },
    message: "",
  });
};

export const assignWorkTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseInt(req.params.id, 10);
  const parsed = assignWorkTaskSchema.parse(req.body);
  const task = await workTasksService.assign(taskId, user.id, user.role, parsed.assigneeId ?? null);

  res.json({
    success: true,
    data: { task },
    message: "",
  });
};

export const listAssignableUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const users = await workTasksService.listAssignableUsers(user.id, user.role);

  res.json({
    success: true,
    data: { users },
    message: "",
  });
};

export const commentWorkTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseInt(req.params.id, 10);
  const parsed = commentWorkTaskSchema.parse(req.body);
  const comment = await workTasksService.addComment(taskId, user.id, user.role, parsed.body);

  res.status(201).json({
    success: true,
    data: { comment },
    message: "",
  });
};
