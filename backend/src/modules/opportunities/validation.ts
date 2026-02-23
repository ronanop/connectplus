import { z } from "zod";

export const listOpportunitiesQuerySchema = z.object({
  search: z.string().optional(),
  stage: z.string().optional(),
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

