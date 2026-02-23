import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { superAdminService } from "./service";

export const listOverview = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const organizations = await superAdminService.listOverview();

  res.json({
    success: true,
    data: { organizations },
    message: "",
  });
};

export const getOrganization = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  const organization = await superAdminService.getOrganization(id);

  res.json({
    success: true,
    data: { organization },
    message: "",
  });
};

export const createOrganization = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await superAdminService.createOrganization(req.body);

  res.status(201).json({
    success: true,
    data: result,
    message: "",
  });
};

