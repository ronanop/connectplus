import { Response } from "express";
import { ApiError } from "../../middleware/errorHandler";
import { AuthenticatedRequest } from "../../types/auth";
import { cloudService } from "./service";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

function getCloudId(req: AuthenticatedRequest) {
  return parseInt(req.params.id, 10);
}

export const listCloudEngagements = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const items = await cloudService.listCloudEngagements();
  res.json({ success: true, data: { items }, message: "" });
};

export const createCloudEngagement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await cloudService.createCloudEngagement(req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const getCloudWorkflow = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const workflow = await cloudService.getWorkflow(getCloudId(req));
  res.json({ success: true, data: { workflow }, message: "" });
};

export const updateCloudStage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await cloudService.updateStage(getCloudId(req), req.body.stage, user.id, req.body.notes);
  res.json({ success: true, data: { record }, message: "" });
};

export const saveCloudIntake = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await cloudService.saveIntake(getCloudId(req), req.body, user.id);
  res.json({ success: true, data: { record }, message: "" });
};

export const saveCloudAssessment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await cloudService.saveAssessment(getCloudId(req), req.body, user.id);
  res.json({ success: true, data: { record }, message: "" });
};

export const saveCloudArchitecturePlan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await cloudService.saveArchitecturePlan(getCloudId(req), req.body, user.id);
  res.json({ success: true, data: { record }, message: "" });
};

export const saveCloudSecurityFramework = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await cloudService.saveSecurityFramework(getCloudId(req), req.body, user.id);
  res.json({ success: true, data: { record }, message: "" });
};

export const saveCloudMigration = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await cloudService.saveMigration(getCloudId(req), req.body, user.id);
  res.json({ success: true, data: { record }, message: "" });
};

export const saveCloudManagedSupport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await cloudService.saveManagedSupport(getCloudId(req), req.body, user.id);
  res.json({ success: true, data: { record }, message: "" });
};
