import { NextFunction, Request, Response, Router } from "express";
import { authenticate } from "../../middleware/auth";
import { ApiError } from "../../middleware/errorHandler";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  addMember,
  createProject,
  downloadArtifact,
  getAccessMeta,
  getProject,
  listProjects,
  patchProject,
  patchStatus,
  postArtifact,
  postJournalArtifact,
  postJournalEntry,
  removeMember,
} from "./controller";
import { portfolioProjectArtifactUpload } from "./upload";
import {
  addPortfolioMemberSchema,
  createPortfolioProjectSchema,
  listPortfolioQuerySchema,
  patchPortfolioProjectSchema,
  patchPortfolioStatusSchema,
  postJournalEntrySchema,
} from "./validators";

export const portfolioProjectsRouter = Router();

function singleArtifactUpload(req: Request, res: Response, next: NextFunction) {
  portfolioProjectArtifactUpload.single("file")(req, res, err => {
    if (err) {
      next(err instanceof Error ? new ApiError(400, err.message) : err);
      return;
    }
    next();
  });
}

portfolioProjectsRouter.use(authenticate);

portfolioProjectsRouter.get("/access", asyncHandler(getAccessMeta));
portfolioProjectsRouter.get("/", validateRequest(listPortfolioQuerySchema, "query"), asyncHandler(listProjects));
portfolioProjectsRouter.post("/", validateRequest(createPortfolioProjectSchema), asyncHandler(createProject));
portfolioProjectsRouter.post(
  "/:id/journal-entries",
  validateRequest(postJournalEntrySchema),
  asyncHandler(postJournalEntry),
);
portfolioProjectsRouter.post(
  "/:id/journal-entries/:journalId/artifacts",
  singleArtifactUpload,
  asyncHandler(postJournalArtifact),
);
portfolioProjectsRouter.get(
  "/:id/artifacts/:artifactId/file",
  asyncHandler(downloadArtifact),
);
portfolioProjectsRouter.post("/:id/artifacts", singleArtifactUpload, asyncHandler(postArtifact));
portfolioProjectsRouter.patch(
  "/:id/status",
  validateRequest(patchPortfolioStatusSchema),
  asyncHandler(patchStatus),
);
portfolioProjectsRouter.post(
  "/:id/members",
  validateRequest(addPortfolioMemberSchema),
  asyncHandler(addMember),
);
portfolioProjectsRouter.delete("/:id/members/:userId", asyncHandler(removeMember));
portfolioProjectsRouter.patch(
  "/:id",
  validateRequest(patchPortfolioProjectSchema),
  asyncHandler(patchProject),
);
portfolioProjectsRouter.get("/:id", asyncHandler(getProject));
