import { z } from "zod";

export const listCompaniesQuerySchema = z.object({
  search: z.string().optional(),
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

export const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().max(500).optional(),
  phone: z.string().max(40).optional(),
  industry: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateCompanySchema = createCompanySchema.partial();
