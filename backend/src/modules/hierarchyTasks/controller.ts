import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { hierarchyTasksService } from "./service";
import {
  addCommentSchema,
  createTaskSchema,
  directorySyncSchema,
  listTasksQuerySchema,
  rejectCompletionSchema,
  updateStatusSchema,
  updateTaskSchema,
} from "./validators";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

function parseTaskId(param: string | undefined): number {
  const id = parseInt(param ?? "", 10);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid task id");
  }
  return id;
}

export const getAssignableUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const raw = req.query.taskId;
  const taskId =
    typeof raw === "string" && /^\d+$/.test(raw.trim()) ? parseInt(raw.trim(), 10) : undefined;
  const users = await hierarchyTasksService.getAssignableUsers(user.id, taskId);
  res.json({ success: true, data: { users }, message: "" });
};

export const listHandoffDepartments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const departments = await hierarchyTasksService.listHandoffDepartmentsForRequester(user.id);
  res.json({ success: true, data: { departments }, message: "" });
};

export const syncAssignableDirectory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const parsed = directorySyncSchema.parse(req.body ?? {});
  const result = await hierarchyTasksService.syncAssignableDirectory(user.id, parsed.query);
  res.json({ success: true, data: result, message: "" });
};

export const listTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const parsed = listTasksQuerySchema.parse(req.query);
  const tasks = await hierarchyTasksService.listTasksForUser(user.id, parsed);
  res.json({ success: true, data: { tasks }, message: "" });
};

export const createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const parsed = createTaskSchema.parse(req.body);
  const task = await hierarchyTasksService.createTask(user.id, parsed);
  res.status(201).json({ success: true, data: { task }, message: "" });
};

export const getTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  const task = await hierarchyTasksService.getTask(taskId, user.id);
  res.json({ success: true, data: { task }, message: "" });
};

export const updateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  const parsed = updateTaskSchema.parse(req.body);
  const task = await hierarchyTasksService.updateTask(taskId, user.id, parsed);
  res.json({ success: true, data: { task }, message: "" });
};

export const updateStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  const parsed = updateStatusSchema.parse(req.body);
  const task = await hierarchyTasksService.updateStatus(taskId, user.id, parsed);
  res.json({ success: true, data: { task }, message: "" });
};

export const downloadHierarchyTaskArtifact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  const artifactId = parseInt(req.params.artifactId ?? "", 10);
  if (!Number.isFinite(artifactId) || artifactId < 1) {
    throw new ApiError(400, "Invalid artifact id");
  }
  const { stream, fileName, mimeType } = await hierarchyTasksService.openArtifactFile(taskId, artifactId, user.id);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  stream.on("error", () => {
    if (!res.writableEnded) {
      res.end();
    }
  });
  stream.pipe(res);
};

export const postArtifact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  const file = req.file;
  if (!file) {
    throw new ApiError(400, "Missing file (use field name \"file\")");
  }
  const kind = String(req.body?.kind ?? "").trim();
  const note = req.body?.note != null ? String(req.body.note) : undefined;
  const statusFrom = req.body?.statusFrom != null ? String(req.body.statusFrom) : undefined;
  const statusTo = req.body?.statusTo != null ? String(req.body.statusTo) : undefined;
  const { task, artifactId } = await hierarchyTasksService.addArtifact(taskId, user.id, file, {
    kind,
    note,
    statusFrom,
    statusTo,
  });
  res.status(201).json({ success: true, data: { task, artifactId }, message: "" });
};

export const postRequestCompletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  const file = req.file;
  if (!file) {
    throw new ApiError(400, "Missing completion proof file (use field name \"file\")");
  }
  const note = req.body?.note != null ? String(req.body.note) : undefined;
  const task = await hierarchyTasksService.requestCompletion(taskId, user.id, file, note);
  res.json({ success: true, data: { task }, message: "" });
};

export const postApproveCompletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  const task = await hierarchyTasksService.approveCompletion(taskId, user.id);
  res.json({ success: true, data: { task }, message: "" });
};

export const postRejectCompletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  const parsed = rejectCompletionSchema.parse(req.body ?? {});
  const task = await hierarchyTasksService.rejectCompletion(taskId, user.id, parsed.reason);
  res.json({ success: true, data: { task }, message: "" });
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  await hierarchyTasksService.deleteTask(taskId, user.id);
  res.json({ success: true, data: null, message: "" });
};

export const addComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const taskId = parseTaskId(req.params.id);
  const parsed = addCommentSchema.parse(req.body);
  const task = await hierarchyTasksService.addComment(taskId, user.id, parsed.content);
  res.status(201).json({ success: true, data: { task }, message: "" });
};
