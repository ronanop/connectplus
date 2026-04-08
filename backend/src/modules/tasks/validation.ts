import { z } from "zod";

export const taskStatusEnum = z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]);

export const listMyTasksQuerySchema = z.object({
  status: z.string().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: taskStatusEnum,
});

export const createDailyUpdateSchema = z.object({
  updateText: z.string().min(1),
  evidenceUrl: z.string().url().optional().nullable(),
});

export const assignTaskSchema = z.object({
  assignedToId: z.number().int().positive().nullable(),
});
