import fs from "fs";
import path from "path";
import { Response } from "express";
import { AuthUser, AuthenticatedRequest } from "../../types/auth";
import { authService } from "./service";
import { prisma } from "../../prisma";
import { tagsFromJson } from "../../lib/tagsFromJson";
import { ApiError } from "../../middleware/errorHandler";
import { absolutePathFromStored, toStoredProfilePath } from "./profileUpload";
import { getSessionCookieMaxAgeMs } from "../../lib/sessionJwt";

export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  const { token, user } = await authService.login(email, password);

  res
    .cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: getSessionCookieMaxAgeMs(),
    })
    .json({
      success: true,
      data: { user },
      message: "",
    });
};

export const loginWithMicrosoftCallback = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const body = req.body as {
    accessToken?: string;
    code?: string;
    codeVerifier?: string;
    redirectUri?: string;
  };

  let result: { token: string; user: AuthUser };

  if (typeof body.accessToken === "string" && body.accessToken.trim()) {
    result = await authService.loginWithMicrosoftAccessToken(body.accessToken);
  } else {
    const { code, codeVerifier, redirectUri } = body;
    if (!code || !codeVerifier || !redirectUri) {
      res.status(400).json({
        success: false,
        data: null,
        message:
          "Send accessToken (from browser token exchange), or code + codeVerifier + redirectUri for confidential clients only.",
      });
      return;
    }
    result = await authService.loginWithMicrosoftAuthorizationCode(code, codeVerifier, redirectUri);
  }

  res
    .cookie("token", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: getSessionCookieMaxAgeMs(),
    })
    .json({
      success: true,
      data: { user: result.user },
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
      tagsJson: true,
      organizationId: true,
      reportsToId: true,
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
      _count: {
        select: { directReports: true },
      },
      faceDescriptor: true,
      faceEnrolledAt: true,
      profilePhotoPath: true,
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
        tags: tagsFromJson(user.tagsJson),
        role: user.role.name,
        organization: user.organization?.name,
        organizationId: user.organizationId,
        reportsToId: user.reportsToId,
        directReportCount: user._count.directReports,
        isManager: user._count.directReports > 0,
        hasFaceRegistered: user.faceDescriptor != null,
        faceEnrolledAt: user.faceEnrolledAt,
        profilePhotoUrl: user.profilePhotoPath ? "/api/auth/profile-photo" : null,
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

export const postProfilePhoto = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, data: null, message: "Unauthorized" });
    return;
  }
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }
  const existing = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { profilePhotoPath: true },
  });
  if (existing?.profilePhotoPath) {
    try {
      const abs = absolutePathFromStored(existing.profilePhotoPath);
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
      }
    } catch {
      /* ignore stale path */
    }
  }
  const stored = toStoredProfilePath(req.user.id, file.filename);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { profilePhotoPath: stored },
  });
  res.json({
    success: true,
    data: { profilePhotoUrl: "/api/auth/profile-photo" },
    message: "",
  });
};

export const getProfilePhoto = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, data: null, message: "Unauthorized" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { profilePhotoPath: true },
  });
  if (!user?.profilePhotoPath) {
    res.status(404).json({ success: false, data: null, message: "No profile photo" });
    return;
  }
  let abs: string;
  try {
    abs = absolutePathFromStored(user.profilePhotoPath);
  } catch {
    res.status(404).end();
    return;
  }
  if (!fs.existsSync(abs)) {
    res.status(404).end();
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "private, max-age=3600");
  fs.createReadStream(abs).pipe(res);
};

