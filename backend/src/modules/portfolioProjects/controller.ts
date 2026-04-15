import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { portfolioProjectsService } from "./service";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

function parseProjectId(param: string | undefined): number {
  const id = parseInt(param ?? "", 10);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid project id");
  }
  return id;
}

function parseUserIdParam(param: string | undefined): number {
  const id = parseInt(param ?? "", 10);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid user id");
  }
  return id;
}

export const getAccessMeta = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const data = await portfolioProjectsService.getAccessMeta(user.id);
  res.json({ success: true, data, message: "" });
};

export const listProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const data = await portfolioProjectsService.listProjects(user.id, req.query as never);
  res.json({ success: true, data: { projects: data }, message: "" });
};

export const createProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const result = await portfolioProjectsService.createProject(user.id, req.body);
  res.status(201).json({ success: true, data: result, message: "" });
};

export const getProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const projectId = parseProjectId(req.params.id);
  const result = await portfolioProjectsService.getProjectDetail(user.id, projectId);
  res.json({ success: true, data: result, message: "" });
};

export const patchProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const projectId = parseProjectId(req.params.id);
  const result = await portfolioProjectsService.patchProject(user.id, projectId, req.body);
  res.json({ success: true, data: result, message: "" });
};

export const patchStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const projectId = parseProjectId(req.params.id);
  const result = await portfolioProjectsService.patchStatus(user.id, projectId, req.body);
  res.json({ success: true, data: result, message: "" });
};

export const addMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const projectId = parseProjectId(req.params.id);
  const result = await portfolioProjectsService.addMember(user.id, projectId, req.body);
  res.json({ success: true, data: result, message: "" });
};

export const removeMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const projectId = parseProjectId(req.params.id);
  const targetUserId = parseUserIdParam(req.params.userId);
  const result = await portfolioProjectsService.removeMember(user.id, projectId, targetUserId);
  res.json({ success: true, data: result, message: "" });
};

export const postArtifact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const projectId = parseProjectId(req.params.id);
  const file = req.file;
  if (!file) {
    throw new ApiError(400, "Missing file (use field name \"file\")");
  }
  const kind = req.body?.kind != null ? String(req.body.kind) : undefined;
  const note = req.body?.note != null ? String(req.body.note) : undefined;
  let journalEntryId: number | undefined;
  if (req.body?.journalEntryId != null && String(req.body.journalEntryId).trim() !== "") {
    const j = parseInt(String(req.body.journalEntryId), 10);
    if (Number.isFinite(j) && j >= 1) {
      journalEntryId = j;
    }
  }
  const result = await portfolioProjectsService.addArtifact(projectId, user.id, file, {
    kind,
    note,
    journalEntryId,
  });
  res.status(201).json({ success: true, data: result, message: "" });
};

export const postJournalEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const projectId = parseProjectId(req.params.id);
  const result = await portfolioProjectsService.createJournalEntry(user.id, projectId, req.body);
  res.status(201).json({ success: true, data: result, message: "" });
};

export const postJournalArtifact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const projectId = parseProjectId(req.params.id);
  const journalId = parseInt(req.params.journalId ?? "", 10);
  if (!Number.isFinite(journalId) || journalId < 1) {
    throw new ApiError(400, "Invalid journal id");
  }
  const file = req.file;
  if (!file) {
    throw new ApiError(400, "Missing file (use field name \"file\")");
  }
  const kind = req.body?.kind != null ? String(req.body.kind) : undefined;
  const note = req.body?.note != null ? String(req.body.note) : undefined;
  const result = await portfolioProjectsService.addArtifact(projectId, user.id, file, {
    kind,
    note,
    journalEntryId: journalId,
  });
  res.status(201).json({ success: true, data: result, message: "" });
};

export const downloadArtifact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const projectId = parseProjectId(req.params.id);
  const artifactId = parseInt(req.params.artifactId ?? "", 10);
  if (!Number.isFinite(artifactId) || artifactId < 1) {
    throw new ApiError(400, "Invalid artifact id");
  }
  const { stream, fileName, mimeType } = await portfolioProjectsService.openArtifactFile(
    projectId,
    artifactId,
    user.id,
  );
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  stream.on("error", () => {
    if (!res.writableEnded) {
      res.end();
    }
  });
  stream.pipe(res);
};
