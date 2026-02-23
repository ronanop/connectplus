import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import { loginSchema } from "./validation";
import { login, logout, me } from "./controller";
import { authenticate } from "../../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", validateRequest(loginSchema), asyncHandler(login));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", authenticate, asyncHandler(me));

