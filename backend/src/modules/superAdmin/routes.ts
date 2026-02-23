import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import { createOrganizationSchema } from "./validation";
import { createOrganization, getOrganization, listOverview } from "./controller";

export const superAdminRouter = Router();

superAdminRouter.use(authenticate);

superAdminRouter.get("/overview", asyncHandler(listOverview));
superAdminRouter.get("/organizations/:id", asyncHandler(getOrganization));
superAdminRouter.post("/organizations", validateRequest(createOrganizationSchema), asyncHandler(createOrganization));

