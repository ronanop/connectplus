import { z } from "zod";

const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

/** Direct PATCH only — completion uses request/approve flow. */
const directStatusPatchEnum = z.enum(["PENDING", "IN_PROGRESS", "ON_HOLD", "CANCELLED"]);

export const createTaskSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    priority: priorityEnum,
    deadline: z.string().datetime({ offset: true }),
    assignedToIds: z.array(z.coerce.number().int().positive()).max(40).optional(),
    /** Org members only: route task to that CRM department’s managers; they add ICs. */
    assignToDepartment: z.string().min(1).max(120).optional(),
  })
  .superRefine((data, ctx) => {
    const ids = data.assignedToIds?.length ?? 0;
    const dept = data.assignToDepartment?.trim();
    if (ids > 0 && dept) {
      ctx.addIssue({
        code: "custom",
        message: "Use either assignedToIds or assignToDepartment, not both",
        path: ["assignedToIds"],
      });
    }
    if (ids === 0 && !dept) {
      ctx.addIssue({
        code: "custom",
        message: "Choose people to assign, or pick a department (organization members only)",
        path: ["assignedToIds"],
      });
    }
  });

export const updateStatusSchema = z.object({
  status: directStatusPatchEnum,
  artifactId: z.coerce.number().int().positive().optional(),
});

export const rejectCompletionSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priority: priorityEnum.optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
  assignedToIds: z.array(z.coerce.number().int().positive()).min(1).max(40).optional(),
});

export const addCommentSchema = z.object({
  content: z.string().min(1),
});

export const listTasksQuerySchema = z.object({
  scope: z.enum(["mine", "assigned_by_me", "all"]).default("mine"),
  status: z.string().optional(),
  priority: z.string().optional(),
  department: z.string().optional(),
  assignedToId: z.coerce.number().int().positive().optional(),
  assignedById: z.coerce.number().int().positive().optional(),
  dueSoon: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform(v => v === true || v === "true"),
  search: z.string().optional(),
});

export const directorySyncSchema = z.object({
  query: z.string().max(120).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
