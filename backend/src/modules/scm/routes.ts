import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireDepartmentAccess } from "../../middleware/departmentAccess";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createDeployment,
  createDispatch,
  createInvoice,
  createOvf,
  createScmExpense,
  createScmOrder,
  createWarehouseReceipt,
  getScmWorkflow,
  listScmOrders,
  updateScmStage,
} from "./controller";
import {
  createDeploymentSchema,
  createDispatchSchema,
  createInvoiceSchema,
  createOvfSchema,
  createScmExpenseSchema,
  createScmOrderSchema,
  createWarehouseReceiptSchema,
  updateScmStageSchema,
} from "./validation";

export const scmRouter = Router();

scmRouter.use(authenticate);
scmRouter.use(requireDepartmentAccess("scm"));

scmRouter.get("/opportunities/:id/workflow", asyncHandler(getScmWorkflow));
scmRouter.patch("/opportunities/:id/stage", validateRequest(updateScmStageSchema), asyncHandler(updateScmStage));
scmRouter.post("/opportunities/:id/ovf", validateRequest(createOvfSchema), asyncHandler(createOvf));
scmRouter.post("/opportunities/:id/orders", validateRequest(createScmOrderSchema), asyncHandler(createScmOrder));
scmRouter.get("/opportunities/:id/orders", asyncHandler(listScmOrders));
scmRouter.post("/orders/:orderId/warehouse-receipts", validateRequest(createWarehouseReceiptSchema), asyncHandler(createWarehouseReceipt));
scmRouter.post("/warehouse-receipts/:receiptId/dispatches", validateRequest(createDispatchSchema), asyncHandler(createDispatch));
scmRouter.post("/dispatches/:dispatchId/invoices", validateRequest(createInvoiceSchema), asyncHandler(createInvoice));
scmRouter.post("/dispatches/:dispatchId/deployments", validateRequest(createDeploymentSchema), asyncHandler(createDeployment));
scmRouter.post("/orders/:orderId/expenses", validateRequest(createScmExpenseSchema), asyncHandler(createScmExpense));
