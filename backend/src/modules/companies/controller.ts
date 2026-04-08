import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { companiesService } from "./service";
import { listCompaniesQuerySchema } from "./validation";

export const listCompanies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = listCompaniesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, message: "Invalid query" });
    return;
  }
  const result = await companiesService.listCompanies({
    search: parsed.data.search,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  });
  res.json({ success: true, data: result, message: "" });
};

export const getCompany = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, data: null, message: "Invalid id" });
    return;
  }
  const company = await companiesService.getCompanyById(id);
  if (!company) {
    res.status(404).json({ success: false, data: null, message: "Company not found" });
    return;
  }
  res.json({ success: true, data: company, message: "" });
};

export const createCompany = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const created = await companiesService.createCompany(req.body, userId);
  res.status(201).json({ success: true, data: created, message: "" });
};

export const updateCompany = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const updated = await companiesService.updateCompany(id, req.body);
  res.json({ success: true, data: updated, message: "" });
};

export const deleteCompany = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const result = await companiesService.deleteCompany(id);
  res.json({ success: true, data: result, message: "" });
};
