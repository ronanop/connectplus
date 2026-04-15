import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireRoles } from "../../middleware/rbac";
import { hydrateAuthUserFromDb } from "../../middleware/hydrateAuthUserFromDb";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  deleteFaceDescriptor,
  getConfig,
  getFaceDescriptor,
  getFaceRegistrationCount,
  getMyAttendance,
  getMyToday,
  getTeam,
  getTeamHeatmap,
  getTodaySummary,
  postCheckIn,
  postCheckOut,
  postConfig,
  postFaceDescriptor,
  postFaceFailed,
  postOverride,
  postResetAllFaces,
  postVerifyGeo,
} from "./controller";

export const attendanceRouter = Router();

attendanceRouter.use(authenticate);
attendanceRouter.use(hydrateAuthUserFromDb);

attendanceRouter.post("/face-descriptor", asyncHandler(postFaceDescriptor));
attendanceRouter.get("/face-descriptor", asyncHandler(getFaceDescriptor));
attendanceRouter.delete(
  "/face-descriptor/:userId",
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  asyncHandler(deleteFaceDescriptor),
);

attendanceRouter.get("/config", asyncHandler(getConfig));
attendanceRouter.post("/config", requireRoles(["ADMIN", "SUPER_ADMIN"]), asyncHandler(postConfig));

attendanceRouter.post("/verify-geo", asyncHandler(postVerifyGeo));
attendanceRouter.post("/check-in", asyncHandler(postCheckIn));
attendanceRouter.post("/check-out", asyncHandler(postCheckOut));
attendanceRouter.post("/face-failed", asyncHandler(postFaceFailed));

attendanceRouter.get("/my", asyncHandler(getMyAttendance));
attendanceRouter.get("/my/today", asyncHandler(getMyToday));

attendanceRouter.get(
  "/team",
  requireRoles(["ADMIN", "SUPER_ADMIN", "MANAGEMENT"]),
  asyncHandler(getTeam),
);
attendanceRouter.get(
  "/team/heatmap",
  requireRoles(["ADMIN", "SUPER_ADMIN", "MANAGEMENT"]),
  asyncHandler(getTeamHeatmap),
);
attendanceRouter.get(
  "/today-summary",
  requireRoles(["ADMIN", "SUPER_ADMIN", "MANAGEMENT"]),
  asyncHandler(getTodaySummary),
);
attendanceRouter.post("/override", requireRoles(["ADMIN", "SUPER_ADMIN"]), asyncHandler(postOverride));
attendanceRouter.post(
  "/reset-all-face-descriptors",
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  asyncHandler(postResetAllFaces),
);
attendanceRouter.get(
  "/face-registration-count",
  requireRoles(["ADMIN", "SUPER_ADMIN"]),
  asyncHandler(getFaceRegistrationCount),
);
