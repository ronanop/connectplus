import { z } from "zod";
import {
  PortfolioDiscipline,
  PortfolioJournalEntryType,
  PortfolioMemberRole,
  PortfolioProjectKind,
  PortfolioProjectStatus,
} from "../../generated/prisma";

const disciplineZ = z.nativeEnum(PortfolioDiscipline);
const kindZ = z.nativeEnum(PortfolioProjectKind);
const statusZ = z.nativeEnum(PortfolioProjectStatus);
const memberRoleZ = z.nativeEnum(PortfolioMemberRole);
const journalEntryTypeZ = z.nativeEnum(PortfolioJournalEntryType);

const initialMemberZ = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.union([z.literal("MEMBER"), z.literal("VIEWER")]),
});

export const listPortfolioQuerySchema = z.object({
  kind: kindZ.optional(),
  /** Comma-separated status values, e.g. `IN_PROGRESS,DONE` */
  status: z.string().max(500).optional(),
  discipline: disciplineZ.optional(),
  search: z.string().max(200).optional(),
});

export const createPortfolioProjectSchema = z.object({
  kind: kindZ,
  name: z.string().min(1).max(500),
  projectType: z.string().max(120).optional().nullable(),
  scopeOfWork: z.string().max(50_000).optional().nullable(),
  description: z.string().max(20_000).optional().nullable(),
  clientName: z.string().max(500).optional().nullable(),
  disciplines: z.array(disciplineZ).min(1).max(8),
  /** Project sponsor / owner (same org). */
  sponsorUserId: z.coerce.number().int().positive().optional().nullable(),
  /** ISO date string YYYY-MM-DD */
  tentativeCompletionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  /** Optional; defaults to creator. Must be in same org. Single LEAD per project. */
  leadUserId: z.coerce.number().int().positive().optional(),
  /** Additional members to add after lead (same org). */
  initialMembers: z.array(initialMemberZ).max(100).optional(),
});

export const patchPortfolioProjectSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  projectType: z.string().max(120).nullable().optional(),
  scopeOfWork: z.string().max(50_000).nullable().optional(),
  description: z.string().max(20_000).nullable().optional(),
  clientName: z.string().max(500).nullable().optional(),
  disciplines: z.array(disciplineZ).min(1).max(8).optional(),
  sponsorUserId: z.coerce.number().int().positive().nullable().optional(),
  tentativeCompletionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const patchPortfolioStatusSchema = z.object({
  status: statusZ,
  note: z.string().max(2000).optional(),
});

export const addPortfolioMemberSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: memberRoleZ,
});

export const postJournalEntrySchema = z.object({
  entryType: journalEntryTypeZ,
  body: z.string().min(1).max(50_000),
});
