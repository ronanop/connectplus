import { z } from "zod";

export const cloudStageEnum = z.enum([
  "REQUIREMENTS_ASSIGNED",
  "ASSESSMENT_PLANNING",
  "ARCHITECTURE_COSTING",
  "SECURITY_STANDARDS",
  "IMPLEMENTATION_MIGRATION",
  "TESTING_VALIDATION",
  "OPTIMIZATION_SUPPORT",
  "CONTINUOUS_WORKING",
]);

export const createCloudEngagementSchema = z.object({
  deploymentId: z.number().int(),
  projectId: z.number().int().optional(),
  engagementName: z.string().min(1),
  customer: z.string().min(1),
  assignedTlId: z.number().int(),
  supportModel: z.string().optional(),
  notes: z.string().optional(),
});

export const updateCloudStageSchema = z.object({
  stage: cloudStageEnum,
  notes: z.string().optional(),
});

export const createIntakeSchema = z.object({
  businessObjectives: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  roadmapNotes: z.string().optional(),
  totalCostOptimisation: z.string().optional(),
  notes: z.string().optional(),
});

export const createAssessmentSchema = z.object({
  cloudDesign: z.string().optional(),
  resourceOptimisation: z.string().optional(),
  budgetingForecasting: z.string().optional(),
  assessmentNotes: z.string().optional(),
});

export const createArchitecturePlanSchema = z.object({
  architectureSummary: z.string().optional(),
  costPlan: z.string().optional(),
  targetPlatform: z.string().optional(),
  notes: z.string().optional(),
});

export const createSecurityFrameworkSchema = z.object({
  controls: z.array(z.string()).optional(),
  standards: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const createMigrationSchema = z.object({
  phases: z.array(z.string()).optional(),
  processMigration: z.string().optional(),
  applicationRehosting: z.string().optional(),
  dataTransfer: z.string().optional(),
  projectId: z.number().int().optional(),
  migrationStartedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const createManagedSupportSchema = z.object({
  optimisationNotes: z.string().optional(),
  featureRequests: z.array(z.string()).optional(),
  performanceChecks: z.array(z.string()).optional(),
  supportCoverage: z.string().optional(),
  supportStartedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});
