import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";

export const companiesService = {
  async listCompanies(params: { search?: string; page: number; pageSize: number }) {
    const where: {
      OR?: Array<Record<string, { contains: string; mode: "insensitive" }>>;
    } = {};

    if (params.search?.trim()) {
      const s = params.search.trim();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { industry: { contains: s, mode: "insensitive" } },
        { city: { contains: s, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          _count: { select: { leads: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return {
      items: items.map(({ _count, ...rest }) => ({
        ...rest,
        leadCount: _count.leads,
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  },

  async getCompanyById(id: number) {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        leads: {
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            contactName: true,
            email: true,
            status: true,
            createdAt: true,
            assignedTo: { select: { id: true, name: true } },
          },
        },
        _count: { select: { leads: true } },
      },
    });
    return company;
  },

  async createCompany(
    data: {
      name: string;
      website?: string;
      phone?: string;
      industry?: string;
      city?: string;
      state?: string;
      notes?: string;
    },
    userId: number,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    const cleanWebsite = data.website?.trim() ? data.website.trim() : null;

    return prisma.company.create({
      data: {
        name: data.name.trim(),
        website: cleanWebsite,
        phone: data.phone?.trim() || null,
        industry: data.industry?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        notes: data.notes?.trim() || null,
        organizationId: user?.organizationId ?? null,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { leads: true } },
      },
    });
  },

  async updateCompany(
    id: number,
    data: Partial<{
      name: string;
      website: string | null;
      phone: string | null;
      industry: string | null;
      city: string | null;
      state: string | null;
      notes: string | null;
    }>,
  ) {
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Company not found");
    }
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) {
      patch.name = data.name.trim();
    }
    if (data.website !== undefined) {
      patch.website = data.website?.trim() || null;
    }
    if (data.phone !== undefined) {
      patch.phone = data.phone?.trim() || null;
    }
    if (data.industry !== undefined) {
      patch.industry = data.industry?.trim() || null;
    }
    if (data.city !== undefined) {
      patch.city = data.city?.trim() || null;
    }
    if (data.state !== undefined) {
      patch.state = data.state?.trim() || null;
    }
    if (data.notes !== undefined) {
      patch.notes = data.notes?.trim() || null;
    }
    return prisma.company.update({
      where: { id },
      data: patch as object,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { leads: true } },
      },
    });
  },

  async deleteCompany(id: number) {
    const n = await prisma.lead.count({ where: { companyId: id } });
    if (n > 0) {
      throw new ApiError(400, `Cannot delete company: ${n} lead(s) are still linked. Reassign or remove those leads first.`);
    }
    await prisma.company.delete({ where: { id } });
    return { deleted: true };
  },
};
