import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth";
import { requireRoles } from "../../middleware/rbac";
import { validateRequest } from "../../middleware/validateRequest";
import { apiFetchRequestSchema } from "./validation";
import { executeApiFetch, listApiFetchSessions } from "./controller";

export const integrationsRouter = Router();

integrationsRouter.use(authenticate);

integrationsRouter.post(
  "/fetch",
  requireRoles(["SUPER_ADMIN", "ADMIN"]),
  validateRequest(apiFetchRequestSchema),
  asyncHandler(executeApiFetch),
);

integrationsRouter.get(
  "/fetch/sessions",
  requireRoles(["SUPER_ADMIN", "ADMIN"]),
  asyncHandler(listApiFetchSessions),
);
