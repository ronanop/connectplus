import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { leadsService } from "./service";
import { leadTimelineQuerySchema, listLeadsQuerySchema } from "./validation";

export const listLeads = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = listLeadsQuerySchema.parse(req.query);

  const result = await leadsService.listLeads({
    search: parsed.search,
    status: parsed.status,
    page: parsed.page,
    pageSize: parsed.pageSize,
  });

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const createLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const payload = req.body as any;

  const lead = await leadsService.createLead(payload);

  res.status(201).json({
    success: true,
    data: { lead },
    message: "",
  });
};

export const getLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  const lead = await leadsService.getLeadById(id);

  res.json({
    success: true,
    data: { lead },
    message: "",
  });
};

export const updateLeadStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body as { status: string };

  const userId = req.user?.id ?? null;
  const lead = await leadsService.updateLeadStatus(id, status, userId);

  res.json({
    success: true,
    data: { lead },
    message: "",
  });
};

export const getPipelineSummary = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const stages = await leadsService.getPipelineSummary();

  res.json({
    success: true,
    data: { stages },
    message: "",
  });
};

export const convertLeadToOpportunity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  const userId = req.user?.id ?? null;
  const result = await leadsService.convertLeadToOpportunity(id, userId);

  res.status(201).json({
    success: true,
    data: result,
    message: "",
  });
};

export const patchLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const payload = req.body as any;
  const userId = req.user?.id ?? null;

  const lead = await leadsService.updateLead(id, payload, userId);

  res.json({
    success: true,
    data: { lead },
    message: "",
  });
};

export const addLeadNote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { body } = req.body as { body: string };
  const userId = req.user?.id ?? null;

  const note = await leadsService.addNote(id, body, userId);

  res.status(201).json({
    success: true,
    data: { note },
    message: "",
  });
};

export const sendLeadEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const payload = req.body as { to: string; subject: string; body: string };
  const userId = req.user?.id ?? null;

  const email = await leadsService.sendEmail(id, payload, userId);

  res.status(201).json({
    success: true,
    data: { email },
    message: "",
  });
};

export const getLeadTimeline = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const parsed = leadTimelineQuerySchema.parse(req.query);

  const timeline = await leadsService.getTimeline(id, {
    type: parsed.type,
    page: parsed.page,
    pageSize: parsed.pageSize,
  });

  res.json({
    success: true,
    data: timeline,
    message: "",
  });
};

export const getLeadActivities = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);

  const activities = await leadsService.getActivities(id);

  res.json({
    success: true,
    data: activities,
    message: "",
  });
};

export const convertLead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user?.id ?? null;

  const result = await leadsService.convertLeadToOpportunity(id, userId);

  res.status(201).json({
    success: true,
    data: result,
    message: "",
  });
};
