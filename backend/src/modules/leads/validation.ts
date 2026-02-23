import { z } from "zod";

export const leadStatusEnum = z.enum([
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
  "Converted",
]);

export const createLeadSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  source: z.string().min(1),
  industry: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  requirement: z.string().min(1).optional(),
  estimatedValue: z.number().nonnegative().optional(),
  status: leadStatusEnum.default("New"),
  assignedToId: z.number().int().nullable().optional(),
});

export const updateLeadStatusSchema = z.object({
  status: leadStatusEnum,
});

export const updateLeadSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  source: z.string().min(1).optional(),
  industry: z.string().min(1).optional().nullable(),
  city: z.string().min(1).optional().nullable(),
  state: z.string().min(1).optional().nullable(),
  requirement: z.string().min(1).optional().nullable(),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  status: leadStatusEnum.optional(),
  assignedToId: z.number().int().nullable().optional(),
  lostReason: z.string().min(1).optional(),
});

export const addLeadNoteSchema = z.object({
  body: z.string().min(1),
});

export const sendLeadEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export const leadTimelineQuerySchema = z.object({
  type: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform(value => (value ? parseInt(value, 10) : 1))
    .pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .transform(value => (value ? parseInt(value, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

export const listLeadsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
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
