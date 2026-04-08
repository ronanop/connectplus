import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { authService } from "./service";
import { prisma } from "../../prisma";

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

export const loginWithMicrosoftCallback = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { code, codeVerifier, redirectUri } = req.body as { code: string; codeVerifier: string; redirectUri: string };

  if (!code || !codeVerifier || !redirectUri) {
    res.status(400).json({
      success: false,
      data: null,
      message: "Authorization code, code verifier, and redirect URI are required",
    });
    return;
  }

  const { token, user } = await authService.loginWithMicrosoftCallback(code, codeVerifier, redirectUri);

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

  // Fetch full user details from database
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      role: {
        select: {
          name: true,
        },
      },
      organization: {
        select: {
          name: true,
          code: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ success: false, data: null, message: "User not found" });
    return;
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role.name,
        organization: user.organization?.name,
      },
    },
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

