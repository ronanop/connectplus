import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import { mailer } from "../../utils/mailer";
import { CreateOrganizationInput } from "./validation";

function toCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generatePassword(): string {
  return crypto.randomBytes(9).toString("base64");
}

export const superAdminService = {
  async listOverview() {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        users: {
          include: { role: true },
        },
      },
    });

    return organizations.map(org => {
      const admins = org.users.filter(u => u.role.name === "ADMIN");
      const users = org.users.filter(u => u.role.name === "USER");

      return {
        id: org.id,
        name: org.name,
        code: org.code,
        modules: org.modules as string[],
        createdAt: org.createdAt,
        adminCount: admins.length,
        userCount: users.length,
        totalSeats: org.users.length,
      };
    });
  },

  async getOrganization(id: number) {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          include: { role: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    return {
      id: organization.id,
      name: organization.name,
      code: organization.code,
      modules: organization.modules as string[],
      createdAt: organization.createdAt,
      users: organization.users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        isActive: user.isActive,
        department: user.department,
      })),
    };
  },

  async createOrganization(payload: CreateOrganizationInput) {
    const modulesJson = payload.modules;

    const codeBase = toCode(payload.name);
    const existingCount = await prisma.organization.count({
      where: { code: { startsWith: codeBase } },
    });
    const code = existingCount === 0 ? codeBase : `${codeBase}-${existingCount + 1}`;

    const organization = await prisma.organization.create({
      data: {
        name: payload.name,
        code,
        modules: modulesJson,
      },
    });

    const adminRole = await prisma.role.findFirst({ where: { name: "ADMIN" } });
    if (!adminRole) {
      throw new ApiError(500, "Admin role not configured");
    }

    const tempPassword = generatePassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const adminUser = await prisma.user.create({
      data: {
        name: payload.adminName,
        email: payload.adminEmail,
        passwordHash,
        roleId: adminRole.id,
        organizationId: organization.id,
        isActive: true,
      },
    });

    const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

    if (smtpConfigured) {
      const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@example.com";

      await mailer.sendMail({
        to: payload.adminEmail,
        from,
        subject: `Your Cachedigitech ${organization.name} admin access`,
        html: [
          `<p>Hi ${payload.adminName},</p>`,
          `<p>Your organisation <strong>${organization.name}</strong> has been created on Cachedigitech.</p>`,
          `<p>You can sign in with:</p>`,
          `<p><strong>URL:</strong> ${process.env.APP_BASE_URL || "http://localhost:5173"}</p>`,
          `<p><strong>Email:</strong> ${payload.adminEmail}<br/><strong>Temporary password:</strong> ${tempPassword}</p>`,
          `<p>Please sign in and change your password from the settings area.</p>`,
        ].join(""),
      });
    }

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        code: organization.code,
        modules: modulesJson,
        createdAt: organization.createdAt,
      },
      admin: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
      },
      temporaryPassword: tempPassword,
      emailSent: smtpConfigured,
    };
  },
};

