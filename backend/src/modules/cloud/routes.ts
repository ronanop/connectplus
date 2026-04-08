import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireDepartmentAccess } from "../../middleware/departmentAccess";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createCloudEngagement,
  getCloudWorkflow,
  listCloudEngagements,
  saveCloudArchitecturePlan,
  saveCloudAssessment,
  saveCloudIntake,
  saveCloudManagedSupport,
  saveCloudMigration,
  saveCloudSecurityFramework,
  updateCloudStage,
} from "./controller";
import {
  createArchitecturePlanSchema,
  createAssessmentSchema,
  createCloudEngagementSchema,
  createIntakeSchema,
  createManagedSupportSchema,
  createMigrationSchema,
  createSecurityFrameworkSchema,
  updateCloudStageSchema,
} from "./validation";

export const cloudRouter = Router();

cloudRouter.use(authenticate);
cloudRouter.use(requireDepartmentAccess("cloud"));

cloudRouter.get("/", asyncHandler(listCloudEngagements));
cloudRouter.post("/", validateRequest(createCloudEngagementSchema), asyncHandler(createCloudEngagement));
cloudRouter.get("/:id/workflow", asyncHandler(getCloudWorkflow));
cloudRouter.patch("/:id/stage", validateRequest(updateCloudStageSchema), asyncHandler(updateCloudStage));
cloudRouter.post("/:id/intake", validateRequest(createIntakeSchema), asyncHandler(saveCloudIntake));
cloudRouter.post("/:id/assessment", validateRequest(createAssessmentSchema), asyncHandler(saveCloudAssessment));
cloudRouter.post("/:id/architecture-plan", validateRequest(createArchitecturePlanSchema), asyncHandler(saveCloudArchitecturePlan));
cloudRouter.post("/:id/security-framework", validateRequest(createSecurityFrameworkSchema), asyncHandler(saveCloudSecurityFramework));
cloudRouter.post("/:id/migration", validateRequest(createMigrationSchema), asyncHandler(saveCloudMigration));
cloudRouter.post("/:id/managed-support", validateRequest(createManagedSupportSchema), asyncHandler(saveCloudManagedSupport));
