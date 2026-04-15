import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { settingsService } from "../settings/service";
import { hrService } from "./service";

export const hrHealth = async (_req: Request, res: Response): Promise<void> => {
  res.json({ success: true, data: { status: "ok" }, message: "" });
};

export const hrModules = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({ success: true, data: { modules: hrService.listModules() }, message: "" });
};

export const hrDepartments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, data: null, message: "Unauthorized" });
    return;
  }
  const orgId = await hrService.getOrganizationIdForUser(req.user.id);
  if (!orgId) {
    res.json({
      success: true,
      data: { departments: [], organizationId: null },
      message: "No organization assigned.",
    });
    return;
  }
  const departments = await hrService.listHrDepartments(orgId);
  res.json({ success: true, data: { departments, organizationId: orgId }, message: "" });
};

/** CRM master departments (same data as Settings → Users department list). */
export const listCrmDepartments = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const departments = await settingsService.listDepartmentsWithEmployeeCounts();
  res.json({ success: true, data: { departments }, message: "" });
};

export const listCrmDepartmentUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid department id");
  }
  const users = await settingsService.listUsersForCrmDepartment(id);
  res.json({ success: true, data: { users }, message: "" });
};

export const getHrUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid user id");
  }
  const user = await settingsService.getUserProfileForHr(id);
  res.json({ success: true, data: { user }, message: "" });
};

export const createCrmDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const body = req.body as { name: string };
  const department = await settingsService.createDepartment(body);
  res.status(201).json({ success: true, data: { department }, message: "" });
};

export const updateCrmDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid department id");
  }
  const body = req.body as { name: string };
  const department = await settingsService.updateDepartment(id, body);
  res.json({ success: true, data: { department }, message: "" });
};

export const deleteCrmDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid department id");
  }
  await settingsService.deleteDepartment(id);
  res.json({ success: true, data: null, message: "" });
};
