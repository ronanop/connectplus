import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { listMyNotifications, markNotificationRead } from "./controller";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get("/", asyncHandler(listMyNotifications));
notificationsRouter.patch("/:id/read", asyncHandler(markNotificationRead));
