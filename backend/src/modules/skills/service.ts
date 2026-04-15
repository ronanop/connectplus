import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Express } from "express";
import { z } from "zod";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import {
  createUserCertificationSchema,
  createUserSkillSchema,
  patchUserCertificationSchema,
  patchUserSkillSchema,
} from "./validators";

const CERT_UPLOAD_SEGMENT = "certifications";

export function certificationUploadRoot(): string {
  return path.join(process.cwd(), "uploads", CERT_UPLOAD_SEGMENT);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function absolutePathFromStored(storedPath: string): string {
  const normalized = storedPath.replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw new Error("Invalid path");
  }
  return path.join(process.cwd(), "uploads", normalized);
}

function extFromMime(mime: string): string {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".bin";
}

function toStoredRelativePath(userId: number, certId: number, filename: string): string {
  return path.join(CERT_UPLOAD_SEGMENT, String(userId), String(certId), filename).replace(/\\/g, "/");
}

function deleteCertFileIfExists(storedPath: string | null) {
  if (!storedPath) {
    return;
  }
  try {
    const abs = absolutePathFromStored(storedPath);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  } catch {
    // ignore
  }
}

function writeCertificateFile(
  userId: number,
  certId: number,
  file: Express.Multer.File,
): { storedPath: string; originalName: string; mimeType: string } {
  const dir = path.join(certificationUploadRoot(), String(userId), String(certId));
  ensureDir(dir);
  const ext = path.extname(file.originalname || "").toLowerCase();
  const safeExt =
    ext && ext.length <= 8 && /^\.[a-z0-9]+$/.test(ext) ? ext : extFromMime(file.mimetype || "");
  const filename = `${randomUUID()}${safeExt}`;
  const destAbs = path.join(dir, filename);
  fs.writeFileSync(destAbs, file.buffer);
  return {
    storedPath: toStoredRelativePath(userId, certId, filename),
    originalName: (file.originalname || filename).slice(0, 300),
    mimeType: (file.mimetype || "application/octet-stream").slice(0, 120),
  };
}

function parseDateOnly(ymd: string | null | undefined): Date | null {
  if (ymd == null || ymd === "") {
    return null;
  }
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function toYmd(d: Date | null): string | null {
  if (!d) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function serializeSkill(row: {
  id: number;
  name: string;
  proficiency: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    proficiency: row.proficiency,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeCert(row: {
  id: number;
  name: string;
  issuer: string | null;
  credentialId: string | null;
  issuedOn: Date | null;
  expiresOn: Date | null;
  notes: string | null;
  certificateStoredPath: string | null;
  certificateOriginalName: string | null;
  certificateMimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    issuer: row.issuer,
    credentialId: row.credentialId,
    issuedOn: toYmd(row.issuedOn),
    expiresOn: toYmd(row.expiresOn),
    notes: row.notes,
    certificateDownloadUrl: row.certificateStoredPath ? `/api/certifications/${row.id}/certificate/file` : null,
    certificateOriginalName: row.certificateOriginalName,
    certificateMimeType: row.certificateMimeType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const userSkillsService = {
  async listMine(userId: number) {
    const rows = await prisma.userSkill.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(serializeSkill);
  },

  async create(userId: number, body: z.infer<typeof createUserSkillSchema>) {
    const row = await prisma.userSkill.create({
      data: {
        userId,
        name: body.name.trim(),
        proficiency: body.proficiency?.trim() ?? null,
        notes: body.notes?.trim() ?? null,
      },
    });
    return serializeSkill(row);
  },

  async patch(userId: number, id: number, body: z.infer<typeof patchUserSkillSchema>) {
    const existing = await prisma.userSkill.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new ApiError(404, "Skill not found");
    }
    const data: {
      name?: string;
      proficiency?: string | null;
      notes?: string | null;
    } = {};
    if (body.name != null) {
      data.name = body.name.trim();
    }
    if (body.proficiency !== undefined) {
      data.proficiency = body.proficiency?.trim() ?? null;
    }
    if (body.notes !== undefined) {
      data.notes = body.notes?.trim() ?? null;
    }
    if (Object.keys(data).length === 0) {
      return serializeSkill(existing);
    }
    const row = await prisma.userSkill.update({
      where: { id },
      data,
    });
    return serializeSkill(row);
  },

  async remove(userId: number, id: number) {
    const existing = await prisma.userSkill.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new ApiError(404, "Skill not found");
    }
    await prisma.userSkill.delete({ where: { id } });
  },
};

const certSelect = {
  id: true,
  userId: true,
  name: true,
  issuer: true,
  credentialId: true,
  issuedOn: true,
  expiresOn: true,
  notes: true,
  certificateStoredPath: true,
  certificateOriginalName: true,
  certificateMimeType: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const userCertificationsService = {
  async listMine(userId: number) {
    const rows = await prisma.userCertification.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: certSelect,
    });
    return rows.map(serializeCert);
  },

  async create(userId: number, body: z.infer<typeof createUserCertificationSchema>, file?: Express.Multer.File) {
    const row = await prisma.userCertification.create({
      data: {
        userId,
        name: body.name.trim(),
        issuer: body.issuer?.trim() ?? null,
        credentialId: body.credentialId?.trim() ?? null,
        issuedOn: parseDateOnly(body.issuedOn ?? null),
        expiresOn: parseDateOnly(body.expiresOn ?? null),
        notes: body.notes?.trim() ?? null,
      },
      select: certSelect,
    });

    if (file) {
      const { storedPath, originalName, mimeType } = writeCertificateFile(userId, row.id, file);
      const updated = await prisma.userCertification.update({
        where: { id: row.id },
        data: {
          certificateStoredPath: storedPath,
          certificateOriginalName: originalName,
          certificateMimeType: mimeType,
        },
        select: certSelect,
      });
      return serializeCert(updated);
    }

    return serializeCert(row);
  },

  async patch(
    userId: number,
    id: number,
    body: z.infer<typeof patchUserCertificationSchema>,
    opts?: { file?: Express.Multer.File | undefined; clearCertificate?: boolean },
  ) {
    const existing = await prisma.userCertification.findFirst({ where: { id, userId }, select: certSelect });
    if (!existing) {
      throw new ApiError(404, "Certification not found");
    }

    if (opts?.clearCertificate) {
      deleteCertFileIfExists(existing.certificateStoredPath);
    }

    const data: Record<string, unknown> = {};
    if (body.name != null) {
      data.name = body.name.trim();
    }
    if (body.issuer !== undefined) {
      data.issuer = body.issuer?.trim() ?? null;
    }
    if (body.credentialId !== undefined) {
      data.credentialId = body.credentialId?.trim() ?? null;
    }
    if (body.issuedOn !== undefined) {
      data.issuedOn = parseDateOnly(body.issuedOn);
    }
    if (body.expiresOn !== undefined) {
      data.expiresOn = parseDateOnly(body.expiresOn);
    }
    if (body.notes !== undefined) {
      data.notes = body.notes?.trim() ?? null;
    }

    if (opts?.clearCertificate) {
      data.certificateStoredPath = null;
      data.certificateOriginalName = null;
      data.certificateMimeType = null;
    }

    if (opts?.file) {
      deleteCertFileIfExists(existing.certificateStoredPath);
      const { storedPath, originalName, mimeType } = writeCertificateFile(userId, id, opts.file);
      data.certificateStoredPath = storedPath;
      data.certificateOriginalName = originalName;
      data.certificateMimeType = mimeType;
    }

    if (Object.keys(data).length === 0 && !opts?.file && !opts?.clearCertificate) {
      return serializeCert(existing);
    }

    const row = await prisma.userCertification.update({
      where: { id },
      data: data as {
        name?: string;
        issuer?: string | null;
        credentialId?: string | null;
        issuedOn?: Date | null;
        expiresOn?: Date | null;
        notes?: string | null;
        certificateStoredPath?: string | null;
        certificateOriginalName?: string | null;
        certificateMimeType?: string | null;
      },
      select: certSelect,
    });
    return serializeCert(row);
  },

  async remove(userId: number, id: number) {
    const existing = await prisma.userCertification.findFirst({ where: { id, userId }, select: certSelect });
    if (!existing) {
      throw new ApiError(404, "Certification not found");
    }
    deleteCertFileIfExists(existing.certificateStoredPath);
    await prisma.userCertification.delete({ where: { id } });
  },

  async openCertificateStream(certId: number, userId: number) {
    const row = await prisma.userCertification.findFirst({
      where: { id: certId, userId },
      select: {
        certificateStoredPath: true,
        certificateOriginalName: true,
        certificateMimeType: true,
      },
    });
    if (!row?.certificateStoredPath) {
      throw new ApiError(404, "No certificate file uploaded.");
    }
    const abs = absolutePathFromStored(row.certificateStoredPath);
    if (!fs.existsSync(abs)) {
      throw new ApiError(404, "File missing on server.");
    }
    const stream = fs.createReadStream(abs);
    return {
      stream,
      fileName: row.certificateOriginalName || "certificate",
      mimeType: row.certificateMimeType || "application/octet-stream",
    };
  },
};
