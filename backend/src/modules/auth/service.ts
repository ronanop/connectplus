import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import { AuthUser } from "../../types/auth";

export const authService = {
  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const user = await prisma.user.findUnique({
      where: { email },
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

    const authUser: AuthUser = { id: user.id, role: user.role.name };
    const token = jwt.sign(authUser, secret, { expiresIn: "8h" });

    return { token, user: authUser };
  },
};

