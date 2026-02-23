import { prisma } from "../../prisma";

export const opportunitiesService = {
  async listOpportunities(params: { search?: string; stage?: string; page: number; pageSize: number }) {
    const existingCount = await prisma.opportunity.count();
    if (existingCount === 0) {
      const seedLeads = await prisma.lead.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      });

      if (seedLeads.length > 0) {
        await prisma.opportunity.createMany({
          data: seedLeads.map(lead => ({
            leadId: lead.id,
            companyName: lead.companyName,
            contactName: lead.contactName,
            assignedToId: lead.assignedToId,
            stage: lead.status === "Won" ? "Won" : "Qualification",
            estimatedValue: lead.estimatedValue ?? null,
          })),
        });
      }
    }

    const where: any = {};

    if (params.stage && params.stage !== "All") {
      where.stage = params.stage;
    }

    if (params.search) {
      const search = params.search;
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
      ];
    }

    try {
      const [items, total] = await Promise.all([
        prisma.opportunity.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: {
            assignedTo: {
              select: { id: true, name: true },
            },
            lead: {
              select: {
                id: true,
                companyName: true,
                contactName: true,
                status: true,
              },
            },
          },
          skip: (params.page - 1) * params.pageSize,
          take: params.pageSize,
        }),
        prisma.opportunity.count({ where }),
      ]);

      return {
        items,
        total,
        page: params.page,
        pageSize: params.pageSize,
      };
    } catch (error) {
      console.error("Error in listOpportunities:", error);
      throw error;
    }
  },

  async getOpportunityById(id: number) {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
        lead: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
            phone: true,
            source: true,
            status: true,
          },
        },
      },
    });

    return opportunity;
  },

  async deleteOpportunity(id: number) {
    await prisma.opportunity.delete({
      where: { id },
    });
  },
};
