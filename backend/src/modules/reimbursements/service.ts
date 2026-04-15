import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Express } from "express";
import { Prisma } from "../../generated/prisma";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import type { CreateReimbursementBody, ListMineQuery, ReviewReimbursementInput } from "./validation";
import { userHasHrAccess } from "../../lib/hrAccess";
import { tagsFromJson } from "../../lib/tagsFromJson";

const UPLOAD_SEGMENT = "reimbursements";

export function reimbursementUploadRoot(): string {
  return path.join(process.cwd(), "uploads", UPLOAD_SEGMENT);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) {
    throw new ApiError(400, "Invalid date");
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function dateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function absolutePathFromStored(storedPath: string): string {
  const normalized = storedPath.replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw new Error("Invalid path");
  }
  return path.join(process.cwd(), "uploads", normalized);
}

function toStoredPath(claimId: number, filename: string): string {
  return path.join(UPLOAD_SEGMENT, String(claimId), filename).replace(/\\/g, "/");
}

const claimSelect = {
  id: true,
  organizationId: true,
  userId: true,
  expenseDate: true,
  amount: true,
  notes: true,
  status: true,
  reviewedAt: true,
  hrComment: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, department: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  attachments: true,
} as const;

function mapClaim(row: {
  id: number;
  organizationId: number;
  userId: number;
  expenseDate: Date;
  amount: Prisma.Decimal;
  notes: string | null;
  status: string;
  reviewedAt: Date | null;
  hrComment: string | null;
  createdAt: Date;
  user: { id: number; name: string; email: string; department: string | null };
  reviewedBy: { id: number; name: string; email: string } | null;
  attachments: { id: number; originalName: string; mimeType: string }[];
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    expenseDate: dateToYmd(row.expenseDate),
    amount: row.amount.toFixed(2),
    notes: row.notes,
    status: row.status,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    hrComment: row.hrComment,
    createdAt: row.createdAt.toISOString(),
    user: row.user,
    reviewedBy: row.reviewedBy,
    attachments: row.attachments.map(a => ({
      id: a.id,
      originalName: a.originalName,
      mimeType: a.mimeType,
      downloadUrl: `/api/reimbursements/${row.id}/attachments/${a.id}/file`,
    })),
  };
}

export const reimbursementsService = {
  async create(userId: number, body: CreateReimbursementBody, files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new ApiError(400, "Upload at least one bill or receipt.");
    }
    if (files.length > 10) {
      throw new ApiError(400, "At most 10 files per claim.");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      throw new ApiError(400, "Your account must be linked to an organization to submit reimbursement.");
    }
    const organizationId = user.organizationId;

    const expenseDate = ymdToUtcDate(body.expenseDate);
    const amountNum = Number(body.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new ApiError(400, "Amount must be a positive number.");
    }
    if (amountNum > 1e10) {
      throw new ApiError(400, "Amount is too large.");
    }
    const amount = new Prisma.Decimal(amountNum.toFixed(2));

    const pending = await prisma.reimbursementClaim.findFirst({
      where: {
        userId,
        expenseDate,
        status: "PENDING",
      },
    });
    if (pending) {
      throw new ApiError(409, "You already have a pending reimbursement for this date.");
    }

    const claim = await prisma.$transaction(async tx => {
      const created = await tx.reimbursementClaim.create({
        data: {
          organizationId,
          userId,
          expenseDate,
          amount,
          notes: body.notes?.trim() ? body.notes.trim() : null,
          status: "PENDING",
        },
        select: { id: true },
      });

      const claimDir = path.join(reimbursementUploadRoot(), String(created.id));
      ensureDir(claimDir);

      for (const f of files) {
        const ext = path.extname(f.originalname || "").slice(0, 16) || ".bin";
        const base = path
          .basename(f.originalname || "file", ext)
          .replace(/[^\w.-]+/g, "_")
          .slice(0, 80);
        const filename = `${randomUUID()}-${base}${ext}`;
        const destAbs = path.join(claimDir, filename);
        fs.writeFileSync(destAbs, f.buffer);
        const storedPath = toStoredPath(created.id, filename);
        await tx.reimbursementAttachment.create({
          data: {
            claimId: created.id,
            storedPath,
            originalName: f.originalname || filename,
            mimeType: f.mimetype || "application/octet-stream",
          },
        });
      }

      return tx.reimbursementClaim.findUniqueOrThrow({
        where: { id: created.id },
        select: claimSelect,
      });
    });

    return mapClaim(claim);
  },

  async listMine(userId: number, query: ListMineQuery) {
    const where: Prisma.ReimbursementClaimWhereInput = { userId };
    if (query.from && query.to) {
      where.expenseDate = {
        gte: ymdToUtcDate(query.from),
        lte: ymdToUtcDate(query.to),
      };
    } else if (query.from) {
      where.expenseDate = { gte: ymdToUtcDate(query.from) };
    } else if (query.to) {
      where.expenseDate = { lte: ymdToUtcDate(query.to) };
    }

    const rows = await prisma.reimbursementClaim.findMany({
      where,
      orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
      select: claimSelect,
    });
    return rows.map(mapClaim);
  },

  async listPendingForHr(hrUserId: number) {
    const hr = await prisma.user.findUnique({
      where: { id: hrUserId },
      select: { organizationId: true },
    });
    if (!hr?.organizationId) {
      return [];
    }

    const rows = await prisma.reimbursementClaim.findMany({
      where: {
        organizationId: hr.organizationId,
        status: "PENDING",
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: claimSelect,
    });
    return rows.map(mapClaim);
  },

  async approve(claimId: number, hrUserId: number, input: ReviewReimbursementInput) {
    const hr = await prisma.user.findUnique({
      where: { id: hrUserId },
      select: { organizationId: true },
    });
    if (!hr?.organizationId) {
      throw new ApiError(403, "No organization context for reviewer.");
    }

    const row = await prisma.reimbursementClaim.findFirst({
      where: { id: claimId, organizationId: hr.organizationId },
    });
    if (!row) {
      throw new ApiError(404, "Reimbursement not found.");
    }
    if (row.status !== "PENDING") {
      throw new ApiError(400, "This claim is no longer pending.");
    }

    const updated = await prisma.reimbursementClaim.update({
      where: { id: claimId },
      data: {
        status: "APPROVED",
        reviewedById: hrUserId,
        reviewedAt: new Date(),
        hrComment: input.hrComment?.trim() || null,
      },
      select: claimSelect,
    });
    return mapClaim(updated);
  },

  async deny(claimId: number, hrUserId: number, input: ReviewReimbursementInput) {
    const hr = await prisma.user.findUnique({
      where: { id: hrUserId },
      select: { organizationId: true },
    });
    if (!hr?.organizationId) {
      throw new ApiError(403, "No organization context for reviewer.");
    }

    const row = await prisma.reimbursementClaim.findFirst({
      where: { id: claimId, organizationId: hr.organizationId },
    });
    if (!row) {
      throw new ApiError(404, "Reimbursement not found.");
    }
    if (row.status !== "PENDING") {
      throw new ApiError(400, "This claim is no longer pending.");
    }

    const updated = await prisma.reimbursementClaim.update({
      where: { id: claimId },
      data: {
        status: "DENIED",
        reviewedById: hrUserId,
        reviewedAt: new Date(),
        hrComment: input.hrComment?.trim() || null,
      },
      select: claimSelect,
    });
    return mapClaim(updated);
  },

  async openAttachmentStream(claimId: number, attachmentId: number, userId: number) {
    const att = await prisma.reimbursementAttachment.findFirst({
      where: { id: attachmentId, claimId },
      include: {
        claim: {
          select: {
            userId: true,
            organizationId: true,
          },
        },
      },
    });
    if (!att) {
      throw new ApiError(404, "Attachment not found.");
    }

    const claim = att.claim;
    const isOwner = claim.userId === userId;
    if (!isOwner) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true, department: true, tagsJson: true, role: { select: { name: true } } },
      });
      if (!user?.organizationId || user.organizationId !== claim.organizationId) {
        throw new ApiError(403, "Forbidden");
      }
      const tags = tagsFromJson(user.tagsJson);
      if (
        !userHasHrAccess({
          role: user.role.name,
          department: user.department,
          tags,
        })
      ) {
        throw new ApiError(403, "Forbidden");
      }
    }

    const abs = absolutePathFromStored(att.storedPath);
    if (!fs.existsSync(abs)) {
      throw new ApiError(404, "File missing on server.");
    }
    const stream = fs.createReadStream(abs);
    return {
      stream,
      fileName: att.originalName,
      mimeType: att.mimeType || "application/octet-stream",
    };
  },
};
