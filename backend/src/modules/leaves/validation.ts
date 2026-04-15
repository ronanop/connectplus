import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const createLeaveSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    leaveType: z.enum(["CASUAL", "SICK", "ANNUAL", "OTHER"]).default("OTHER"),
    reason: z.string().min(3).max(5000),
  })
  .refine(d => d.startDate <= d.endDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const reviewLeaveSchema = z.object({
  hrComment: z.string().max(2000).optional().nullable(),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;

const isoDateOpt = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional();

export const orgHistoryQuerySchema = z
  .object({
    status: z.enum(["APPROVED", "DENIED", "ALL"]).optional().default("APPROVED"),
    sort: z
      .enum(["startDate_desc", "startDate_asc", "reviewedAt_desc", "reviewedAt_asc", "employee_asc"])
      .optional()
      .default("startDate_desc"),
    department: z
      .string()
      .max(200)
      .optional()
      .transform(v => (v == null || v === "" || v === "ALL" ? undefined : v)),
    from: isoDateOpt,
    to: isoDateOpt,
    take: z.coerce.number().int().min(1).max(500).optional().default(200),
  })
  .refine(d => !d.from || !d.to || d.from <= d.to, {
    message: "'from' must be on or before 'to'",
    path: ["to"],
  });

export type OrgHistoryQuery = z.infer<typeof orgHistoryQuerySchema>;
