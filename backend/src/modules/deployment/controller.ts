import { Response } from "express";
import { ApiError } from "../../middleware/errorHandler";
import { AuthenticatedRequest } from "../../types/auth";
import { deploymentService } from "./service";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

function getDeploymentId(req: AuthenticatedRequest) {
  return parseInt(req.params.id, 10);
}

export const listDeployments = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const deployments = await deploymentService.listDeployments();
  res.json({ success: true, data: { deployments }, message: "" });
};

export const getDeploymentWorkflow = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const workflow = await deploymentService.getWorkflow(getDeploymentId(req));
  res.json({ success: true, data: { workflow }, message: "" });
};

export const updateDeploymentStage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const result = await deploymentService.updateStage(getDeploymentId(req), req.body.stage, user.id, req.body.notes);
  res.json({ success: true, data: result, message: "" });
};

export const createKickoff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await deploymentService.createKickoff(getDeploymentId(req), req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const createSiteSurvey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await deploymentService.createSiteSurvey(getDeploymentId(req), req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const listSiteSurveys = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const records = await deploymentService.listSiteSurveys(getDeploymentId(req));
  res.json({ success: true, data: { records }, message: "" });
};

export const createBalActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await deploymentService.createBalActivity(getDeploymentId(req), req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const updateBalActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const activityId = parseInt(req.params.activityId, 10);
  const record = await deploymentService.updateBalActivity(activityId, req.body, user.id);
  res.json({ success: true, data: { record }, message: "" });
};

export const createUatTestCase = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await deploymentService.createUatTestCase(getDeploymentId(req), req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const updateUatTestCase = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const testCaseId = parseInt(req.params.testCaseId, 10);
  const record = await deploymentService.updateUatTestCase(testCaseId, req.body, user.id);
  res.json({ success: true, data: { record }, message: "" });
};

export const goLive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await deploymentService.goLive(getDeploymentId(req), req.body, user.id);
  res.json({ success: true, data: { record }, message: "" });
};
