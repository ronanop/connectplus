import { NextFunction, Response } from "express";
import { prisma } from "../prisma";
import { AuthenticatedRequest } from "../types/auth";
import { ApiError } from "./errorHandler";
import { asyncHandler } from "../utils/asyncHandler";
import { userHasHrAccess } from "../lib/hrAccess";
import { tagsFromJson } from "../lib/tagsFromJson";

/**
 * After `authenticate`. Resolves department + tags from DB so HR access matches
 * Settings (e.g. "HR Department", tag "HR") even if JWT is stale.
 */
export const requireHrAccess = asyncHandler(
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }

    const row = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        department: true,
        tagsJson: true,
        role: { select: { name: true } },
      },
    });

    if (!row) {
      throw new ApiError(401, "Unauthorized");
    }

    const tags = tagsFromJson(row.tagsJson);
    if (
      !userHasHrAccess({
        role: row.role.name,
        department: row.department,
        tags,
      })
    ) {
      throw new ApiError(403, "Forbidden: HR module is not available for your account");
    }

    next();
  },
);
