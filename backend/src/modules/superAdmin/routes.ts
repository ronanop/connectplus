import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireRoles } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import { createOrganizationSchema } from "./validation";
import { createOrganization, getOrganization, listOverview } from "./controller";

export const superAdminRouter = Router();

superAdminRouter.use(authenticate);
superAdminRouter.use(requireRoles(["SUPER_ADMIN"]));

superAdminRouter.get("/overview", asyncHandler(listOverview));
superAdminRouter.get("/organizations/:id", asyncHandler(getOrganization));
superAdminRouter.post("/organizations", validateRequest(createOrganizationSchema), asyncHandler(createOrganization));

