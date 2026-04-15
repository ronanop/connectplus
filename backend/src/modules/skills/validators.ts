import { z } from "zod";

/** Accepts empty string from multipart as null; leaves undefined unset for PATCH. */
const dateYmd = z.preprocess(val => {
  if (val === "") return null;
  if (val === undefined) return undefined;
  if (val === null) return null;
  return val;
}, z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional());

export const createUserSkillSchema = z.object({
  name: z.string().min(1).max(200),
  proficiency: z.string().max(120).optional().nullable(),
  notes: z.string().max(10_000).optional().nullable(),
});

export const patchUserSkillSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  proficiency: z.string().max(120).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
});

export const createUserCertificationSchema = z.object({
  name: z.string().min(1).max(300),
  issuer: z.string().max(200).optional().nullable(),
  credentialId: z.string().max(200).optional().nullable(),
  issuedOn: dateYmd,
  expiresOn: dateYmd,
  notes: z.string().max(10_000).optional().nullable(),
});

export const patchUserCertificationSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  issuer: z.string().max(200).nullable().optional(),
  credentialId: z.string().max(200).nullable().optional(),
  issuedOn: dateYmd,
  expiresOn: dateYmd,
  notes: z.string().max(10_000).nullable().optional(),
});
