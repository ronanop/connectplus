import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { apiFetcherService } from "./apiFetcherService";
import { apiFetchRequestSchema } from "./validation";
import { ApiError } from "../../middleware/errorHandler";

export const executeApiFetch = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const parsed = apiFetchRequestSchema.parse(req.body);

  const session = await apiFetcherService.executeFetch({
    userId: req.user.id,
    name: parsed.name,
    url: parsed.url,
    method: parsed.method,
    headers: parsed.headers,
    body: parsed.body,
  });

  res.json({
    success: true,
    data: { session },
    message: "",
  });
};

export const listApiFetchSessions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  const sessions = await apiFetcherService.listSessions(req.user.id);

  res.json({
    success: true,
    data: { sessions },
    message: "",
  });
};
