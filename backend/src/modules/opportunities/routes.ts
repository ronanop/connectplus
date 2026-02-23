import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { requireRoles } from "../../middleware/rbac";
import { deleteOpportunity, getOpportunity, listOpportunities } from "./controller";

export const opportunitiesRouter = Router();

opportunitiesRouter.use(authenticate);

opportunitiesRouter.get("/", asyncHandler(listOpportunities));
opportunitiesRouter.get("/:id", asyncHandler(getOpportunity));
opportunitiesRouter.delete("/:id", requireRoles(["ADMIN", "SUPER_ADMIN"]), asyncHandler(deleteOpportunity));
