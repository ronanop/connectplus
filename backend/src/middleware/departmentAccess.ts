import { NextFunction, Response } from "express";
import { prisma } from "../prisma";
import { AuthenticatedRequest } from "../types/auth";
import { ApiError } from "./errorHandler";
import { asyncHandler } from "../utils/asyncHandler";

/** Aligns with Settings → department names and frontend `accessControl.ts` */
export type DepartmentArea = "sales" | "presales" | "scm" | "deployment" | "cloud";

export function normalizeDepartmentName(d: string | null | undefined): string {
  return (d ?? "").trim().toLowerCase();
}

/**
 * Resolves department once per request: prefers JWT (`req.user.department`),
 * falls back to DB for legacy tokens without `department` in the payload.
 * Caches normalized value on `req` for subsequent checks in the same request.
 */
export async function resolveAccessDepartmentNorm(req: AuthenticatedRequest): Promise<string> {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  if (req.accessDepartmentResolved) {
    return req.accessDepartmentNorm ?? "";
  }
  req.accessDepartmentResolved = true;

  const fromJwt = normalizeDepartmentName(req.user.department);
  if (fromJwt) {
    req.accessDepartmentNorm = fromJwt;
    return fromJwt;
  }

  const row = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { department: true },
  });
  const fromDb = normalizeDepartmentName(row?.department);
  req.accessDepartmentNorm = fromDb;
  return fromDb;
}

/**
 * After `authenticate`. SUPER_ADMIN may access any module.
 * Other roles (including ADMIN) must have `user.department` matching the module area.
 */
export function requireDepartmentAccess(area: DepartmentArea) {
  return asyncHandler(async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }
    if (req.user.role === "SUPER_ADMIN") {
      next();
      return;
    }

    const dept = await resolveAccessDepartmentNorm(req);
    if (!dept) {
      throw new ApiError(403, "Forbidden: no department assigned for this module");
    }
    if (dept !== area) {
      throw new ApiError(403, "Forbidden: this module is not available for your department");
    }
    next();
  });
}
