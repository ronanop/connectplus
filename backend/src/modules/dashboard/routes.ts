import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { requireDashboardAnalyticsAccess } from "../../middleware/dashboardAnalyticsAccess";
import { validateRequest } from "../../middleware/validateRequest";
import { dashboardPreferenceSchema } from "./validation";
import { getAdminDashboard, getPreferences, savePreferences } from "./controller";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get("/admin", requireDashboardAnalyticsAccess, asyncHandler(getAdminDashboard));
dashboardRouter.get("/preferences", asyncHandler(getPreferences));
dashboardRouter.post("/preferences", validateRequest(dashboardPreferenceSchema), asyncHandler(savePreferences));

