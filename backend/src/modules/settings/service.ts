import bcrypt from "bcryptjs";
import { prisma } from "../../prisma";
import { mailer } from "../../utils/mailer";
import crypto from "crypto";
import { getAppGraphClient } from "../../utils/graphAppClient";
import { ApiError } from "../../middleware/errorHandler";
import { mergeUserInto } from "./userMerge";
import { normalizeEmailKey, normalizeNameKey } from "../../utils/normalizeUserIdentity";
import { CONNECTPLUS_KEEPER_EMAIL } from "./keeperEmail";
import { tagsFromJson } from "../../lib/tagsFromJson";

export type MicrosoftOrgUserRow = {
  graphId: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  userPrincipalName: string;
};

/** Matches CRM areas (sidebar); created on first departments list if missing. */
const DEFAULT_DEPARTMENT_NAMES = [
  "Sales",
  "Presales",
  "SCM",
  "Deployment",
  "Cloud",
  "Cyber Security",
  "Network Security",
  "ISR",
  "Accounts",
  "IT Support",
  "Software Development",
  "Legal and Compliance",
  "Creative Department",
  "HR Department",
  "Network Help Desk",
] as const;

async function ensureDefaultDepartments(): Promise<void> {
  const rows = await prisma.department.findMany({ select: { name: true } });
  const have = new Set(rows.map(r => r.name));
  for (const name of DEFAULT_DEPARTMENT_NAMES) {
    if (!have.has(name)) {
      await prisma.department.create({ data: { name } });
    }
  }
}

function normalizeTagsList(tags: string[] | undefined): string[] {
  if (!tags?.length) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const n = t.trim();
    if (!n || n.length > 80) {
      continue;
    }
    const key = n.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(n);
    if (out.length >= 30) {
      break;
    }
  }
  return out;
}

async function assertReportingChainValid(userId: number, managerId: number | null): Promise<void> {
  if (managerId === null) {
    return;
  }
  if (managerId === userId) {
    throw new ApiError(400, "A user cannot report to themselves");
  }
  const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { id: true } });
  if (!manager) {
    throw new ApiError(400, "Reporting manager not found");
  }
  let current: number | null = managerId;
  const seen = new Set<number>();
  for (let depth = 0; depth < 200 && current != null; depth += 1) {
    if (current === userId) {
      throw new ApiError(400, "This reporting line would create a cycle");
    }
    if (seen.has(current)) {
      break;
    }
    seen.add(current);
    const nextMgr: { reportsToId: number | null } | null = await prisma.user.findUnique({
      where: { id: current },
      select: { reportsToId: true },
    });
    current = nextMgr?.reportsToId ?? null;
  }
}

async function fetchMicrosoftOrgUsersByDomainSuffix(domainSuffix: string): Promise<{
  domainSuffix: string;
  users: MicrosoftOrgUserRow[];
}> {
  const suffix = domainSuffix.startsWith("@") ? domainSuffix.toLowerCase() : `@${domainSuffix.toLowerCase()}`;
  const client = await getAppGraphClient();
  if (!client) {
    throw new ApiError(
      500,
      "Microsoft Graph is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET.",
    );
  }

  const collected: MicrosoftOrgUserRow[] = [];
  let path: string | null = "/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle&$top=999";

  try {
    while (path) {
      const res: any = await client.api(path).get();
      const rows = res.value || [];
      for (const u of rows) {
        const mail = (u.mail || "").trim().toLowerCase();
        const upn = (u.userPrincipalName || "").trim().toLowerCase();
        const primary = mail || (upn.includes("@") ? upn : "");
        if (!primary.endsWith(suffix)) {
          continue;
        }
        const email = mail || upn;
        if (!email) {
          continue;
        }
        const jt = u.jobTitle;
        collected.push({
          graphId: u.id,
          displayName: u.displayName || email.split("@")[0],
          email,
          department: u.department ?? null,
          jobTitle: typeof jt === "string" && jt.trim() ? jt.trim() : null,
          userPrincipalName: u.userPrincipalName || "",
        });
      }
      const next = res["@odata.nextLink"] as string | undefined;
      if (next) {
        const url = new URL(next);
        path = url.pathname.replace(/^\/v1\.0\b/i, "") + url.search;
      } else {
        path = null;
      }
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = e?.statusCode;
    if (code === 403 || /Insufficient privileges|Authorization_RequestDenied|403/i.test(msg)) {
      throw new ApiError(
        403,
        "Directory read was denied. In Azure AD, grant this app the Microsoft Graph application permission User.Read.All and admin consent.",
      );
    }
    throw new ApiError(500, `Failed to list directory users: ${msg}`);
  }

  const byEmail = new Map<string, MicrosoftOrgUserRow>();
  for (const row of collected) {
    if (!byEmail.has(row.email)) {
      byEmail.set(row.email, row);
    }
  }

  return { domainSuffix: suffix, users: Array.from(byEmail.values()) };
}

export const settingsService = {
  listRoles: () => prisma.role.findMany({ orderBy: { name: "asc" } }),
  listUsers: async () => {
    const rows = await prisma.user.findMany({
      include: { role: true, reportsTo: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(({ tagsJson, ...rest }) => ({
      ...rest,
      tags: tagsFromJson(tagsJson),
    }));
  },

  createUser: async (data: {
    name: string;
    email: string;
    password: string;
    roleId: number;
    department?: string;
    reportsToId?: number | null;
    tags?: string[];
  }) => {
    if (data.reportsToId != null) {
      const mgr = await prisma.user.findUnique({ where: { id: data.reportsToId }, select: { id: true } });
      if (!mgr) {
        throw new ApiError(400, "Reporting manager not found");
      }
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const tags = normalizeTagsList(data.tags);
    const created = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        roleId: data.roleId,
        department: data.department,
        reportsToId: data.reportsToId ?? null,
        tagsJson: tags.length ? tags : undefined,
      },
      include: { role: true, reportsTo: { select: { id: true, name: true, email: true } } },
    });
    const { tagsJson, ...base } = created;
    return { ...base, tags: tagsFromJson(tagsJson) };
  },

  inviteUserWithEmail: async (data: {
    name: string;
    email: string;
    roleId: number;
    department?: string;
    subscriptionPlan?: string;
    permissionScope?: "view" | "edit" | "view_edit";
  }) => {
    const generatedPassword = crypto.randomBytes(6).toString("base64url");
    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        roleId: data.roleId,
        department: data.department,
      },
    });

    const loginUrl = process.env.APP_LOGIN_URL ?? "http://localhost:3000/login";

    await mailer.sendMail({
      to: data.email,
      from: process.env.AZURE_FROM_EMAIL ?? "no-reply@cachedigitech.com",
      subject: "Your Connectplus CRM access",
      html: `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px;">
          <h2 style="margin-bottom: 8px;">Welcome to Connectplus CRM</h2>
          <p style="margin: 4px 0;">You have been granted access to the Connectplus CRM workspace.</p>
          <p style="margin: 4px 0;">Use the credentials below to sign in:</p>
          <pre style="background:#0f172a;color:#e5e7eb;padding:12px;border-radius:8px;margin-top:8px;margin-bottom:8px;">
Email: ${data.email}
Password: ${generatedPassword}
          </pre>
          <p style="margin: 4px 0;">Login URL: <a href="${loginUrl}">${loginUrl}</a></p>
          ${
            data.subscriptionPlan
              ? `<p style="margin: 12px 0 4px 0;">Subscription plan: <strong>${data.subscriptionPlan}</strong></p>`
              : ""
          }
          ${
            data.permissionScope
              ? `<p style="margin: 4px 0;">Permissions: <strong>${data.permissionScope}</strong></p>`
              : ""
          }
        </div>
      `,
    });

    return user;
  },

  updateUser: async (
    id: number,
    data: {
      name?: string;
      department?: string;
      roleId?: number;
      isActive?: boolean;
      reportsToId?: number | null;
      tags?: string[];
    },
  ) => {
    if (data.reportsToId !== undefined) {
      await assertReportingChainValid(id, data.reportsToId);
    }
    await prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.department !== undefined && { department: data.department || null }),
        ...(data.roleId !== undefined && { roleId: data.roleId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.reportsToId !== undefined && { reportsToId: data.reportsToId }),
        ...(data.tags !== undefined && { tagsJson: normalizeTagsList(data.tags) }),
      },
    });
    const row = await prisma.user.findUnique({
      where: { id },
      include: { role: true, reportsTo: { select: { id: true, name: true, email: true } } },
    });
    if (!row) {
      throw new ApiError(404, "User not found");
    }
    const { tagsJson, ...base } = row;
    return { ...base, tags: tagsFromJson(tagsJson) };
  },

  setUserOof: (userId: number, oof: { startDate: string; endDate: string; delegateUserId?: number | null }) => {
    return prisma.oofStatus.create({
      data: {
        userId,
        startDate: new Date(oof.startDate),
        endDate: new Date(oof.endDate),
        delegateUserId: oof.delegateUserId ?? null,
      },
    });
  },

  getCompanyProfile: () => {
    return prisma.companyProfile.findFirst();
  },

  upsertCompanyProfile: (data: {
    name: string;
    logoUrl?: string | null;
    address?: string | null;
    gstin?: string | null;
    bankDetails?: unknown;
  }) => {
    return prisma.companyProfile.upsert({
      where: { id: 1 },
      update: {
        name: data.name,
        logoUrl: data.logoUrl ?? null,
        address: data.address ?? null,
        gstin: data.gstin ?? null,
        bankDetails: data.bankDetails ?? undefined,
      },
      create: {
        name: data.name,
        logoUrl: data.logoUrl ?? null,
        address: data.address ?? null,
        gstin: data.gstin ?? null,
        bankDetails: data.bankDetails ?? undefined,
      },
    });
  },

  getApprovalConfig: () => {
    return prisma.approvalConfig.findFirst();
  },

  upsertApprovalConfig: (data: { hwMarginMinPct: number; swMarginMinPct: number; svcMarginMinPct: number }) => {
    return prisma.approvalConfig.upsert({
      where: { id: 1 },
      update: data,
      create: data,
    });
  },

  listRevenueTargets: () => {
    return prisma.revenueTarget.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  },

  upsertRevenueTarget: (data: { year: number; month: number; target: number }) => {
    return prisma.revenueTarget.upsert({
      where: { year_month: { year: data.year, month: data.month } },
      update: { target: data.target },
      create: data,
    });
  },

  listNotificationPreferences: () => {
    return prisma.notificationPreference.findMany();
  },

  createNotificationPreference: (data: {
    userId?: number | null;
    roleId?: number | null;
    triggerKey: string;
    channels: unknown;
  }) => {
    return prisma.notificationPreference.create({
      data: {
        userId: data.userId ?? null,
        roleId: data.roleId ?? null,
        triggerKey: data.triggerKey,
        channels: data.channels as any,
      },
    });
  },

  listProducts: () => prisma.product.findMany(),
  createProduct: (data: { name: string; category: string; unit: string; defaultPrice: number }) =>
    prisma.product.create({ data }),

  listDistributors: () => prisma.distributor.findMany(),
  createDistributor: (data: { name: string; contact?: string; leadTimeDays?: number; territory?: string }) =>
    prisma.distributor.create({ data }),

  listIndustries: () => prisma.industry.findMany(),
  createIndustry: (data: { name: string }) => prisma.industry.create({ data }),

  listLeadSources: () => prisma.leadSource.findMany(),
  createLeadSource: (data: { name: string }) => prisma.leadSource.create({ data }),

  listLossReasons: () => prisma.lossReason.findMany(),
  createLossReason: (data: { name: string }) => prisma.lossReason.create({ data }),

  listDepartments: async () => {
    await ensureDefaultDepartments();
    return prisma.department.findMany({ orderBy: { name: "asc" } });
  },

  listDepartmentsWithEmployeeCounts: async () => {
    await ensureDefaultDepartments();
    const depts = await prisma.department.findMany({ orderBy: { name: "asc" } });
    const grouped = await prisma.user.groupBy({
      by: ["department"],
      where: { department: { not: null } },
      _count: { _all: true },
    });
    const countByName = new Map<string, number>();
    for (const g of grouped) {
      if (g.department) {
        countByName.set(g.department, g._count._all);
      }
    }
    return depts.map(d => ({
      id: d.id,
      name: d.name,
      employeeCount: countByName.get(d.name) ?? 0,
    }));
  },

  listUsersForCrmDepartment: async (departmentId: number) => {
    const row = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!row) {
      throw new ApiError(404, "Department not found");
    }
    const users = await prisma.user.findMany({
      where: { department: row.name },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        role: { select: { name: true } },
      },
    });
    return users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      roleName: u.role.name,
    }));
  },

  getUserProfileForHr: async (userId: number) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        isActive: true,
        createdAt: true,
        tagsJson: true,
        organizationId: true,
        reportsToId: true,
        role: { select: { name: true } },
        organization: { select: { name: true, code: true } },
        reportsTo: { select: { id: true, name: true, email: true } },
        _count: { select: { directReports: true } },
      },
    });
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      tags: tagsFromJson(user.tagsJson),
      role: user.role.name,
      organization: user.organization?.name ?? null,
      organizationCode: user.organization?.code ?? null,
      organizationId: user.organizationId,
      reportsToId: user.reportsToId,
      reportsTo: user.reportsTo,
      directReportCount: user._count.directReports,
      isManager: user._count.directReports > 0,
    };
  },
  createDepartment: async (data: { name: string }) => {
    const name = data.name.trim();
    if (!name) {
      throw new ApiError(400, "Name is required");
    }
    try {
      return await prisma.department.create({ data: { name } });
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "P2002") {
        throw new ApiError(409, "A department with this name already exists");
      }
      throw e;
    }
  },

  updateDepartment: async (id: number, data: { name: string }) => {
    const trimmed = data.name.trim();
    if (!trimmed) {
      throw new ApiError(400, "Name is required");
    }
    const row = await prisma.department.findUnique({ where: { id } });
    if (!row) {
      throw new ApiError(404, "Department not found");
    }
    const oldName = row.name;
    if (oldName === trimmed) {
      return row;
    }
    const conflict = await prisma.department.findFirst({
      where: { name: trimmed, NOT: { id } },
    });
    if (conflict) {
      throw new ApiError(409, "A department with this name already exists");
    }
    return prisma.$transaction(async tx => {
      await tx.user.updateMany({ where: { department: oldName }, data: { department: trimmed } });
      return tx.department.update({ where: { id }, data: { name: trimmed } });
    });
  },

  deleteDepartment: async (id: number) => {
    const row = await prisma.department.findUnique({ where: { id } });
    if (!row) {
      throw new ApiError(404, "Department not found");
    }
    const count = await prisma.user.count({ where: { department: row.name } });
    if (count > 0) {
      throw new ApiError(
        400,
        `Cannot delete: ${count} user(s) are assigned to this department. Reassign them first.`,
      );
    }
    await prisma.department.delete({ where: { id } });
  },

  listSkillTags: () => prisma.skillTag.findMany(),
  createSkillTag: (data: { name: string }) => prisma.skillTag.create({ data }),

  listMicrosoftOrgUsersByDomainSuffix: (domainSuffix: string) => fetchMicrosoftOrgUsersByDomainSuffix(domainSuffix),

  importMicrosoftOrgUsersMissing: async (
    defaultRoleId: number,
    domainSuffix: string,
    organizationId?: number | null,
  ) => {
    const { users } = await fetchMicrosoftOrgUsersByDomainSuffix(domainSuffix);
    const role = await prisma.role.findUnique({ where: { id: defaultRoleId } });
    if (!role) {
      throw new ApiError(400, "Invalid role");
    }

    const existing = await prisma.user.findMany({ select: { email: true } });
    const have = new Set(existing.map(u => u.email.toLowerCase()));

    let imported = 0;
    let skippedAlreadyInCrm = 0;
    for (const row of users) {
      const emailLower = row.email.toLowerCase();
      if (have.has(emailLower)) {
        skippedAlreadyInCrm += 1;
        continue;
      }
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString("base64url"), 10);
      const tagList = normalizeTagsList([
        ...(row.jobTitle ? [row.jobTitle] : []),
        ...(row.department?.trim() ? [`dept:${row.department.trim()}`] : []),
      ]);
      await prisma.user.create({
        data: {
          name: row.displayName,
          email: row.email,
          passwordHash,
          roleId: defaultRoleId,
          department: row.department ?? undefined,
          ...(organizationId != null ? { organizationId } : {}),
          ...(tagList.length ? { tagsJson: tagList } : {}),
        },
      });
      have.add(emailLower);
      imported += 1;
    }

    return {
      imported,
      skippedAlreadyInCrm,
      totalInDirectory: users.length,
    };
  },

  listDuplicateUserGroups: async () => {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { id: "asc" },
    });
    const byEmail = new Map<string, typeof users>();
    for (const u of users) {
      const key = normalizeEmailKey(u.email);
      const list = byEmail.get(key) ?? [];
      list.push(u);
      byEmail.set(key, list);
    }
    const emailDuplicateGroups = [...byEmail.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([normalizedEmail, list]) => ({
        normalizedEmail,
        keeperUserId: list[0].id,
        users: list.map(row => ({
          id: row.id,
          email: row.email,
          name: row.name,
          isActive: row.isActive,
          createdAt: row.createdAt,
          role: row.role ? { id: row.role.id, name: row.role.name } : null,
        })),
      }));

    const byName = new Map<string, typeof users>();
    for (const u of users) {
      const nk = normalizeNameKey(u.name);
      if (nk.length < 2) {
        continue;
      }
      const list = byName.get(nk) ?? [];
      list.push(u);
      byName.set(nk, list);
    }
    const nameDuplicateGroups = [...byName.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([normalizedName, list]) => ({
        normalizedName,
        users: list.map(row => ({
          id: row.id,
          email: row.email,
          name: row.name,
          isActive: row.isActive,
          createdAt: row.createdAt,
          role: row.role ? { id: row.role.id, name: row.role.name } : null,
        })),
      }))
      .sort((a, b) => b.users.length - a.users.length);

    return { emailDuplicateGroups, nameDuplicateGroups };
  },

  deduplicateUsersByNormalizedEmail: async () => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
      orderBy: { id: "asc" },
    });
    const byNorm = new Map<string, number[]>();
    for (const u of users) {
      const key = normalizeEmailKey(u.email);
      const ids = byNorm.get(key) ?? [];
      ids.push(u.id);
      byNorm.set(key, ids);
    }
    let removedUsers = 0;
    let groupsProcessed = 0;
    for (const ids of byNorm.values()) {
      if (ids.length < 2) {
        continue;
      }
      groupsProcessed += 1;
      const keeperId = ids[0];
      for (let i = 1; i < ids.length; i += 1) {
        await mergeUserInto(ids[i], keeperId);
        removedUsers += 1;
      }
    }
    return { removedUsers, groupsProcessed };
  },

  /**
   * Removes every user except the keeper mailbox by merging each into the keeper (same as duplicate merge),
   * so foreign keys stay valid. Intended for a one-time reset before re-importing directory users.
   */
  purgeAllUsersExceptConnectPlusKeeper: async () => {
    const rows = await prisma.user.findMany({ select: { id: true, email: true } });
    const keeper = rows.find(u => normalizeEmailKey(u.email) === normalizeEmailKey(CONNECTPLUS_KEEPER_EMAIL));
    if (!keeper) {
      throw new ApiError(
        404,
        `Keeper account ${CONNECTPLUS_KEEPER_EMAIL} was not found. Create it before running a purge.`,
      );
    }
    const others = rows.filter(u => u.id !== keeper.id).sort((a, b) => a.id - b.id);
    let removed = 0;
    for (const u of others) {
      await mergeUserInto(u.id, keeper.id);
      removed += 1;
    }
    return {
      removed,
      keeperId: keeper.id,
      keeperEmail: CONNECTPLUS_KEEPER_EMAIL,
    };
  },

  /**
   * Deletes one user by merging their assignments into the Connect Plus account when present,
   * otherwise into the lowest remaining user id, so FK constraints stay valid.
   */
  deleteUserByMerging: async (userId: number) => {
    const rows = await prisma.user.findMany({ select: { id: true, email: true } });
    const victim = rows.find(u => u.id === userId);
    if (!victim) {
      throw new ApiError(404, "User not found");
    }
    const others = rows.filter(u => u.id !== userId).sort((a, b) => a.id - b.id);
    if (others.length === 0) {
      throw new ApiError(400, "Cannot delete the only user in the system");
    }
    const preferredKeeper = others.find(
      u => normalizeEmailKey(u.email) === normalizeEmailKey(CONNECTPLUS_KEEPER_EMAIL),
    );
    const mergeTarget = preferredKeeper ?? others[0];
    await mergeUserInto(userId, mergeTarget.id);
    return { mergedIntoUserId: mergeTarget.id };
  },
};
