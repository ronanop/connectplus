import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { settingsService } from "./service";

export const listUsers = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const users = await settingsService.listUsers();
  res.json({ success: true, data: users, message: "" });
};

export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const created = await settingsService.createUser(req.body);
  res.status(201).json({ success: true, data: created, message: "" });
};

export const inviteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const created = await settingsService.inviteUserWithEmail(req.body);
  res.status(201).json({ success: true, data: created, message: "" });
};

export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const updated = await settingsService.updateUser(id, req.body);
  res.json({ success: true, data: updated, message: "" });
};

export const setUserOof = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = Number(req.params.id);
  const record = await settingsService.setUserOof(userId, req.body);
  res.status(201).json({ success: true, data: record, message: "" });
};

export const getCompanyProfile = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const profile = await settingsService.getCompanyProfile();
  res.json({ success: true, data: profile, message: "" });
};

export const upsertCompanyProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const profile = await settingsService.upsertCompanyProfile(req.body);
  res.json({ success: true, data: profile, message: "" });
};

export const getApprovalConfig = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const config = await settingsService.getApprovalConfig();
  res.json({ success: true, data: config, message: "" });
};

export const upsertApprovalConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const config = await settingsService.upsertApprovalConfig(req.body);
  res.json({ success: true, data: config, message: "" });
};

export const listRevenueTargets = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const targets = await settingsService.listRevenueTargets();
  res.json({ success: true, data: targets, message: "" });
};

export const upsertRevenueTarget = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const target = await settingsService.upsertRevenueTarget(req.body);
  res.status(201).json({ success: true, data: target, message: "" });
};

export const listNotificationPreferences = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const prefs = await settingsService.listNotificationPreferences();
  res.json({ success: true, data: prefs, message: "" });
};

export const createNotificationPreference = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pref = await settingsService.createNotificationPreference(req.body);
  res.status(201).json({ success: true, data: pref, message: "" });
};

export const listProducts = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const items = await settingsService.listProducts();
  res.json({ success: true, data: items, message: "" });
};

export const createProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const item = await settingsService.createProduct(req.body);
  res.status(201).json({ success: true, data: item, message: "" });
};

export const listDistributors = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const items = await settingsService.listDistributors();
  res.json({ success: true, data: items, message: "" });
};

export const createDistributor = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const item = await settingsService.createDistributor(req.body);
  res.status(201).json({ success: true, data: item, message: "" });
};

export const listIndustries = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const items = await settingsService.listIndustries();
  res.json({ success: true, data: items, message: "" });
};

export const createIndustry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const item = await settingsService.createIndustry(req.body);
  res.status(201).json({ success: true, data: item, message: "" });
};

export const listLeadSources = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const items = await settingsService.listLeadSources();
  res.json({ success: true, data: items, message: "" });
};

export const createLeadSource = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const item = await settingsService.createLeadSource(req.body);
  res.status(201).json({ success: true, data: item, message: "" });
};

export const listLossReasons = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const items = await settingsService.listLossReasons();
  res.json({ success: true, data: items, message: "" });
};

export const createLossReason = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const item = await settingsService.createLossReason(req.body);
  res.status(201).json({ success: true, data: item, message: "" });
};

export const listDepartments = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const items = await settingsService.listDepartments();
  res.json({ success: true, data: items, message: "" });
};

export const createDepartment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const item = await settingsService.createDepartment(req.body);
  res.status(201).json({ success: true, data: item, message: "" });
};

export const listSkillTags = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const items = await settingsService.listSkillTags();
  res.json({ success: true, data: items, message: "" });
};

export const createSkillTag = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const item = await settingsService.createSkillTag(req.body);
  res.status(201).json({ success: true, data: item, message: "" });
};
