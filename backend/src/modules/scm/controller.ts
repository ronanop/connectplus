import { Response } from "express";
import { ApiError } from "../../middleware/errorHandler";
import { AuthenticatedRequest } from "../../types/auth";
import { scmService } from "./service";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

function getOpportunityId(req: AuthenticatedRequest) {
  return parseInt(req.params.id, 10);
}

export const getScmWorkflow = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const workflow = await scmService.getWorkflow(getOpportunityId(req));
  res.json({ success: true, data: { workflow }, message: "" });
};

export const updateScmStage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const result = await scmService.updateStage(getOpportunityId(req), req.body.stage, user.id, req.body.notes);
  res.json({ success: true, data: result, message: "" });
};

export const createOvf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await scmService.createOvf(getOpportunityId(req), req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const createScmOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const record = await scmService.createOrder(getOpportunityId(req), req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const listScmOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const records = await scmService.listOrders(getOpportunityId(req));
  res.json({ success: true, data: { records }, message: "" });
};

export const createWarehouseReceipt = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orderId = parseInt(req.params.orderId, 10);
  const record = await scmService.createWarehouseReceipt(orderId, req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const createDispatch = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const receiptId = parseInt(req.params.receiptId, 10);
  const record = await scmService.createDispatch(receiptId, req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const createInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const dispatchId = parseInt(req.params.dispatchId, 10);
  const record = await scmService.createInvoice(dispatchId, req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const createDeployment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const dispatchId = parseInt(req.params.dispatchId, 10);
  const record = await scmService.createDeployment(dispatchId, req.body, user.id);
  res.status(201).json({ success: true, data: { record }, message: "" });
};

export const createScmExpense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const record = await scmService.createExpense(orderId, req.body);
  res.status(201).json({ success: true, data: { record }, message: "" });
};
