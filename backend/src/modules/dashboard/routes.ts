import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { requireRoles } from "../../middleware/rbac";
import { validateRequest } from "../../middleware/validateRequest";
import { dashboardPreferenceSchema } from "./validation";
import { getAdminDashboard, getPreferences, savePreferences } from "./controller";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get("/admin", requireRoles(["ADMIN", "SUPER_ADMIN"]), asyncHandler(getAdminDashboard));
dashboardRouter.get("/preferences", asyncHandler(getPreferences));
dashboardRouter.post("/preferences", validateRequest(dashboardPreferenceSchema), asyncHandler(savePreferences));

