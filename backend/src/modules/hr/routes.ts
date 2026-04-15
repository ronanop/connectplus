import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireHrAccess } from "../../middleware/hrAccess";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import { masterNameSchema } from "../settings/validation";
import {
  createCrmDepartment,
  deleteCrmDepartment,
  getHrUserProfile,
  hrDepartments,
  hrHealth,
  hrModules,
  listCrmDepartmentUsers,
  listCrmDepartments,
  updateCrmDepartment,
} from "./controller";

export const hrRouter = Router();

hrRouter.get("/health", asyncHandler(hrHealth));

hrRouter.use(authenticate);
hrRouter.use(requireHrAccess);

hrRouter.get("/modules", asyncHandler(hrModules));
hrRouter.get("/hr-departments", asyncHandler(hrDepartments));
hrRouter.get("/users/:id/profile", asyncHandler(getHrUserProfile));

hrRouter.get("/crm-departments", asyncHandler(listCrmDepartments));
hrRouter.get("/crm-departments/:id/users", asyncHandler(listCrmDepartmentUsers));
hrRouter.post("/crm-departments", validateRequest(masterNameSchema), asyncHandler(createCrmDepartment));
hrRouter.patch("/crm-departments/:id", validateRequest(masterNameSchema), asyncHandler(updateCrmDepartment));
hrRouter.delete("/crm-departments/:id", asyncHandler(deleteCrmDepartment));
