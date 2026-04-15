import { Response } from "express";
import type { AttendanceStatus } from "../../generated/prisma";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import * as attendanceService from "./service";
import {
  checkInSchema,
  checkOutSchema,
  configSchema,
  manualOverrideSchema,
  saveFaceDescriptorSchema,
  teamAttendanceQuerySchema,
  verifyGeoSchema,
} from "./validators";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

export const postFaceDescriptor = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const body = saveFaceDescriptorSchema.parse(req.body);
  await attendanceService.saveFaceDescriptor(user.id, body.descriptor);
  res.json({ success: true, data: null, message: "" });
};

export const getFaceDescriptor = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const targetUserId = req.query.userId ? parseInt(String(req.query.userId), 10) : undefined;
  if (targetUserId !== undefined && !Number.isFinite(targetUserId)) {
    throw new ApiError(400, "Invalid userId");
  }
  const data = await attendanceService.getFaceDescriptor(user.id, user.role, targetUserId);
  res.json({ success: true, data, message: "" });
};

export const deleteFaceDescriptor = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const targetUserId = parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetUserId)) {
    throw new ApiError(400, "Invalid user id");
  }
  await attendanceService.resetFaceDescriptor(user.id, targetUserId);
  res.json({ success: true, data: null, message: "" });
};

export const getConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const config = await attendanceService.getConfig(orgId);
  res.json({ success: true, data: { config }, message: "" });
};

export const postConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const body = configSchema.parse(req.body);
  const config = await attendanceService.saveConfig(orgId, body);
  res.json({ success: true, data: { config }, message: "" });
};

export const postVerifyGeo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const body = verifyGeoSchema.parse(req.body);
  const result = await attendanceService.verifyGeo(user.id, orgId, body.lat, body.lng);
  res.json({ success: true, data: result, message: "" });
};

export const postCheckIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const body = checkInSchema.parse(req.body);
  const attendance = await attendanceService.checkIn(user.id, orgId, body);
  res.status(201).json({ success: true, data: { attendance }, message: "" });
};

export const postCheckOut = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const body = checkOutSchema.parse(req.body);
  const attendance = await attendanceService.checkOut(user.id, orgId, body);
  res.json({ success: true, data: { attendance }, message: "" });
};

export const postFaceFailed = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const attendance = await attendanceService.recordFaceFailed(user.id, orgId);
  res.json({ success: true, data: { attendance }, message: "" });
};

export const getMyAttendance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const month = req.query.month ? String(req.query.month) : undefined;
  const records = await attendanceService.getMyAttendance(user.id, orgId, month);
  res.json({ success: true, data: { records }, message: "" });
};

export const getMyToday = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const attendance = await attendanceService.getTodayAttendance(user.id, orgId);
  res.json({ success: true, data: { attendance }, message: "" });
};

export const getTeam = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const q = teamAttendanceQuerySchema.parse(req.query);
  const result = await attendanceService.getTeamAttendance(orgId, {
    date: q.date,
    month: q.month,
    department: q.department,
    status: q.status as AttendanceStatus | undefined,
    userId: q.userId,
    search: q.search,
    page: q.page,
    pageSize: q.pageSize,
  });
  res.json({ success: true, data: result, message: "" });
};

export const getTodaySummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const summary = await attendanceService.getTodaySummary(orgId);
  res.json({ success: true, data: { summary }, message: "" });
};

export const postOverride = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const body = manualOverrideSchema.parse(req.body);
  const attendance = await attendanceService.manualOverride(user.id, orgId, body);
  res.json({ success: true, data: { attendance }, message: "" });
};

export const postResetAllFaces = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const result = await attendanceService.resetAllFaceDescriptorsForOrg(orgId);
  res.json({ success: true, data: result, message: "" });
};

export const getFaceRegistrationCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const count = await attendanceService.countFaceRegisteredInOrg(orgId);
  res.json({ success: true, data: { count }, message: "" });
};

export const getTeamHeatmap = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const orgId = attendanceService.requireOrgId(user.organizationId);
  const month = req.query.month ? String(req.query.month) : "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new ApiError(400, "month query (YYYY-MM) is required");
  }
  const rows = await attendanceService.getTeamAttendanceForHeatmap(orgId, month);
  res.json({ success: true, data: { rows }, message: "" });
};
