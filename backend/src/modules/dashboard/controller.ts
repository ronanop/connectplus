import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { dashboardService } from "./service";

export const getAdminDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await dashboardService.getAdminSummary();
  res.json({
    success: true,
    data,
    message: "",
  });
};

export const getPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, data: null, message: "Unauthorized" });
    return;
  }

  const config = await dashboardService.getPreferences(req.user.id);
  res.json({
    success: true,
    data: { config },
    message: "",
  });
};

export const savePreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, data: null, message: "Unauthorized" });
    return;
  }

  const config = await dashboardService.savePreferences(req.user.id, req.body.config as Record<string, unknown>);
  res.status(201).json({
    success: true,
    data: { config },
    message: "",
  });
};

