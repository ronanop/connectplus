import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { leavesService } from "./service";
import type { CreateLeaveInput, OrgHistoryQuery, ReviewLeaveInput } from "./validation";

export const createLeave = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const body = req.body as CreateLeaveInput;
  const leave = await leavesService.create(req.user.id, body);
  res.status(201).json({ success: true, data: { leave }, message: "" });
};

export const listMyLeaves = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const leaves = await leavesService.listMine(req.user.id);
  res.json({ success: true, data: { leaves }, message: "" });
};

export const listPendingLeaves = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const leaves = await leavesService.listPendingForHr(req.user.id);
  res.json({ success: true, data: { leaves }, message: "" });
};

export const listOrgHistoryLeaves = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const query = req.query as unknown as OrgHistoryQuery;
  const data = await leavesService.listOrgHistoryForHr(req.user.id, query);
  res.json({ success: true, data, message: "" });
};

export const approveLeave = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid leave id");
  }
  const body = req.body as ReviewLeaveInput;
  const leave = await leavesService.approve(id, req.user.id, body);
  res.json({ success: true, data: { leave }, message: "" });
};

export const denyLeave = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid leave id");
  }
  const body = req.body as ReviewLeaveInput;
  const leave = await leavesService.deny(id, req.user.id, body);
  res.json({ success: true, data: { leave }, message: "" });
};
