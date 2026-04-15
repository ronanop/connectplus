import type { Express } from "express";
import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import {
  isMultipartRequest,
  normalizeMultipartCreateBody,
  normalizeMultipartPatchBody,
  readClearCertificateFlag,
} from "./certBody";
import { createUserCertificationSchema, patchUserCertificationSchema } from "./validators";
import { userCertificationsService, userSkillsService } from "./service";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

function parseId(param: string | undefined): number {
  const id = parseInt(param ?? "", 10);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid id");
  }
  return id;
}

export const listMySkills = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const skills = await userSkillsService.listMine(user.id);
  res.json({ success: true, data: { skills }, message: "" });
};

export const createSkill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const skill = await userSkillsService.create(user.id, req.body);
  res.status(201).json({ success: true, data: { skill }, message: "" });
};

export const patchSkill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const id = parseId(req.params.id);
  const skill = await userSkillsService.patch(user.id, id, req.body);
  res.json({ success: true, data: { skill }, message: "" });
};

export const deleteSkill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const id = parseId(req.params.id);
  await userSkillsService.remove(user.id, id);
  res.json({ success: true, data: {}, message: "" });
};

export const listMyCertifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const certifications = await userCertificationsService.listMine(user.id);
  res.json({ success: true, data: { certifications }, message: "" });
};

export const createCertification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const multipart = isMultipartRequest(req);
  const rawBody = multipart
    ? normalizeMultipartCreateBody((req.body ?? {}) as Record<string, unknown>)
    : req.body;
  const parsed = createUserCertificationSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid certification data.");
  }
  const file = (req as { file?: Express.Multer.File }).file;
  const certification = await userCertificationsService.create(user.id, parsed.data, file);
  res.status(201).json({ success: true, data: { certification }, message: "" });
};

export const patchCertification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const id = parseId(req.params.id);
  const multipart = isMultipartRequest(req);
  const rawBody = multipart
    ? normalizeMultipartPatchBody((req.body ?? {}) as Record<string, unknown>)
    : req.body;
  const parsed = patchUserCertificationSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid certification data.");
  }
  const file = (req as { file?: Express.Multer.File }).file;
  const clearCertificate = multipart ? readClearCertificateFlag((req.body ?? {}) as Record<string, unknown>) : false;
  const certification = await userCertificationsService.patch(user.id, id, parsed.data, {
    file,
    clearCertificate: clearCertificate || undefined,
  });
  res.json({ success: true, data: { certification }, message: "" });
};

export const downloadCertificationFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const id = parseId(req.params.id);
  const { stream, fileName, mimeType } = await userCertificationsService.openCertificateStream(id, user.id);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  stream.on("error", () => {
    if (!res.writableEnded) {
      res.end();
    }
  });
  stream.pipe(res);
};

export const deleteCertification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const id = parseId(req.params.id);
  await userCertificationsService.remove(user.id, id);
  res.json({ success: true, data: {}, message: "" });
};
