import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/auth";
import { ApiError } from "./errorHandler";
import { resolveAccessDepartmentNorm } from "./departmentAccess";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * `/api/dashboard/admin` — org-wide CRM analytics.
 * Admins and super-admins always; Sales and Presales users (by department) may view.
 */
export const requireDashboardAnalyticsAccess = asyncHandler(
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }
    if (req.user.role === "SUPER_ADMIN" || req.user.role === "ADMIN") {
      next();
      return;
    }
    const dept = await resolveAccessDepartmentNorm(req);
    if (dept === "sales" || dept === "presales") {
      next();
      return;
    }
    throw new ApiError(403, "Forbidden: dashboard analytics is available for Sales or Presales");
  },
);
