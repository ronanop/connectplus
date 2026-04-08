import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { getInbox, getEmail, markEmailAsRead } from "./controller";

export const inboxRouter = Router();

inboxRouter.use(authenticate);

inboxRouter.get("/", asyncHandler(getInbox));
inboxRouter.get("/:id", asyncHandler(getEmail));
inboxRouter.patch("/:id/read", asyncHandler(markEmailAsRead));
