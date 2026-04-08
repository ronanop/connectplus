import { z } from "zod";

export const deploymentStageEnum = z.enum([
  "KICKOFF_MEETING",
  "SITE_SURVEY",
  "MATERIALS_READY",
  "MATERIAL_MOVEMENT",
  "INSTALLATION_STARTED",
  "PUNCH_LIST",
  "UAT_IN_PROGRESS",
  "UAT_COMPLETED",
  "LIVE",
]);

export const updateDeploymentStageSchema = z.object({
  stage: deploymentStageEnum,
  notes: z.string().optional(),
});

export const createKickoffSchema = z.object({
  notes: z.string().optional(),
  kickoffCompletedAt: z.string().datetime().optional(),
  expectedGolive: z.string().datetime().optional(),
});

export const createSiteSurveySchema = z.object({
  surveyData: z.record(z.any()).default({}),
  floorPlanUrl: z.string().url().optional().or(z.literal("")),
  readinessStatus: z.string().optional(),
  engineerSignatureUrl: z.string().url().optional().or(z.literal("")),
  customerSignatureUrl: z.string().url().optional().or(z.literal("")),
  submittedAt: z.string().datetime().optional(),
});

export const createBalActivitySchema = z.object({
  taskName: z.string().min(1),
  assignedEngineerId: z.number().int().nullable().optional(),
  estimatedHours: z.number().nonnegative(),
  dependencyIds: z.string().optional(),
  taskCategory: z.string().optional(),
  status: z.string().min(1).default("PLANNED"),
});

export const updateBalActivitySchema = z.object({
  taskName: z.string().min(1).optional(),
  assignedEngineerId: z.number().int().nullable().optional(),
  estimatedHours: z.number().nonnegative().optional(),
  dependencyIds: z.string().optional().nullable(),
  taskCategory: z.string().optional().nullable(),
  status: z.string().optional(),
  completedAt: z.string().datetime().optional().nullable(),
});

export const createUatTestCaseSchema = z.object({
  testName: z.string().min(1),
  expectedResult: z.string().min(1),
  actualResult: z.string().optional(),
  passFail: z.string().optional(),
  comments: z.string().optional(),
  testedById: z.number().int().nullable().optional(),
  testedAt: z.string().datetime().optional(),
  signedOffByCustomer: z.boolean().optional(),
  signoffAt: z.string().datetime().optional(),
});

export const updateUatTestCaseSchema = z.object({
  actualResult: z.string().optional().nullable(),
  passFail: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  testedById: z.number().int().nullable().optional(),
  testedAt: z.string().datetime().optional().nullable(),
  signedOffByCustomer: z.boolean().optional(),
  signoffAt: z.string().datetime().optional().nullable(),
});

export const goLiveSchema = z.object({
  actualGolive: z.string().datetime().optional(),
  liveAt: z.string().datetime().optional(),
  customerSignoffUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});
