import { z } from "zod";

export const createOemAlignmentSchema = z.object({
  vendorName: z.string().min(1),
  notes: z.string().optional(),
  status: z.string().min(1).default("ALIGNED"),
  ownerId: z.number().int().nullable().optional(),
});

export const createVendorQuoteSchema = z.object({
  oemAlignmentId: z.number().int().nullable().optional(),
  vendorName: z.string().min(1),
  referenceNumber: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  pricingJson: z.record(z.any()).optional(),
  receivedDate: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
  remarks: z.string().optional(),
  ownerId: z.number().int().nullable().optional(),
});

export const createClientQuoteSchema = z.object({
  vendorQuoteId: z.number().int().nullable().optional(),
  quoteNumber: z.string().min(1),
  version: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  submittedDate: z.string().datetime(),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
  status: z.string().min(1).default("SUBMITTED"),
  ownerId: z.number().int().nullable().optional(),
});

export const createClientFollowUpSchema = z.object({
  clientQuoteId: z.number().int().nullable().optional(),
  followupDate: z.string().datetime(),
  mode: z.enum(["CALL", "EMAIL", "MEETING", "MESSAGE"]),
  summary: z.string().min(1),
  nextFollowupDate: z.string().datetime().optional(),
  ownerId: z.number().int().nullable().optional(),
});

export const closeWonSchema = z.object({
  notes: z.string().optional(),
});

export const closeLostSchema = z.object({
  reason: z.string().min(1),
  notes: z.string().optional(),
});

export const createPurchaseOrderSchema = z.object({
  clientQuoteSubmissionId: z.number().int().nullable().optional(),
  quotationId: z.number().int().nullable().optional(),
  scmOwnerId: z.number().int().nullable().optional(),
  scmHandoffAt: z.string().datetime().optional(),
  internalEtaDays: z.number().int().nonnegative().optional(),
  poNumber: z.string().min(1),
  poDate: z.string().datetime(),
  poValue: z.number().nonnegative(),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
  status: z.string().min(1).default("RECEIVED"),
});
