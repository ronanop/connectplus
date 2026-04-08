import { Response } from "express";
import { ApiError } from "../../middleware/errorHandler";
import { AuthenticatedRequest } from "../../types/auth";
import { salesFlowService } from "./service";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  return req.user;
}

function getOpportunityId(req: AuthenticatedRequest) {
  return parseInt(req.params.id, 10);
}

export const getWorkflow = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const workflow = await salesFlowService.getWorkflow(getOpportunityId(req));
  res.json({ success: true, data: { workflow }, message: "" });
};

export const createOemAlignment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const record = await salesFlowService.createOemAlignment(getOpportunityId(req), req.body);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const listOemAlignments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const records = await salesFlowService.listOemAlignments(getOpportunityId(req));
  res.json({ success: true, data: { records }, message: "" });
};

export const createVendorQuote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const record = await salesFlowService.createVendorQuote(getOpportunityId(req), req.body);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const listVendorQuotes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const records = await salesFlowService.listVendorQuotes(getOpportunityId(req));
  res.json({ success: true, data: { records }, message: "" });
};

export const createClientQuote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const record = await salesFlowService.createClientQuote(getOpportunityId(req), req.body);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const listClientQuotes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const records = await salesFlowService.listClientQuotes(getOpportunityId(req));
  res.json({ success: true, data: { records }, message: "" });
};

export const createFollowUp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const record = await salesFlowService.createFollowUp(getOpportunityId(req), req.body);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const listFollowUps = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const records = await salesFlowService.listFollowUps(getOpportunityId(req));
  res.json({ success: true, data: { records }, message: "" });
};

export const closeWon = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const opportunity = await salesFlowService.closeWon(getOpportunityId(req), user.id, req.body?.notes);
  res.json({ success: true, data: { opportunity }, message: "" });
};

export const closeLost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const opportunity = await salesFlowService.closeLost(
    getOpportunityId(req),
    user.id,
    req.body?.reason,
    req.body?.notes,
  );
  res.json({ success: true, data: { opportunity }, message: "" });
};

export const createPurchaseOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const record = await salesFlowService.createPurchaseOrder(getOpportunityId(req), req.body);
  res.status(201).json({ success: true, data: { record }, message: "" });
};
