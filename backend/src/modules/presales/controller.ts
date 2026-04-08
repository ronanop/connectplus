import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { presalesService } from "./service";
import {
  listPresalesProjectsQuerySchema,
  patchPocOutcomeSchema,
  upsertBoqSchema,
  upsertPocSchema,
  upsertProposalSchema,
  upsertSolutionDesignSchema,
} from "./validation";

const isManagementRole = (role?: string | null) => role === "MANAGEMENT" || role === "ADMIN" || role === "SUPER_ADMIN";
const isPresalesRole = (role?: string | null) => role === "PRESALES";
const isSalesRole = (role?: string | null) => role === "SALES";

const hasReadAccess = (role?: string | null) => isPresalesRole(role) || isSalesRole(role) || isManagementRole(role);
const hasWriteAccess = (role?: string | null) => isPresalesRole(role) || isManagementRole(role);
const canConvert = (role?: string | null) => isSalesRole(role) || isPresalesRole(role) || isManagementRole(role);

const assertReadAccess = (role?: string | null) => {
  if (!hasReadAccess(role)) {
    throw new ApiError(403, "Forbidden");
  }
};

const assertWriteAccess = (role?: string | null) => {
  if (!hasWriteAccess(role)) {
    throw new ApiError(403, "Forbidden");
  }
};

const assertConvertAccess = (role?: string | null) => {
  if (!canConvert(role)) {
    throw new ApiError(403, "Forbidden");
  }
};

export const listPresalesProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertReadAccess(req.user?.role);

  const parsed = listPresalesProjectsQuerySchema.parse(req.query);

  const result = await presalesService.listProjects({
    search: parsed.search,
    linkedLeadId: parsed.linkedLeadId,
    stage: parsed.stage,
    priority: parsed.priority,
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

export const getPresalesProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertReadAccess(req.user?.role);

  const id = req.params.id;

  const project = await presalesService.getProjectById(id);

  if (!project) {
    res.status(404).json({
      success: false,
      data: null,
      message: "Presales project not found",
    });
    return;
  }

  res.json({
    success: true,
    data: { project },
    message: "",
  });
};

export const createPresalesProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const payload = req.body as any;

  const project = await presalesService.createProject(payload);

  res.status(201).json({
    success: true,
    data: { project },
    message: "",
  });
};

export const updatePresalesProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const id = req.params.id;
  const payload = req.body as any;

  const project = await presalesService.updateProject(id, payload);

  res.json({
    success: true,
    data: { project },
    message: "",
  });
};

export const getPresalesSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertReadAccess(req.user?.role);

  const summary = await presalesService.getSummary();

  res.json({
    success: true,
    data: summary,
    message: "",
  });
};

export const convertPresalesProjectToOpportunity = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  assertConvertAccess(req.user?.role);

  const id = req.params.id;
  const userId = req.user?.id ?? null;

  const result = await presalesService.convertToOpportunity(id, userId);

  res.status(201).json({
    success: true,
    data: result,
    message: "",
  });
};

export const getPresalesStages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertReadAccess(req.user?.role);

  const id = req.params.id;

  const stages = await presalesService.listStages(id);

  res.json({
    success: true,
    data: stages,
    message: "",
  });
};

export const advancePresalesStage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const id = req.params.id;
  const actorName = req.body?.actorName as string | undefined;
  const notes = req.body?.notes as string | undefined;

  const displayName = actorName || `User ${req.user?.id ?? ""}`.trim();

  const project = await presalesService.advanceStage(id, displayName, notes ?? null);

  res.json({
    success: true,
    data: { project },
    message: "",
  });
};

export const getRequirementDoc = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertReadAccess(req.user?.role);

  const id = req.params.id;

  const requirements = await presalesService.getRequirementDoc(id);

  res.json({
    success: true,
    data: { requirements },
    message: "",
  });
};

export const upsertRequirementDoc = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const id = req.params.id;
  const payload = req.body as any;

  const result = await presalesService.upsertRequirementDoc(id, payload);

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const upsertSolutionDesign = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const id = req.params.id;
  const payload = upsertSolutionDesignSchema.parse(req.body);

  const result = await presalesService.upsertSolutionDesign(id, payload);

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const upsertBoq = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const id = req.params.id;
  const payload = upsertBoqSchema.parse(req.body);

  const result = await presalesService.upsertBoq(id, payload);

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const submitBoq = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const id = req.params.id;

  const result = await presalesService.submitBoq(id);

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const upsertPoc = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const id = req.params.id;
  const payload = upsertPocSchema.parse(req.body);

  const result = await presalesService.upsertPoc(id, payload);

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const patchPocOutcome = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const id = req.params.id;
  const payload = patchPocOutcomeSchema.parse(req.body);

  const result = await presalesService.setPocOutcome(id, payload.outcome);

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const upsertProposal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertWriteAccess(req.user?.role);

  const id = req.params.id;
  const payload = upsertProposalSchema.parse(req.body);

  const result = await presalesService.upsertProposal(id, payload);

  res.json({
    success: true,
    data: result,
    message: "",
  });
};

export const listBoqBoard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertReadAccess(req.user?.role);

  const items = await presalesService.listBoqBoard();

  res.json({
    success: true,
    data: { items },
    message: "",
  });
};

export const listPocBoard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertReadAccess(req.user?.role);

  const items = await presalesService.listPocBoard();

  res.json({
    success: true,
    data: { items },
    message: "",
  });
};

export const listProposalBoard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  assertReadAccess(req.user?.role);

  const items = await presalesService.listProposalBoard();

  res.json({
    success: true,
    data: { items },
    message: "",
  });
};
