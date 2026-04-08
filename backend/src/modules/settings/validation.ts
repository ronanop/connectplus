import { z } from "zod";

const tagsField = z
  .array(z.string().trim().min(1).max(80))
  .max(30)
  .optional();

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.number().int(),
  department: z.string().min(1).optional(),
  reportsToId: z.number().int().positive().nullable().optional(),
  tags: tagsField,
});

export const inviteUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  roleId: z.number().int(),
  department: z.string().min(1).optional(),
  subscriptionPlan: z.string().min(1).optional(),
  permissionScope: z.enum(["view", "edit", "view_edit"]).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  roleId: z.number().int().optional(),
  isActive: z.boolean().optional(),
  reportsToId: z.union([z.number().int().positive(), z.null()]).optional(),
  tags: tagsField,
});

export const oofSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  delegateUserId: z.number().int().nullable().optional(),
});

export const companyProfileSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().url().nullable().optional(),
  address: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  bankDetails: z.record(z.unknown()).nullable().optional(),
});

export const approvalConfigSchema = z.object({
  hwMarginMinPct: z.number(),
  swMarginMinPct: z.number(),
  svcMarginMinPct: z.number(),
});

export const revenueTargetSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  target: z.number(),
});

export const notificationPreferenceSchema = z.object({
  userId: z.number().int().nullable().optional(),
  roleId: z.number().int().nullable().optional(),
  triggerKey: z.string().min(1),
  channels: z.record(z.unknown()),
});

export const masterNameSchema = z.object({
  name: z.string().min(1),
});

export const microsoftDirectoryQuerySchema = z.object({
  domain: z.string().min(3).optional().default("cachedigitech.com"),
});

export const importMicrosoftDirectorySchema = z.object({
  defaultRoleId: z.number().int(),
  domain: z.string().min(3).optional().default("cachedigitech.com"),
});

export const purgeUsersExceptKeeperSchema = z.object({
  confirmation: z.literal("DELETE ALL OTHER USERS"),
});
