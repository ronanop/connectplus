import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const reviewReimbursementSchema = z.object({
  hrComment: z.string().max(2000).optional().nullable(),
});

export type ReviewReimbursementInput = z.infer<typeof reviewReimbursementSchema>;

export const createReimbursementBodySchema = z.object({
  expenseDate: isoDate,
  amount: z.preprocess(
    val => (val === undefined || val === null ? "" : String(val).trim()),
    z.string().min(1, "Amount is required"),
  ),
  notes: z.preprocess(
    val => (val === undefined || val === null || val === "" ? undefined : String(val)),
    z.string().max(5000).optional(),
  ),
});

export type CreateReimbursementBody = z.infer<typeof createReimbursementBodySchema>;

export const listMineQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine(d => !d.from || !d.to || d.from <= d.to, {
    message: "'from' must be on or before 'to'",
    path: ["to"],
  });

export type ListMineQuery = z.infer<typeof listMineQuerySchema>;
