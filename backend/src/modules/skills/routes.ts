import { NextFunction, Request, Response, Router } from "express";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createCertification,
  createSkill,
  deleteCertification,
  deleteSkill,
  downloadCertificationFile,
  listMyCertifications,
  listMySkills,
  patchCertification,
  patchSkill,
} from "./controller";
import { isMultipartRequest } from "./certBody";
import { certificationCertificateUpload } from "./upload";
import {
  createUserSkillSchema,
  patchUserSkillSchema,
} from "./validators";

const certificationMultipartIfNeeded = (req: Request, res: Response, next: NextFunction) => {
  if (!isMultipartRequest(req)) {
    next();
    return;
  }
  certificationCertificateUpload.single("certificate")(req, res, err => {
    if (err) {
      next(err);
      return;
    }
    next();
  });
};

export const skillsRouter = Router();
skillsRouter.use(authenticate);
skillsRouter.get("/", asyncHandler(listMySkills));
skillsRouter.post("/", validateRequest(createUserSkillSchema), asyncHandler(createSkill));
skillsRouter.patch("/:id", validateRequest(patchUserSkillSchema), asyncHandler(patchSkill));
skillsRouter.delete("/:id", asyncHandler(deleteSkill));

export const certificationsRouter = Router();
certificationsRouter.use(authenticate);
certificationsRouter.get("/", asyncHandler(listMyCertifications));
certificationsRouter.get("/:id/certificate/file", asyncHandler(downloadCertificationFile));
certificationsRouter.post("/", certificationMultipartIfNeeded, asyncHandler(createCertification));
certificationsRouter.patch("/:id", certificationMultipartIfNeeded, asyncHandler(patchCertification));
certificationsRouter.delete("/:id", asyncHandler(deleteCertification));
