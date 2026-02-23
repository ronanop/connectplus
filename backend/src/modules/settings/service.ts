import bcrypt from "bcryptjs";
import { prisma } from "../../prisma";
import { mailer } from "../../utils/mailer";
import crypto from "crypto";

export const settingsService = {
  listUsers: () => {
    return prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: "desc" },
    });
  },

  createUser: async (data: {
    name: string;
    email: string;
    password: string;
    roleId: number;
    department?: string;
  }) => {
    const passwordHash = await bcrypt.hash(data.password, 10);
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        roleId: data.roleId,
        department: data.department,
      },
    });
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
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@cachedigitech.com",
      subject: "Your Cachedigitech CRM access",
      html: `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px;">
          <h2 style="margin-bottom: 8px;">Welcome to Cachedigitech CRM</h2>
          <p style="margin: 4px 0;">You have been granted access to the Cachedigitech CRM workspace.</p>
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

  updateUser: (id: number, data: { name?: string; department?: string; roleId?: number; isActive?: boolean }) => {
    return prisma.user.update({
      where: { id },
      data,
    });
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

  listDepartments: () => prisma.department.findMany(),
  createDepartment: (data: { name: string }) => prisma.department.create({ data }),

  listSkillTags: () => prisma.skillTag.findMany(),
  createSkillTag: (data: { name: string }) => prisma.skillTag.create({ data }),
};
