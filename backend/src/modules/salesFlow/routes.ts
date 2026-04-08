import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireDepartmentAccess } from "../../middleware/departmentAccess";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  closeLost,
  closeWon,
  createClientQuote,
  createFollowUp,
  createOemAlignment,
  createPurchaseOrder,
  createVendorQuote,
  getWorkflow,
  listClientQuotes,
  listFollowUps,
  listOemAlignments,
  listVendorQuotes,
} from "./controller";
import {
  closeLostSchema,
  closeWonSchema,
  createClientFollowUpSchema,
  createClientQuoteSchema,
  createOemAlignmentSchema,
  createPurchaseOrderSchema,
  createVendorQuoteSchema,
} from "./validation";

export const salesFlowRouter = Router();

salesFlowRouter.use(authenticate);
salesFlowRouter.use(requireDepartmentAccess("sales"));

salesFlowRouter.get("/opportunities/:id/workflow", asyncHandler(getWorkflow));
salesFlowRouter.post("/opportunities/:id/oem-alignments", validateRequest(createOemAlignmentSchema), asyncHandler(createOemAlignment));
salesFlowRouter.get("/opportunities/:id/oem-alignments", asyncHandler(listOemAlignments));
salesFlowRouter.post("/opportunities/:id/vendor-quotes", validateRequest(createVendorQuoteSchema), asyncHandler(createVendorQuote));
salesFlowRouter.get("/opportunities/:id/vendor-quotes", asyncHandler(listVendorQuotes));
salesFlowRouter.post("/opportunities/:id/client-quotes", validateRequest(createClientQuoteSchema), asyncHandler(createClientQuote));
salesFlowRouter.get("/opportunities/:id/client-quotes", asyncHandler(listClientQuotes));
salesFlowRouter.post("/opportunities/:id/follow-ups", validateRequest(createClientFollowUpSchema), asyncHandler(createFollowUp));
salesFlowRouter.get("/opportunities/:id/follow-ups", asyncHandler(listFollowUps));
salesFlowRouter.post("/opportunities/:id/close-won", validateRequest(closeWonSchema), asyncHandler(closeWon));
salesFlowRouter.post("/opportunities/:id/close-lost", validateRequest(closeLostSchema), asyncHandler(closeLost));
salesFlowRouter.post("/opportunities/:id/purchase-orders", validateRequest(createPurchaseOrderSchema), asyncHandler(createPurchaseOrder));
