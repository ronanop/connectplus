import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import { loginSchema } from "./validation";
import {
  getProfilePhoto,
  login,
  logout,
  me,
  loginWithMicrosoftCallback,
  postProfilePhoto,
} from "./controller";
import { authenticate } from "../../middleware/auth";
import { ApiError } from "../../middleware/errorHandler";
import { profilePhotoUpload } from "./profileUpload";

export const authRouter = Router();

authRouter.post("/login", validateRequest(loginSchema), asyncHandler(login));
authRouter.post("/login/microsoft/callback", asyncHandler(loginWithMicrosoftCallback));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", authenticate, asyncHandler(me));
authRouter.get("/profile-photo", authenticate, asyncHandler(getProfilePhoto));

const singleProfilePhoto = profilePhotoUpload.single("photo");
authRouter.post("/profile-photo", authenticate, (req, res, next) => {
  singleProfilePhoto(req, res, err => {
    if (err) {
      next(err instanceof Error ? new ApiError(400, err.message) : new ApiError(400, "Upload failed"));
      return;
    }
    next();
  });
}, asyncHandler(postProfilePhoto));

