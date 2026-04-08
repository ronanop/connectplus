import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { requireDepartmentAccess } from "../../middleware/departmentAccess";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createPresalesProject,
  advancePresalesStage,
  getPresalesStages,
  getRequirementDoc,
  upsertRequirementDoc,
  getPresalesProject,
  getPresalesSummary,
  listPresalesProjects,
  updatePresalesProject,
  convertPresalesProjectToOpportunity,
  upsertSolutionDesign,
  upsertBoq,
  submitBoq,
  upsertPoc,
  patchPocOutcome,
  upsertProposal,
  listBoqBoard,
  listPocBoard,
  listProposalBoard,
} from "./controller";
import {
  advancePresalesStageSchema,
  createPresalesProjectSchema,
  upsertRequirementDocSchema,
  updatePresalesProjectSchema,
  upsertBoqSchema,
  upsertPocSchema,
  upsertProposalSchema,
  upsertSolutionDesignSchema,
  patchPocOutcomeSchema,
} from "./validation";

export const presalesRouter = Router();

presalesRouter.use(authenticate);
presalesRouter.use(requireDepartmentAccess("presales"));

presalesRouter.get("/projects", asyncHandler(listPresalesProjects));
presalesRouter.get("/projects/summary", asyncHandler(getPresalesSummary));
presalesRouter.get("/projects/:id", asyncHandler(getPresalesProject));
presalesRouter.get("/projects/:id/stages", asyncHandler(getPresalesStages));
presalesRouter.post("/projects/:id/stages/advance", validateRequest(advancePresalesStageSchema), asyncHandler(advancePresalesStage));
presalesRouter.get("/projects/:id/requirements", asyncHandler(getRequirementDoc));
presalesRouter.put("/projects/:id/requirements", validateRequest(upsertRequirementDocSchema), asyncHandler(upsertRequirementDoc));
presalesRouter.put(
  "/projects/:id/solution",
  validateRequest(upsertSolutionDesignSchema),
  asyncHandler(upsertSolutionDesign),
);
presalesRouter.put("/projects/:id/boq", validateRequest(upsertBoqSchema), asyncHandler(upsertBoq));
presalesRouter.post("/projects/:id/boq/submit", asyncHandler(submitBoq));
presalesRouter.put("/projects/:id/poc", validateRequest(upsertPocSchema), asyncHandler(upsertPoc));
presalesRouter.patch(
  "/projects/:id/poc/outcome",
  validateRequest(patchPocOutcomeSchema),
  asyncHandler(patchPocOutcome),
);
presalesRouter.put(
  "/projects/:id/proposal",
  validateRequest(upsertProposalSchema),
  asyncHandler(upsertProposal),
);
presalesRouter.post(
  "/projects",
  validateRequest(createPresalesProjectSchema),
  asyncHandler(createPresalesProject),
);
presalesRouter.patch(
  "/projects/:id",
  validateRequest(updatePresalesProjectSchema),
  asyncHandler(updatePresalesProject),
);
presalesRouter.post(
  "/projects/:id/convert-to-opportunity",
  asyncHandler(convertPresalesProjectToOpportunity),
);

presalesRouter.get("/boq", asyncHandler(listBoqBoard));
presalesRouter.get("/poc", asyncHandler(listPocBoard));
presalesRouter.get("/proposals", asyncHandler(listProposalBoard));
