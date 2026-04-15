import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { reimbursementsService } from "./service";
import { createReimbursementBodySchema, listMineQuerySchema, type ReviewReimbursementInput } from "./validation";

export const createReimbursement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const files = req.files;
  const fileList = Array.isArray(files) ? files : files ? Object.values(files).flat() : [];
  const parsed = createReimbursementBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new ApiError(400, "Invalid expense date, amount, or notes.");
  }
  const claim = await reimbursementsService.create(req.user.id, parsed.data, fileList);
  res.status(201).json({ success: true, data: { claim }, message: "" });
};

export const listMyReimbursements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const parsed = listMineQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    throw new ApiError(400, "Invalid query parameters.");
  }
  const claims = await reimbursementsService.listMine(req.user.id, parsed.data);
  res.json({ success: true, data: { claims }, message: "" });
};

export const listPendingReimbursements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const claims = await reimbursementsService.listPendingForHr(req.user.id);
  res.json({ success: true, data: { claims }, message: "" });
};

export const approveReimbursement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid reimbursement id");
  }
  const body = req.body as ReviewReimbursementInput;
  const claim = await reimbursementsService.approve(id, req.user.id, body);
  res.json({ success: true, data: { claim }, message: "" });
};

export const denyReimbursement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid reimbursement id");
  }
  const body = req.body as ReviewReimbursementInput;
  const claim = await reimbursementsService.deny(id, req.user.id, body);
  res.json({ success: true, data: { claim }, message: "" });
};

export const downloadReimbursementAttachment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const claimId = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);
  if (!Number.isFinite(claimId) || claimId < 1 || !Number.isFinite(attachmentId) || attachmentId < 1) {
    throw new ApiError(400, "Invalid id");
  }
  const { stream, fileName, mimeType } = await reimbursementsService.openAttachmentStream(
    claimId,
    attachmentId,
    req.user.id,
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
