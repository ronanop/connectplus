import { prisma } from "../../prisma";
import { HR_MODULES } from "./hrModules";

export const hrService = {
  listModules() {
    return [...HR_MODULES];
  },

  async getOrganizationIdForUser(userId: number): Promise<number | null> {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return row?.organizationId ?? null;
  },

  async listHrDepartments(organizationId: number) {
    return prisma.hrDepartment.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  },
};
