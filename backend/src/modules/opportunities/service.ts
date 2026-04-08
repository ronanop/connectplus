import { ApiError } from "../../middleware/errorHandler";
import { prisma } from "../../prisma";

const SALES_STAGE_TO_LEGACY_STAGE: Record<string, string> = {
  LEAD_GENERATION: "Qualification",
  OEM_ALIGNMENT: "Qualification",
  BOQ_SCOPE_FINALIZING: "Proposal",
  FOLLOW_UP_CLIENT: "Negotiation",
  QUOTE_RECEIVING: "Proposal",
  QUOTE_SUBMISSION: "Proposal",
  WON: "Won",
  LOST: "Lost",
  PO_RECEIVED: "Won",
};

const db = prisma as any;

export const opportunitiesService = {
  async listOpportunities(params: { search?: string; stage?: string; page: number; pageSize: number }) {
    const existingCount = await db.opportunity.count();
    if (existingCount === 0) {
      const seedLeads = await db.lead.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      });

      if (seedLeads.length > 0) {
        await db.opportunity.createMany({
          data: seedLeads.map((lead: any) => ({
            leadId: lead.id,
            companyName: lead.companyName,
            contactName: lead.contactName,
            assignedToId: lead.assignedToId,
            salesOwnerId: lead.entryOwnerType === "SALES" ? lead.assignedToId : null,
            isrOwnerId: lead.entryOwnerType === "ISR" ? lead.assignedToId : null,
            stage: lead.status === "Won" ? "Won" : "Qualification",
            salesStage: "LEAD_GENERATION",
            estimatedValue: lead.estimatedValue ?? null,
          })),
        });
      }
    }

    const where: any = {};

    if (params.stage && params.stage !== "All") {
      where.OR = [{ stage: params.stage }, { salesStage: params.stage }];
    }

    if (params.search) {
      const search = params.search;
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { companyName: { contains: search, mode: "insensitive" } },
            { contactName: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      db.opportunity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          assignedTo: {
            select: { id: true, name: true },
          },
          salesOwner: {
            select: { id: true, name: true },
          },
          isrOwner: {
            select: { id: true, name: true },
          },
          lead: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              status: true,
              leadType: true,
              entryOwnerType: true,
            },
          },
          _count: {
            select: {
              oemAlignments: true,
              vendorQuotes: true,
              clientQuotes: true,
              clientFollowUps: true,
              purchaseOrders: true,
              scmStageHistory: true,
            },
          },
        },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      db.opportunity.count({ where }),
    ]);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  },

  async getOpportunityById(id: number) {
    return db.opportunity.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
        salesOwner: {
          select: { id: true, name: true },
        },
        isrOwner: {
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
            city: true,
            state: true,
            industry: true,
            requirement: true,
            leadType: true,
            entryOwnerType: true,
          },
        },
        _count: {
          select: {
            oemAlignments: true,
            vendorQuotes: true,
            clientQuotes: true,
            clientFollowUps: true,
            purchaseOrders: true,
            scmStageHistory: true,
          },
        },
        purchaseOrders: {
          orderBy: { poDate: "desc" },
          include: {
            scmOwner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        scmStageHistory: {
          orderBy: { changedAt: "desc" },
          take: 5,
        },
      },
    });
  },

  async updateOpportunityStage(id: number, salesStage: string, userId?: number | null, notes?: string) {
    const existing = await db.opportunity.findUnique({
      where: { id },
      select: {
        id: true,
        salesStage: true,
        stage: true,
      },
    });

    if (!existing) {
      throw new ApiError(404, "Opportunity not found");
    }

    const stage = SALES_STAGE_TO_LEGACY_STAGE[salesStage] ?? existing.stage;

    const opportunity = await db.opportunity.update({
      where: { id },
      data: {
        salesStage,
        stage,
        closureStatus: salesStage === "WON" ? "WON" : salesStage === "LOST" ? "LOST" : null,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
        salesOwner: {
          select: { id: true, name: true },
        },
        isrOwner: {
          select: { id: true, name: true },
        },
      },
    });

    await db.opportunityStageHistory.create({
      data: {
        opportunityId: id,
        fromStage: existing.salesStage,
        toStage: salesStage,
        changedById: userId ?? null,
        notes: notes ?? null,
      },
    });

    return opportunity;
  },

  async deleteOpportunity(id: number) {
    await db.opportunity.delete({
      where: { id },
    });
  },
};
