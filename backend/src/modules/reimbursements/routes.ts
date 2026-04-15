import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireHrAccess } from "../../middleware/hrAccess";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  approveReimbursement,
  createReimbursement,
  denyReimbursement,
  downloadReimbursementAttachment,
  listMyReimbursements,
  listPendingReimbursements,
} from "./controller";
import { reimbursementBillUpload } from "./upload";
import { reviewReimbursementSchema } from "./validation";

export const reimbursementsRouter = Router();

reimbursementsRouter.use(authenticate);

reimbursementsRouter.post(
  "/",
  reimbursementBillUpload.array("files", 10),
  asyncHandler(createReimbursement),
);
reimbursementsRouter.get("/mine", asyncHandler(listMyReimbursements));
reimbursementsRouter.get("/pending", requireHrAccess, asyncHandler(listPendingReimbursements));

reimbursementsRouter.get("/:id/attachments/:attachmentId/file", asyncHandler(downloadReimbursementAttachment));

reimbursementsRouter.patch(
  "/:id/approve",
  requireHrAccess,
  validateRequest(reviewReimbursementSchema),
  asyncHandler(approveReimbursement),
);
reimbursementsRouter.patch(
  "/:id/deny",
  requireHrAccess,
  validateRequest(reviewReimbursementSchema),
  asyncHandler(denyReimbursement),
);
