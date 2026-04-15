import { NextFunction, Response } from "express";
import { prisma } from "../prisma";
import { AuthenticatedRequest } from "../types/auth";
import { ApiError } from "./errorHandler";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * After `authenticate`. Overwrites JWT `role` and `department` from the DB so
 * `requireRoles` matches Settings / auth/me (JWT is only refreshed on login).
 */
export const hydrateAuthUserFromDb = asyncHandler(
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }

    const row = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        isActive: true,
        department: true,
        organizationId: true,
        role: true,
      },
    });

    if (!row || !row.isActive || !row.role) {
      throw new ApiError(401, "Unauthorized");
    }

    req.user.role = row.role.name;
    req.user.department = row.department ?? null;
    req.user.organizationId = row.organizationId ?? null;
    next();
  },
);
