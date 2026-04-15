import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "../../prisma";
import { getJwtExpiresIn } from "../../lib/sessionJwt";
import { ApiError } from "../../middleware/errorHandler";
import { AuthUser } from "../../types/auth";
import type { Prisma } from "../../generated/prisma";
import type { Role, User } from "../../generated/prisma";

function normalizeAzureGuid(id: string): string {
  return id.replace(/[{}]/g, "").trim().toLowerCase();
}

/** Read `tid` from an Azure access token JWT when present (public payload only; signature already validated by token issuance + Graph). */
function readAccessTokenTenantId(accessToken: string): string | null {
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { tid?: string };
    return typeof payload.tid === "string" ? payload.tid : null;
  } catch {
    return null;
  }
}

function parseJitAllowedDomains(): string[] | null {
  const raw = process.env.AZURE_SSO_ALLOWED_EMAIL_DOMAINS?.trim();
  if (!raw) return null;
  const list = raw.split(",").map(d => d.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : null;
}

function isEmailDomainAllowedForJit(emailNorm: string, domains: string[] | null): boolean {
  if (!domains) return true;
  const at = emailNorm.lastIndexOf("@");
  if (at <= 0 || at === emailNorm.length - 1) return false;
  const domain = emailNorm.slice(at + 1);
  return domains.includes(domain);
}

/** Matches user@cachedigitech.com and user@sub.cachedigitech.com */
function isCachedigitechEmailDomain(emailNorm: string): boolean {
  const at = emailNorm.lastIndexOf("@");
  if (at < 0 || at === emailNorm.length - 1) return false;
  const domain = emailNorm.slice(at + 1).toLowerCase();
  return domain === "cachedigitech.com" || domain.endsWith(".cachedigitech.com");
}

const CACHEDIGITECH_INTERNAL_ORG_CODE = "cachedigitech-internal";

async function resolveJitOrganizationId(emailNorm: string): Promise<number> {
  if (isCachedigitechEmailDomain(emailNorm)) {
    const org = await prisma.organization.findUnique({ where: { code: CACHEDIGITECH_INTERNAL_ORG_CODE } });
    if (!org) {
      throw new ApiError(
        503,
        `SSO auto-provisioning: organization "${CACHEDIGITECH_INTERNAL_ORG_CODE}" not found. Run database seed or create the Connectplus Internal organization.`,
      );
    }
    return org.id;
  }

  const orgCode = process.env.AZURE_SSO_JIT_ORG_CODE?.trim();
  if (orgCode) {
    const org = await prisma.organization.findUnique({ where: { code: orgCode } });
    if (!org) {
      throw new ApiError(
        500,
        `SSO auto-provisioning: organization code "${orgCode}" not found. Fix AZURE_SSO_JIT_ORG_CODE or create the organization.`,
      );
    }
    return org.id;
  }

  const org = await prisma.organization.findFirst({ orderBy: { id: "asc" } });
  if (!org) {
    throw new ApiError(
      503,
      "SSO auto-provisioning: no organization exists. Create an organization or set AZURE_SSO_JIT_ORG_CODE.",
    );
  }
  return org.id;
}

async function provisionJitUserFromMicrosoft(params: {
  emailNorm: string;
  displayName: string;
}): Promise<User & { role: Role }> {
  const roleName = process.env.AZURE_SSO_JIT_ROLE?.trim() || "USER";

  const role = await prisma.role.findFirst({ where: { name: roleName } });
  if (!role) {
    throw new ApiError(500, `SSO auto-provisioning: role "${roleName}" not found. Create it or set AZURE_SSO_JIT_ROLE.`);
  }

  const organizationId = await resolveJitOrganizationId(params.emailNorm);

  const passwordHash = await bcrypt.hash(`sso:${randomUUID()}:${Date.now()}`, 10);
  const name = params.displayName?.trim() || params.emailNorm.split("@")[0] || "User";

  const data: Prisma.UserCreateInput = {
    name,
    email: params.emailNorm,
    passwordHash,
    role: { connect: { id: role.id } },
    organization: { connect: { id: organizationId } },
    isActive: true,
  };

  try {
    return await prisma.user.create({ data, include: { role: true } });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.user.findFirst({
        where: { email: { equals: params.emailNorm, mode: "insensitive" } },
        include: { role: true },
      });
      if (existing) return existing;
    }
    throw e;
  }
}

async function issueCrmSessionFromMicrosoftAccessToken(accessToken: string): Promise<{ token: string; user: AuthUser }> {
  const tenantId = process.env.AZURE_TENANT_ID;
  if (!tenantId) {
    throw new ApiError(500, "Azure credentials not configured");
  }

  const tokenTid = readAccessTokenTenantId(accessToken);
  if (tokenTid && normalizeAzureGuid(tokenTid) !== normalizeAzureGuid(tenantId)) {
    throw new ApiError(403, "This sign-in is not allowed for this application directory.");
  }

  const userResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userResponse.ok) {
    throw new ApiError(401, "Failed to get user info from Microsoft");
  }

  const microsoftUser = await userResponse.json();
  const rawEmail = microsoftUser.mail || microsoftUser.userPrincipalName;

  if (!rawEmail || typeof rawEmail !== "string") {
    throw new ApiError(400, "Email not found in Microsoft account");
  }

  const emailNorm = rawEmail.trim().toLowerCase();

  let user = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    include: { role: true },
  });

  if (!user && emailNorm === "connectplus@cachedigitech.com") {
    let adminRole = await prisma.role.findFirst({
      where: { name: "ADMIN" },
    });

    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: {
          name: "ADMIN",
          permissionsJson: {},
        },
      });
    }

    let org = await prisma.organization.findFirst({
      where: { code: "cachedigitech-internal" },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: "Connectplus Internal",
          code: "cachedigitech-internal",
          modules: ["CRM"],
        },
      });
    }

    const tempPassword = await bcrypt.hash(Math.random().toString(36), 10);
    user = await prisma.user.create({
      data: {
        name: microsoftUser.displayName || "Admin",
        email: emailNorm,
        passwordHash: tempPassword,
        roleId: adminRole.id,
        organizationId: org.id,
        isActive: true,
      },
      include: { role: true },
    });
  }

  const jitDisabled = process.env.AZURE_SSO_DISABLE_JIT === "true";
  if (!user && !jitDisabled) {
    const allowedDomains = parseJitAllowedDomains();
    if (!isEmailDomainAllowedForJit(emailNorm, allowedDomains)) {
      throw new ApiError(
        403,
        "Your email domain is not permitted for Microsoft sign-in. Contact your administrator.",
      );
    }
    user = await provisionJitUserFromMicrosoft({
      emailNorm,
      displayName: typeof microsoftUser.displayName === "string" ? microsoftUser.displayName : "",
    });
  }

  if (!user) {
    throw new ApiError(
      403,
      "No CRM user exists for this Microsoft sign-in. Ask an administrator to add your work email under Administration → Users & Roles, or enable SSO auto-provisioning (see AZURE_SSO_* env vars).",
    );
  }
  if (!user.isActive) {
    throw new ApiError(403, "This account is disabled. Contact your administrator.");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(500, "JWT secret not configured");
  }

  const authUser: AuthUser = {
    id: user.id,
    role: user.role.name,
    department: user.department ?? null,
  };
  const token = jwt.sign(authUser, secret, { expiresIn: getJwtExpiresIn() });

  return { token, user: authUser };
}

export const authService = {
  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const emailNorm = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: "insensitive" } },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, "Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new ApiError(401, "Invalid credentials");
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new ApiError(500, "JWT secret not configured");
    }

    const authUser: AuthUser = {
      id: user.id,
      role: user.role.name,
      department: user.department ?? null,
    };
    const token = jwt.sign(authUser, secret, { expiresIn: getJwtExpiresIn() });

    return { token, user: authUser };
  },

  /** After browser redeems SPA auth code at Microsoft token endpoint (required for SPA client type; see AADSTS9002327). */
  async loginWithMicrosoftAccessToken(accessToken: string): Promise<{ token: string; user: AuthUser }> {
    try {
      return await issueCrmSessionFromMicrosoftAccessToken(accessToken.trim());
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(401, "Microsoft authentication failed");
    }
  },

  /** Server-side code exchange — only when AZURE_USE_CLIENT_SECRET=true (confidential / Web app registration). */
  async loginWithMicrosoftAuthorizationCode(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<{ token: string; user: AuthUser }> {
    try {
      const tenantId = process.env.AZURE_TENANT_ID;
      const clientId = process.env.AZURE_CLIENT_ID;
      const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
      const useClientSecret = process.env.AZURE_USE_CLIENT_SECRET === "true";

      if (!tenantId || !clientId) {
        throw new ApiError(500, "Azure credentials not configured");
      }
      if (!useClientSecret) {
        throw new ApiError(
          400,
          "SPA apps must exchange the authorization code in the browser, then send accessToken to this API. Enable AZURE_USE_CLIENT_SECRET only for a confidential Azure app registration.",
        );
      }
      if (!clientSecret) {
        throw new ApiError(500, "AZURE_CLIENT_SECRET is required when AZURE_USE_CLIENT_SECRET=true");
      }

      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      });

      const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenBody,
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new ApiError(401, `Failed to exchange code for token: ${errorData.error_description || errorData.error}`);
      }

      const tokenData = await tokenResponse.json();
      const at = tokenData.access_token as string | undefined;
      if (!at) {
        throw new ApiError(401, "No access token received from Microsoft");
      }

      return await issueCrmSessionFromMicrosoftAccessToken(at);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(401, "Microsoft authentication failed");
    }
  },
};

