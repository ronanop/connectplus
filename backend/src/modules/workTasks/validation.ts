import { z } from "zod";

const taskFlowKeySchema = z.enum(["employee", "manager", "organization_member", "intern", "hr"]);

export const listWorkTasksQuerySchema = z.object({
  scope: z.enum(["mine", "team", "org"]).default("mine"),
  status: z.string().optional(),
  /** Filter by profile-tag task flow */
  taskFlowKey: taskFlowKeySchema.optional(),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

export const createWorkTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional().nullable(),
  taskFlowKey: taskFlowKeySchema.optional().default("employee"),
  status: z.string().min(1).max(64).optional(),
  priority: z.string().min(1).max(64).default("MEDIUM"),
  dueDate: z.coerce.date().optional().nullable(),
  assigneeId: z.number().int().positive().optional().nullable(),
});

export const patchWorkTaskSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10000).optional().nullable(),
    status: z.string().min(1).max(64).optional(),
    priority: z.string().min(1).max(64).optional(),
    dueDate: z.coerce.date().optional().nullable(),
  })
  .refine(
    data =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.priority !== undefined ||
      data.dueDate !== undefined,
    { message: "At least one field is required" },
  );

export const assignWorkTaskSchema = z.object({
  assigneeId: z.number().int().positive().optional().nullable(),
});

export const commentWorkTaskSchema = z.object({
  body: z.string().min(1).max(8000),
});
