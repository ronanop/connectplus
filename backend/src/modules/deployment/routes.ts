import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireDepartmentAccess } from "../../middleware/departmentAccess";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createBalActivity,
  createKickoff,
  createSiteSurvey,
  createUatTestCase,
  getDeploymentWorkflow,
  goLive,
  listDeployments,
  listSiteSurveys,
  updateBalActivity,
  updateDeploymentStage,
  updateUatTestCase,
} from "./controller";
import {
  createBalActivitySchema,
  createKickoffSchema,
  createSiteSurveySchema,
  createUatTestCaseSchema,
  goLiveSchema,
  updateBalActivitySchema,
  updateDeploymentStageSchema,
  updateUatTestCaseSchema,
} from "./validation";

export const deploymentRouter = Router();

deploymentRouter.use(authenticate);
deploymentRouter.use(requireDepartmentAccess("deployment"));

deploymentRouter.get("/", asyncHandler(listDeployments));
deploymentRouter.get("/:id/workflow", asyncHandler(getDeploymentWorkflow));
deploymentRouter.patch("/:id/stage", validateRequest(updateDeploymentStageSchema), asyncHandler(updateDeploymentStage));
deploymentRouter.post("/:id/kickoff", validateRequest(createKickoffSchema), asyncHandler(createKickoff));
deploymentRouter.post("/:id/site-surveys", validateRequest(createSiteSurveySchema), asyncHandler(createSiteSurvey));
deploymentRouter.get("/:id/site-surveys", asyncHandler(listSiteSurveys));
deploymentRouter.post("/:id/bal-activities", validateRequest(createBalActivitySchema), asyncHandler(createBalActivity));
deploymentRouter.patch("/bal-activities/:activityId", validateRequest(updateBalActivitySchema), asyncHandler(updateBalActivity));
deploymentRouter.post("/:id/uat-test-cases", validateRequest(createUatTestCaseSchema), asyncHandler(createUatTestCase));
deploymentRouter.patch("/uat-test-cases/:testCaseId", validateRequest(updateUatTestCaseSchema), asyncHandler(updateUatTestCase));
deploymentRouter.post("/:id/go-live", validateRequest(goLiveSchema), asyncHandler(goLive));
