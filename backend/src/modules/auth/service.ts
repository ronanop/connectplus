import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import { AuthUser } from "../../types/auth";

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
    const token = jwt.sign(authUser, secret, { expiresIn: "8h" });

    return { token, user: authUser };
  },

  async loginWithMicrosoftCallback(code: string, codeVerifier: string, redirectUri: string): Promise<{ token: string; user: AuthUser }> {
    try {
      const tenantId = process.env.AZURE_TENANT_ID;
      const clientId = process.env.AZURE_CLIENT_ID;
      const clientSecret = process.env.AZURE_CLIENT_SECRET;

      if (!tenantId || !clientId || !clientSecret) {
        throw new ApiError(500, "Azure credentials not configured");
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code_verifier: codeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new ApiError(401, `Failed to exchange code for token: ${errorData.error_description || errorData.error}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        throw new ApiError(401, "No access token received from Microsoft");
      }

      // Get user info from Microsoft Graph
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

      // Match CRM user by email case-insensitively (Graph mail vs UPN vs DB casing can differ)
      let user = await prisma.user.findFirst({
        where: { email: { equals: emailNorm, mode: "insensitive" } },
        include: { role: true },
      });

      // If user doesn't exist and email is connectplus@cachedigitech.com, create admin user
      if (!user && emailNorm === "connectplus@cachedigitech.com") {
        // Find or create ADMIN role
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

        // Find or create organization
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

        // Create user with a random password (won't be used for SSO)
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

      if (!user) {
        throw new ApiError(
          403,
          "No CRM user exists for this Microsoft sign-in. Ask an administrator to add your work email under Administration → Users & Roles, then try again.",
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
      const token = jwt.sign(authUser, secret, { expiresIn: "8h" });

      return { token, user: authUser };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(401, "Microsoft authentication failed");
    }
  },
};

