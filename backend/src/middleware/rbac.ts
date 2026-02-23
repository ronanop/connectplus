import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/auth";
import { ApiError } from "./errorHandler";

export const requireRoles = (roles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "Forbidden");
    }

    next();
  };
};

