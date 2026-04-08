import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { requireDepartmentAccess } from "../../middleware/departmentAccess";
import { validateRequest } from "../../middleware/validateRequest";
import { addLeadNoteSchema, createLeadSchema, sendLeadEmailSchema, updateLeadSchema, updateLeadStatusSchema } from "./validation";
import {
  convertLeadToOpportunity,
  createLead,
  getLead,
  getPipelineSummary,
  listLeads,
  patchLead,
  addLeadNote,
  sendLeadEmail,
  getLeadTimeline,
  getLeadActivities,
  convertLead,
  updateLeadStatus,
} from "./controller";

export const leadsRouter = Router();

leadsRouter.use(authenticate);
leadsRouter.use(requireDepartmentAccess("sales"));

leadsRouter.get("/", asyncHandler(listLeads));
leadsRouter.get("/pipeline", asyncHandler(getPipelineSummary));
leadsRouter.get("/:id", asyncHandler(getLead));
leadsRouter.post("/", validateRequest(createLeadSchema), asyncHandler(createLead));
leadsRouter.patch("/:id/status", validateRequest(updateLeadStatusSchema), asyncHandler(updateLeadStatus));
leadsRouter.post("/:id/convert-to-opportunity", asyncHandler(convertLeadToOpportunity));

leadsRouter.patch("/:id", validateRequest(updateLeadSchema), asyncHandler(patchLead));
leadsRouter.post("/:id/notes", validateRequest(addLeadNoteSchema), asyncHandler(addLeadNote));
leadsRouter.post("/:id/email", validateRequest(sendLeadEmailSchema), asyncHandler(sendLeadEmail));
leadsRouter.get("/:id/timeline", asyncHandler(getLeadTimeline));
leadsRouter.get("/:id/activities", asyncHandler(getLeadActivities));
leadsRouter.post("/:id/convert", asyncHandler(convertLead));
