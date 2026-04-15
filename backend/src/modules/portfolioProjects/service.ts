import type { Express } from "express";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import {
  canCreatePortfolioProject,
  canManagePortfolioTeam,
  canPatchProjectFields,
  canPostPortfolioJournal,
  canReadPortfolioProject,
  canUpdatePortfolioStatus,
  canUploadPortfolioArtifact,
  effectiveDepartmentForPortfolio,
  isAdminRoleName,
} from "../../lib/portfolioAccess";
import {
  PortfolioDiscipline,
  PortfolioJournalEntryType,
  PortfolioMemberRole,
  PortfolioProjectKind,
  PortfolioProjectStatus,
  Prisma,
} from "../../generated/prisma";
import { absolutePathFromStored, toStoredPath } from "./upload";
import { z } from "zod";
import {
  addPortfolioMemberSchema,
  createPortfolioProjectSchema,
  listPortfolioQuerySchema,
  patchPortfolioProjectSchema,
  patchPortfolioStatusSchema,
  postJournalEntrySchema,
} from "./validators";

const userRowSelect = {
  id: true,
  name: true,
  email: true,
  department: true,
  organizationId: true,
  tagsJson: true,
  role: { select: { name: true } },
  hrEmployeeProfile: {
    select: { hrDepartment: { select: { name: true } } },
  },
} as const;

type UserRow = Prisma.UserGetPayload<{ select: typeof userRowSelect }>;

const memberUserSelect = {
  id: true,
  name: true,
  email: true,
  department: true,
  role: { select: { name: true } },
} as const;

async function loadUserRow(userId: number): Promise<UserRow> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: userRowSelect,
  });
  if (!u) {
    throw new ApiError(404, "User not found");
  }
  return u;
}

async function requireOrgUser(userId: number): Promise<{ organizationId: number; user: UserRow }> {
  const user = await loadUserRow(userId);
  if (!user.organizationId) {
    throw new ApiError(400, "User has no organization; portfolio projects are unavailable");
  }
  return { organizationId: user.organizationId, user };
}

function serializeMember(m: {
  id: number;
  role: PortfolioMemberRole;
  user: Prisma.UserGetPayload<{ select: typeof memberUserSelect }>;
}) {
  return {
    id: m.id,
    role: m.role,
    user: m.user,
  };
}

function fixArtifactDownloadPath(projectId: number, artifactId: number): string {
  return `/api/portfolio-projects/${projectId}/artifacts/${artifactId}/file`;
}

function serializeArtifactFixed(
  projectId: number,
  a: {
    id: number;
    journalEntryId: number | null;
    kind: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    note: string | null;
    createdAt: Date;
    uploadedBy: { id: number; name: string };
  },
) {
  return {
    id: a.id,
    journalEntryId: a.journalEntryId,
    kind: a.kind,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    note: a.note,
    createdAt: a.createdAt.toISOString(),
    uploadedBy: a.uploadedBy,
    downloadPath: fixArtifactDownloadPath(projectId, a.id),
  };
}

function parseDateOnlyYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function needsClientName(kind: PortfolioProjectKind): boolean {
  return kind === PortfolioProjectKind.CLIENT_POC || kind === PortfolioProjectKind.CLIENT_PROJECT;
}

function serializeProjectBase(p: {
  id: number;
  organizationId: number;
  kind: PortfolioProjectKind;
  name: string;
  projectType: string | null;
  scopeOfWork: string | null;
  description: string | null;
  clientName: string | null;
  sponsorUserId: number | null;
  tentativeCompletionDate: Date | null;
  status: PortfolioProjectStatus;
  disciplines: PortfolioDiscipline[];
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: number; name: string; email: string };
  sponsor: { id: number; name: string; email: string } | null;
}) {
  return {
    id: p.id,
    organizationId: p.organizationId,
    kind: p.kind,
    name: p.name,
    projectType: p.projectType,
    scopeOfWork: p.scopeOfWork,
    description: p.description,
    clientName: p.clientName,
    sponsorUserId: p.sponsorUserId,
    sponsor: p.sponsor,
    tentativeCompletionDate: p.tentativeCompletionDate
      ? p.tentativeCompletionDate.toISOString().slice(0, 10)
      : null,
    status: p.status,
    disciplines: p.disciplines,
    createdById: p.createdById,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    createdBy: p.createdBy,
  };
}

const sponsorSelect = { id: true, name: true, email: true } as const;

const projectInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  sponsor: { select: sponsorSelect },
} as const;

const detailInclude = {
  ...projectInclude,
  members: {
    orderBy: { id: "asc" as const },
    include: { user: { select: memberUserSelect } },
  },
  artifacts: {
    orderBy: { createdAt: "desc" as const },
    take: 150,
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 80,
    include: { user: { select: { id: true, name: true } } },
  },
  journalEntries: {
    orderBy: { createdAt: "desc" as const },
    take: 200,
    include: {
      user: { select: { id: true, name: true } },
      artifacts: {
        orderBy: { createdAt: "desc" as const },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
    },
  },
} as const;

async function getMembership(
  projectId: number,
  userId: number,
): Promise<{ role: PortfolioMemberRole } | null> {
  const m = await prisma.portfolioProjectMember.findFirst({
    where: { projectId, userId },
    select: { role: true },
  });
  return m;
}

async function assertCanRead(userId: number, project: { id: number; organizationId: number; createdById: number }) {
  const actor = await loadUserRow(userId);
  const orgId = actor.organizationId;
  const roleName = actor.role.name;
  const membership = await getMembership(project.id, userId);
  if (
    !canReadPortfolioProject(roleName, userId, project, membership, orgId ?? null)
  ) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN");
  }
}

const portfolioProjectsService = {
  async getAccessMeta(userId: number) {
    const { user } = await requireOrgUser(userId);
    const dept = effectiveDepartmentForPortfolio(user);
    const canCreate = canCreatePortfolioProject(user.role.name, dept);
    return { canCreate, organizationId: user.organizationId };
  },

  async listProjects(userId: number, query: z.infer<typeof listPortfolioQuerySchema>) {
    const { organizationId, user } = await requireOrgUser(userId);
    const roleName = user.role.name;
    const admin = isAdminRoleName(roleName);

    const where: Prisma.PortfolioProjectWhereInput = {
      organizationId,
    };

    if (!admin) {
      where.OR = [{ createdById: userId }, { members: { some: { userId } } }];
    }

    if (query.kind) {
      where.kind = query.kind;
    }
    if (query.status?.trim()) {
      const allowed = new Set<string>(Object.values(PortfolioProjectStatus));
      const parts = query.status
        .split(",")
        .map(x => x.trim().toUpperCase())
        .filter(Boolean) as PortfolioProjectStatus[];
      const statuses = parts.filter(s => allowed.has(s));
      if (statuses.length) {
        where.status = { in: statuses };
      }
    }
    if (query.discipline) {
      where.disciplines = { has: query.discipline };
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.AND = [
        ...(where.AND && Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { name: { contains: s, mode: "insensitive" } },
            { clientName: { contains: s, mode: "insensitive" } },
            { scopeOfWork: { contains: s, mode: "insensitive" } },
            { projectType: { contains: s, mode: "insensitive" } },
          ],
        },
      ];
    }

    const rows = await prisma.portfolioProject.findMany({
      where,
      include: projectInclude,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(r => serializeProjectBase(r));
  },

  async createProject(userId: number, body: z.infer<typeof createPortfolioProjectSchema>) {
    const { organizationId, user } = await requireOrgUser(userId);
    const dept = effectiveDepartmentForPortfolio(user);
    if (!canCreatePortfolioProject(user.role.name, dept)) {
      throw new ApiError(403, "You cannot create portfolio projects", "FORBIDDEN");
    }

    const leadId = body.leadUserId ?? userId;
    const leadUser = await loadUserRow(leadId);
    if (leadUser.organizationId !== organizationId) {
      throw new ApiError(400, "Lead user must belong to your organization");
    }

    let sponsorId: number | null = null;
    if (body.sponsorUserId != null) {
      const sp = await loadUserRow(body.sponsorUserId);
      if (sp.organizationId !== organizationId) {
        throw new ApiError(400, "Sponsor must belong to your organization");
      }
      sponsorId = body.sponsorUserId;
    }

    const initial = body.initialMembers ?? [];
    const seen = new Set<number>([leadId]);
    for (const m of initial) {
      if (seen.has(m.userId)) {
        continue;
      }
      seen.add(m.userId);
      const u = await loadUserRow(m.userId);
      if (u.organizationId !== organizationId) {
        throw new ApiError(400, "All aligned members must belong to your organization");
      }
    }

    const tentative =
      body.tentativeCompletionDate != null && body.tentativeCompletionDate.trim() !== ""
        ? parseDateOnlyYmd(body.tentativeCompletionDate.trim())
        : null;

    const created = await prisma.$transaction(async tx => {
      const project = await tx.portfolioProject.create({
        data: {
          organizationId,
          kind: body.kind,
          name: body.name.trim(),
          projectType: body.projectType?.trim() ?? null,
          scopeOfWork: body.scopeOfWork?.trim() ?? null,
          description: body.description?.trim() ?? null,
          clientName: needsClientName(body.kind) ? body.clientName?.trim() ?? null : null,
          sponsorUserId: sponsorId,
          tentativeCompletionDate: tentative,
          disciplines: body.disciplines,
          createdById: userId,
        },
        include: projectInclude,
      });

      await tx.portfolioProjectMember.create({
        data: {
          projectId: project.id,
          userId: leadId,
          role: PortfolioMemberRole.LEAD,
        },
      });

      for (const m of initial) {
        if (m.userId === leadId) {
          continue;
        }
        await tx.portfolioProjectMember.upsert({
          where: { projectId_userId: { projectId: project.id, userId: m.userId } },
          create: {
            projectId: project.id,
            userId: m.userId,
            role: m.role === "VIEWER" ? PortfolioMemberRole.VIEWER : PortfolioMemberRole.MEMBER,
          },
          update: {
            role: m.role === "VIEWER" ? PortfolioMemberRole.VIEWER : PortfolioMemberRole.MEMBER,
          },
        });
      }

      await tx.portfolioProjectActivity.create({
        data: {
          projectId: project.id,
          userId,
          action: "PROJECT_CREATED",
          meta: { kind: body.kind, name: project.name } as Prisma.InputJsonValue,
        },
      });

      return project;
    });

    return portfolioProjectsService.getProjectDetail(userId, created.id);
  },

  async getProjectDetail(userId: number, projectId: number): Promise<{
    project: ReturnType<typeof serializeProjectBase> & {
      members: ReturnType<typeof serializeMember>[];
      artifacts: ReturnType<typeof serializeArtifactFixed>[];
      journalEntries: Array<{
        id: number;
        entryType: PortfolioJournalEntryType;
        body: string;
        createdAt: string;
        user: { id: number; name: string };
        artifacts: ReturnType<typeof serializeArtifactFixed>[];
      }>;
      activities: Array<{
        id: number;
        action: string;
        meta: unknown;
        createdAt: string;
        user: { id: number; name: string };
      }>;
    };
  }> {
    const row = await prisma.portfolioProject.findFirst({
      where: { id: projectId },
      include: detailInclude,
    });
    if (!row) {
      throw new ApiError(404, "Project not found");
    }
    await assertCanRead(userId, row);

    const base = serializeProjectBase(row);
    return {
      project: {
        ...base,
        members: row.members.map(serializeMember),
        artifacts: row.artifacts.map(a =>
          serializeArtifactFixed(row.id, {
            ...a,
            uploadedBy: a.uploadedBy,
          }),
        ),
        journalEntries: row.journalEntries.map(j => ({
          id: j.id,
          entryType: j.entryType,
          body: j.body,
          createdAt: j.createdAt.toISOString(),
          user: j.user,
          artifacts: j.artifacts.map(a =>
            serializeArtifactFixed(row.id, {
              ...a,
              uploadedBy: a.uploadedBy,
            }),
          ),
        })),
        activities: row.activities.map(a => ({
          id: a.id,
          action: a.action,
          meta: a.meta,
          createdAt: a.createdAt.toISOString(),
          user: a.user,
        })),
      },
    };
  },

  async patchProject(userId: number, projectId: number, body: z.infer<typeof patchPortfolioProjectSchema>) {
    const row = await prisma.portfolioProject.findFirst({ where: { id: projectId } });
    if (!row) {
      throw new ApiError(404, "Project not found");
    }
    const actor = await loadUserRow(userId);
    const membership = await getMembership(projectId, userId);
    if (!canPatchProjectFields(actor.role.name, userId, row, membership)) {
      throw new ApiError(403, "Forbidden", "FORBIDDEN");
    }

    const data: Prisma.PortfolioProjectUpdateInput = {};
    if (body.name != null) {
      data.name = body.name.trim();
    }
    if (body.description !== undefined) {
      data.description = body.description?.trim() ?? null;
    }
    if (body.clientName !== undefined) {
      data.clientName = needsClientName(row.kind) ? body.clientName?.trim() ?? null : null;
    }
    if (body.projectType !== undefined) {
      data.projectType = body.projectType?.trim() ?? null;
    }
    if (body.scopeOfWork !== undefined) {
      data.scopeOfWork = body.scopeOfWork?.trim() ?? null;
    }
    if (body.sponsorUserId !== undefined) {
      if (body.sponsorUserId == null) {
        data.sponsor = { disconnect: true };
      } else {
        const sp = await loadUserRow(body.sponsorUserId);
        if (sp.organizationId !== row.organizationId) {
          throw new ApiError(400, "Sponsor must belong to your organization");
        }
        data.sponsor = { connect: { id: body.sponsorUserId } };
      }
    }
    if (body.tentativeCompletionDate !== undefined) {
      data.tentativeCompletionDate =
        body.tentativeCompletionDate == null || body.tentativeCompletionDate === ""
          ? null
          : parseDateOnlyYmd(body.tentativeCompletionDate.trim());
    }
    if (body.disciplines != null) {
      data.disciplines = { set: body.disciplines };
    }

    const updated = await prisma.portfolioProject.update({
      where: { id: projectId },
      data,
      include: detailInclude,
    });

    await prisma.portfolioProjectActivity.create({
      data: {
        projectId,
        userId,
        action: "PROJECT_UPDATED",
        meta: { fields: Object.keys(body) } as Prisma.InputJsonValue,
      },
    });

    return portfolioProjectsService.getProjectDetail(userId, updated.id);
  },

  async patchStatus(userId: number, projectId: number, body: z.infer<typeof patchPortfolioStatusSchema>) {
    const row = await prisma.portfolioProject.findFirst({ where: { id: projectId } });
    if (!row) {
      throw new ApiError(404, "Project not found");
    }
    const membership = await getMembership(projectId, userId);
    const actor = await loadUserRow(userId);
    if (!canUpdatePortfolioStatus(actor.role.name, membership)) {
      throw new ApiError(403, "Forbidden", "FORBIDDEN");
    }

    const from = row.status;
    const to = body.status;

    await prisma.portfolioProject.update({
      where: { id: projectId },
      data: { status: to },
    });

    await prisma.portfolioProjectActivity.create({
      data: {
        projectId,
        userId,
        action: "STATUS_CHANGED",
        meta: {
          from,
          to,
          note: body.note?.trim() ?? undefined,
        } as Prisma.InputJsonValue,
      },
    });

    return portfolioProjectsService.getProjectDetail(userId, projectId);
  },

  async addMember(userId: number, projectId: number, body: z.infer<typeof addPortfolioMemberSchema>) {
    const row = await prisma.portfolioProject.findFirst({ where: { id: projectId } });
    if (!row) {
      throw new ApiError(404, "Project not found");
    }
    const actor = await loadUserRow(userId);
    const membership = await getMembership(projectId, userId);
    if (!canManagePortfolioTeam(actor.role.name, membership)) {
      throw new ApiError(403, "Forbidden", "FORBIDDEN");
    }

    const target = await loadUserRow(body.userId);
    if (target.organizationId !== row.organizationId) {
      throw new ApiError(400, "User must belong to the same organization as the project");
    }

    await prisma.$transaction(async tx => {
      if (body.role === PortfolioMemberRole.LEAD) {
        await tx.portfolioProjectMember.updateMany({
          where: { projectId, role: PortfolioMemberRole.LEAD },
          data: { role: PortfolioMemberRole.MEMBER },
        });
      }

      await tx.portfolioProjectMember.upsert({
        where: {
          projectId_userId: { projectId, userId: body.userId },
        },
        create: {
          projectId,
          userId: body.userId,
          role: body.role,
        },
        update: { role: body.role },
      });

      await tx.portfolioProjectActivity.create({
        data: {
          projectId,
          userId,
          action: "MEMBER_ADDED",
          meta: { targetUserId: body.userId, role: body.role } as Prisma.InputJsonValue,
        },
      });
    });

    return portfolioProjectsService.getProjectDetail(userId, projectId);
  },

  async removeMember(userId: number, projectId: number, targetUserId: number) {
    const row = await prisma.portfolioProject.findFirst({ where: { id: projectId } });
    if (!row) {
      throw new ApiError(404, "Project not found");
    }
    const actor = await loadUserRow(userId);
    const membership = await getMembership(projectId, userId);
    if (!canManagePortfolioTeam(actor.role.name, membership)) {
      throw new ApiError(403, "Forbidden", "FORBIDDEN");
    }

    const victim = await prisma.portfolioProjectMember.findFirst({
      where: { projectId, userId: targetUserId },
    });
    if (!victim) {
      throw new ApiError(404, "Member not on this project");
    }

    if (victim.role === PortfolioMemberRole.LEAD) {
      const leadCount = await prisma.portfolioProjectMember.count({
        where: { projectId, role: PortfolioMemberRole.LEAD },
      });
      if (leadCount <= 1) {
        throw new ApiError(
          400,
          "Cannot remove the only project lead. Assign another lead first or promote a member.",
          "SOLE_LEAD",
        );
      }
    }

    await prisma.$transaction(async tx => {
      await tx.portfolioProjectMember.delete({
        where: { id: victim.id },
      });
      await tx.portfolioProjectActivity.create({
        data: {
          projectId,
          userId,
          action: "MEMBER_REMOVED",
          meta: { targetUserId } as Prisma.InputJsonValue,
        },
      });
    });

    return portfolioProjectsService.getProjectDetail(userId, projectId);
  },

  async addArtifact(
    projectId: number,
    userId: number,
    file: Express.Multer.File,
    opts: { kind?: string; note?: string; journalEntryId?: number },
  ) {
    const row = await prisma.portfolioProject.findFirst({ where: { id: projectId } });
    if (!row) {
      throw new ApiError(404, "Project not found");
    }
    const actor = await loadUserRow(userId);
    const membership = await getMembership(projectId, userId);
    if (!canReadPortfolioProject(actor.role.name, userId, row, membership, actor.organizationId ?? null)) {
      throw new ApiError(403, "Forbidden", "FORBIDDEN");
    }
    if (!canUploadPortfolioArtifact(actor.role.name, membership)) {
      throw new ApiError(403, "Viewers cannot upload artifacts", "FORBIDDEN");
    }

    let journalEntryId: number | null = null;
    if (opts.journalEntryId != null) {
      const je = await prisma.portfolioProjectJournalEntry.findFirst({
        where: { id: opts.journalEntryId, projectId },
      });
      if (!je) {
        throw new ApiError(404, "Journal entry not found on this project");
      }
      journalEntryId = je.id;
    }

    const kind = (opts.kind ?? "DOCUMENT").trim().slice(0, 32) || "DOCUMENT";
    const note = opts.note?.trim() ?? null;

    const created = await prisma.portfolioProjectArtifact.create({
      data: {
        projectId,
        journalEntryId,
        uploadedById: userId,
        kind,
        fileName: file.originalname || "file",
        storedPath: toStoredPath(projectId, file.filename),
        mimeType: file.mimetype || "application/octet-stream",
        sizeBytes: file.size,
        note,
      },
    });

    await prisma.portfolioProjectActivity.create({
      data: {
        projectId,
        userId,
        action: journalEntryId != null ? "JOURNAL_ARTIFACT_UPLOADED" : "ARTIFACT_UPLOADED",
        meta: { artifactId: created.id, kind, journalEntryId } as Prisma.InputJsonValue,
      },
    });

    const detail = await portfolioProjectsService.getProjectDetail(userId, projectId);
    return { project: detail.project, artifactId: created.id };
  },

  async createJournalEntry(
    userId: number,
    projectId: number,
    body: z.infer<typeof postJournalEntrySchema>,
  ) {
    const row = await prisma.portfolioProject.findFirst({ where: { id: projectId } });
    if (!row) {
      throw new ApiError(404, "Project not found");
    }
    const actor = await loadUserRow(userId);
    const membership = await getMembership(projectId, userId);
    if (!canReadPortfolioProject(actor.role.name, userId, row, membership, actor.organizationId ?? null)) {
      throw new ApiError(403, "Forbidden", "FORBIDDEN");
    }
    if (!canPostPortfolioJournal(actor.role.name, membership)) {
      throw new ApiError(403, "Viewers cannot post journal entries", "FORBIDDEN");
    }

    await prisma.portfolioProjectJournalEntry.create({
      data: {
        projectId,
        userId,
        entryType: body.entryType,
        body: body.body.trim(),
      },
    });

    await prisma.portfolioProjectActivity.create({
      data: {
        projectId,
        userId,
        action: "JOURNAL_ENTRY_CREATED",
        meta: { entryType: body.entryType } as Prisma.InputJsonValue,
      },
    });

    return portfolioProjectsService.getProjectDetail(userId, projectId);
  },

  async openArtifactFile(projectId: number, artifactId: number, userId: number) {
    const row = await prisma.portfolioProject.findFirst({ where: { id: projectId } });
    if (!row) {
      throw new ApiError(404, "Project not found");
    }
    await assertCanRead(userId, row);

    const art = await prisma.portfolioProjectArtifact.findFirst({
      where: { id: artifactId, projectId },
    });
    if (!art) {
      throw new ApiError(404, "Artifact not found");
    }

    const fs = await import("fs");
    const abs = absolutePathFromStored(art.storedPath);
    const stream = fs.createReadStream(abs);
    return { stream, fileName: art.fileName, mimeType: art.mimeType };
  },
};

export { portfolioProjectsService };
