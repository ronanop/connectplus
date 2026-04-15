import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import {
  deleteEmail,
  forwardEmail,
  getEmail,
  getInbox,
  listAttachments,
  markEmailAsRead,
  moveEmail,
  replyAllEmail,
  replyEmail,
  saveDraft,
  sendNewMail,
} from "./controller";
import {
  createDraftBodySchema,
  forwardBodySchema,
  moveBodySchema,
  replyBodySchema,
  sendMailBodySchema,
} from "./validation";

export const inboxRouter = Router();

inboxRouter.use(authenticate);

inboxRouter.get("/", asyncHandler(getInbox));
inboxRouter.post("/compose/send", validateRequest(sendMailBodySchema), asyncHandler(sendNewMail));
inboxRouter.post("/compose/draft", validateRequest(createDraftBodySchema), asyncHandler(saveDraft));
inboxRouter.patch("/:id/read", asyncHandler(markEmailAsRead));
inboxRouter.get("/:id/attachments", asyncHandler(listAttachments));
inboxRouter.post("/:id/reply", validateRequest(replyBodySchema), asyncHandler(replyEmail));
inboxRouter.post("/:id/replyAll", validateRequest(replyBodySchema), asyncHandler(replyAllEmail));
inboxRouter.post("/:id/forward", validateRequest(forwardBodySchema), asyncHandler(forwardEmail));
inboxRouter.post("/:id/move", validateRequest(moveBodySchema), asyncHandler(moveEmail));
inboxRouter.delete("/:id", asyncHandler(deleteEmail));
inboxRouter.get("/:id", asyncHandler(getEmail));
