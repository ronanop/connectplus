import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { requireDepartmentAccess } from "../../middleware/departmentAccess";
import { validateRequest } from "../../middleware/validateRequest";
import { createCompanySchema, updateCompanySchema } from "./validation";
import { createCompany, deleteCompany, getCompany, listCompanies, updateCompany } from "./controller";

export const companiesRouter = Router();

companiesRouter.use(authenticate);
companiesRouter.use(requireDepartmentAccess("sales"));

companiesRouter.get("/", asyncHandler(listCompanies));
companiesRouter.get("/:id", asyncHandler(getCompany));
companiesRouter.post("/", validateRequest(createCompanySchema), asyncHandler(createCompany));
companiesRouter.patch("/:id", validateRequest(updateCompanySchema), asyncHandler(updateCompany));
companiesRouter.delete("/:id", asyncHandler(deleteCompany));
