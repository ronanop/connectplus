import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireRoles } from "../../middleware/rbac";
import { validateRequest } from "../../middleware/validateRequest";
import {
  assignTask,
  createDailyUpdate,
  getTask,
  listMyTasks,
  listTeamTasks,
  updateTaskStatus,
} from "./controller";
import { assignTaskSchema, createDailyUpdateSchema, updateTaskStatusSchema } from "./validation";

export const tasksRouter = Router();

tasksRouter.use(authenticate);

tasksRouter.get("/my", asyncHandler(listMyTasks));
tasksRouter.get("/team", requireRoles(["ADMIN", "SUPER_ADMIN", "MANAGEMENT"]), asyncHandler(listTeamTasks));
tasksRouter.get("/:id", asyncHandler(getTask));
tasksRouter.patch("/:id/status", validateRequest(updateTaskStatusSchema), asyncHandler(updateTaskStatus));
tasksRouter.post("/:id/updates", validateRequest(createDailyUpdateSchema), asyncHandler(createDailyUpdate));
tasksRouter.patch(
  "/:id/assign",
  requireRoles(["ADMIN", "SUPER_ADMIN", "MANAGEMENT"]),
  validateRequest(assignTaskSchema),
  asyncHandler(assignTask),
);
