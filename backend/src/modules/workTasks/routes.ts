import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  assignWorkTask,
  commentWorkTask,
  createWorkTask,
  getWorkTask,
  listAssignableUsers,
  listTaskFlows,
  listWorkTasks,
  patchWorkTask,
} from "./controller";
import {
  assignWorkTaskSchema,
  commentWorkTaskSchema,
  createWorkTaskSchema,
  listWorkTasksQuerySchema,
  patchWorkTaskSchema,
} from "./validation";

export const workTasksRouter = Router();

workTasksRouter.use(authenticate);

workTasksRouter.get("/flows", asyncHandler(listTaskFlows));
workTasksRouter.get("/", validateRequest(listWorkTasksQuerySchema, "query"), asyncHandler(listWorkTasks));
workTasksRouter.get("/assignable-users", asyncHandler(listAssignableUsers));
workTasksRouter.post("/", validateRequest(createWorkTaskSchema), asyncHandler(createWorkTask));
workTasksRouter.get("/:id", asyncHandler(getWorkTask));
workTasksRouter.patch("/:id", validateRequest(patchWorkTaskSchema), asyncHandler(patchWorkTask));
workTasksRouter.patch("/:id/assign", validateRequest(assignWorkTaskSchema), asyncHandler(assignWorkTask));
workTasksRouter.post("/:id/comments", validateRequest(commentWorkTaskSchema), asyncHandler(commentWorkTask));
