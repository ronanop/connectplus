import type { Request } from "express";

function emptyToNull(v: unknown): string | null {
  if (v === undefined || v === null || v === "") {
    return null;
  }
  return String(v);
}

export function isMultipartRequest(req: Request): boolean {
  return Boolean(req.headers["content-type"]?.includes("multipart/form-data"));
}

/** Normalize text fields from multipart for create. */
export function normalizeMultipartCreateBody(raw: Record<string, unknown>) {
  return {
    name: String(raw.name ?? "").trim(),
    issuer: emptyToNull(raw.issuer),
    credentialId: emptyToNull(raw.credentialId),
    issuedOn: emptyToNull(raw.issuedOn),
    expiresOn: emptyToNull(raw.expiresOn),
    notes: emptyToNull(raw.notes),
  };
}

/** Multipart edit form sends all fields; map to patch shape. */
export function normalizeMultipartPatchBody(raw: Record<string, unknown>) {
  return {
    name: raw.name !== undefined ? String(raw.name).trim() : undefined,
    issuer: raw.issuer !== undefined ? emptyToNull(raw.issuer) : undefined,
    credentialId: raw.credentialId !== undefined ? emptyToNull(raw.credentialId) : undefined,
    issuedOn: raw.issuedOn !== undefined ? emptyToNull(raw.issuedOn) : undefined,
    expiresOn: raw.expiresOn !== undefined ? emptyToNull(raw.expiresOn) : undefined,
    notes: raw.notes !== undefined ? emptyToNull(raw.notes) : undefined,
  };
}

export function readClearCertificateFlag(raw: Record<string, unknown>): boolean {
  const v = raw.clearCertificate;
  return v === true || v === "true" || v === "1" || v === "on";
}
