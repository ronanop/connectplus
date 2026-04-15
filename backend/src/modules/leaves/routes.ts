import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireHrAccess } from "../../middleware/hrAccess";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  approveLeave,
  createLeave,
  denyLeave,
  listMyLeaves,
  listOrgHistoryLeaves,
  listPendingLeaves,
} from "./controller";
import { createLeaveSchema, orgHistoryQuerySchema, reviewLeaveSchema } from "./validation";

export const leavesRouter = Router();

leavesRouter.use(authenticate);

leavesRouter.post("/", validateRequest(createLeaveSchema), asyncHandler(createLeave));
leavesRouter.get("/mine", asyncHandler(listMyLeaves));

leavesRouter.get("/pending", requireHrAccess, asyncHandler(listPendingLeaves));
leavesRouter.get(
  "/org-history",
  requireHrAccess,
  validateRequest(orgHistoryQuerySchema, "query"),
  asyncHandler(listOrgHistoryLeaves),
);
leavesRouter.patch(
  "/:id/approve",
  requireHrAccess,
  validateRequest(reviewLeaveSchema),
  asyncHandler(approveLeave),
);
leavesRouter.patch(
  "/:id/deny",
  requireHrAccess,
  validateRequest(reviewLeaveSchema),
  asyncHandler(denyLeave),
);
