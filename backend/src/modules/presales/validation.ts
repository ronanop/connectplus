import { z } from "zod";

export const presalesStageEnum = z.enum([
  "INITIATED",
  "LEAD_HANDOVER",
  "REQUIREMENT_ANALYSIS",
  "SOLUTION_DESIGN",
  "SYSTEM_DESIGN",
  "TECH_STACK_FINALIZATION",
  "BOQ_CREATION",
  "POC",
  "PROPOSAL_GENERATION",
  "DEAL_CLOSURE_SUPPORT",
  "CLOSED",
]);

export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const listPresalesProjectsQuerySchema = z.object({
  search: z.string().optional(),
  stage: presalesStageEnum.or(z.literal("All")).optional(),
  priority: priorityEnum.or(z.literal("All")).optional(),
  status: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform(value => (value ? parseInt(value, 10) : 1))
    .pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .transform(value => (value ? parseInt(value, 10) : 25))
    .pipe(z.number().int().min(1).max(100)),
});

export const createPresalesProjectSchema = z.object({
  leadId: z.string().optional(),
  title: z.string().min(1),
  clientName: z.string().min(1),
  assignedTo: z.string().min(1),
  assignedBy: z.string().min(1),
  currentStage: presalesStageEnum.optional(),
  priority: priorityEnum.optional(),
  estimatedValue: z.number().optional(),
  expectedCloseDate: z.string().optional(),
  winProbability: z.number().min(0).max(1).optional(),
  status: z.string().optional(),
  lostReason: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePresalesProjectSchema = createPresalesProjectSchema.partial();

export const upsertSolutionDesignSchema = z.object({
  architectureUrl: z.string().url().optional().or(z.literal("")),
  diagramUrl: z.string().url().optional().or(z.literal("")),
  techStack: z.record(z.string(), z.array(z.string())).optional(),
  competitors: z.array(z.unknown()).optional(),
  recommendedOption: z.string().optional(),
  justification: z.string().optional(),
});

export const upsertBoqSchema = z.object({
  lineItems: z.array(z.unknown()),
  oemName: z.string().optional(),
  validity: z.string().optional(),
  attachmentUrl: z.string().optional(),
  effortDays: z.number().optional(),
  resourceCount: z.number().optional(),
  status: z.string().optional(),
});

export const upsertPocSchema = z.object({
  objective: z.string().optional(),
  scope: z.string().optional(),
  successCriteria: z.array(z.unknown()).optional(),
  environment: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  outcome: z.string().optional(),
  findings: z.string().optional(),
  evidenceUrls: z.array(z.string()).optional(),
  status: z.string().optional(),
});

export const patchPocOutcomeSchema = z.object({
  outcome: z.string().min(1),
});

export const upsertProposalSchema = z.object({
  executiveSummary: z.string().optional(),
  scopeOfWork: z.string().optional(),
  technicalApproach: z.string().optional(),
  commercials: z.array(z.unknown()).optional(),
  timeline: z.array(z.unknown()).optional(),
  teamStructure: z.array(z.unknown()).optional(),
  termsConditions: z.string().optional(),
  status: z.string().optional(),
});
