import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, AuthUser } from "../types/auth";
import { ApiError } from "./errorHandler";

export const authenticate = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const token = req.cookies?.token;

  if (!token) {
    throw new ApiError(401, "Unauthorized");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(500, "JWT secret not configured");
  }

  try {
    const payload = jwt.verify(token, secret) as AuthUser;
    req.user = payload;
  } catch {
    throw new ApiError(401, "Unauthorized");
  }

  next();
};
