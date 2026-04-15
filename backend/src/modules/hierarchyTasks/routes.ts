import { NextFunction, Request, Response, Router } from "express";
import { authenticate } from "../../middleware/auth";
import { ApiError } from "../../middleware/errorHandler";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  addComment,
  createTask,
  deleteTask,
  downloadHierarchyTaskArtifact,
  getAssignableUsers,
  listHandoffDepartments,
  getTask,
  listTasks,
  postApproveCompletion,
  postArtifact,
  postRejectCompletion,
  postRequestCompletion,
  syncAssignableDirectory,
  updateStatus,
  updateTask,
} from "./controller";
import { hierarchyTaskArtifactUpload } from "./upload";
import {
  addCommentSchema,
  createTaskSchema,
  directorySyncSchema,
  listTasksQuerySchema,
  rejectCompletionSchema,
  updateStatusSchema,
  updateTaskSchema,
} from "./validators";

export const hierarchyTasksRouter = Router();

function singleArtifactUpload(req: Request, res: Response, next: NextFunction) {
  hierarchyTaskArtifactUpload.single("file")(req, res, err => {
    if (err) {
      next(err instanceof Error ? new ApiError(400, err.message) : err);
      return;
    }
    next();
  });
}

hierarchyTasksRouter.use(authenticate);

hierarchyTasksRouter.get("/assignable-users", asyncHandler(getAssignableUsers));
hierarchyTasksRouter.get("/handoff-departments", asyncHandler(listHandoffDepartments));
hierarchyTasksRouter.post("/directory-sync", validateRequest(directorySyncSchema), asyncHandler(syncAssignableDirectory));
hierarchyTasksRouter.get("/", validateRequest(listTasksQuerySchema, "query"), asyncHandler(listTasks));
hierarchyTasksRouter.post("/", validateRequest(createTaskSchema), asyncHandler(createTask));
hierarchyTasksRouter.get("/:id/artifacts/:artifactId/file", asyncHandler(downloadHierarchyTaskArtifact));
hierarchyTasksRouter.post("/:id/artifacts", singleArtifactUpload, asyncHandler(postArtifact));
hierarchyTasksRouter.post("/:id/request-completion", singleArtifactUpload, asyncHandler(postRequestCompletion));
hierarchyTasksRouter.post("/:id/approve-completion", asyncHandler(postApproveCompletion));
hierarchyTasksRouter.post("/:id/reject-completion", validateRequest(rejectCompletionSchema), asyncHandler(postRejectCompletion));
hierarchyTasksRouter.get("/:id", asyncHandler(getTask));
hierarchyTasksRouter.patch("/:id", validateRequest(updateTaskSchema), asyncHandler(updateTask));
hierarchyTasksRouter.patch("/:id/status", validateRequest(updateStatusSchema), asyncHandler(updateStatus));
hierarchyTasksRouter.delete("/:id", asyncHandler(deleteTask));
hierarchyTasksRouter.post("/:id/comments", validateRequest(addCommentSchema), asyncHandler(addComment));
