import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { authService } from "./service";

export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  const { token, user } = await authService.login(email, password);

  res
    .cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
    })
    .json({
      success: true,
      data: { user },
      message: "",
    });
};

export const me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, data: null, message: "Unauthorized" });
    return;
  }

  res.json({
    success: true,
    data: { user: req.user },
    message: "",
  });
};

export const logout = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.clearCookie("token").json({
    success: true,
    data: null,
    message: "",
  });
};

