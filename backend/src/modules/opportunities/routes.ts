import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { requireDepartmentAccess } from "../../middleware/departmentAccess";
import { requireRoles } from "../../middleware/rbac";
import { validateRequest } from "../../middleware/validateRequest";
import { deleteOpportunity, getOpportunity, listOpportunities, updateOpportunityStage } from "./controller";
import { updateOpportunityStageSchema } from "./validation";

export const opportunitiesRouter = Router();

opportunitiesRouter.use(authenticate);
opportunitiesRouter.use(requireDepartmentAccess("sales"));

opportunitiesRouter.get("/", asyncHandler(listOpportunities));
opportunitiesRouter.get("/:id", asyncHandler(getOpportunity));
opportunitiesRouter.patch("/:id/stage", validateRequest(updateOpportunityStageSchema), asyncHandler(updateOpportunityStage));
opportunitiesRouter.delete("/:id", requireRoles(["ADMIN", "SUPER_ADMIN"]), asyncHandler(deleteOpportunity));
