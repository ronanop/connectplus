import { Request } from "express";

export interface AuthUser {
  id: number;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

