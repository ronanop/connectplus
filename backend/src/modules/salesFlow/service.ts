import { ApiError } from "../../middleware/errorHandler";
import { prisma } from "../../prisma";

const db = prisma as any;

async function ensureOpportunity(opportunityId: number) {
  const opportunity = await db.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      lead: true,
      salesOwner: {
        select: { id: true, name: true },
      },
      isrOwner: {
        select: { id: true, name: true },
      },
    },
  });

  if (!opportunity) {
    throw new ApiError(404, "Opportunity not found");
  }

  return opportunity;
}

export const salesFlowService = {
  async getWorkflow(opportunityId: number) {
    const opportunity = await ensureOpportunity(opportunityId);

    const [oemAlignments, vendorQuotes, clientQuotes, followUps, purchaseOrders, stageHistory, presalesProjects, scmStageHistory, ovfs, scmOrders, warehouseReceipts, dispatches, invoices, deployments] =
      await Promise.all([
        db.oemAlignment.findMany({
          where: { opportunityId },
          orderBy: { createdAt: "desc" },
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        db.vendorQuote.findMany({
          where: { opportunityId },
          orderBy: { receivedDate: "desc" },
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        db.clientQuoteSubmission.findMany({
          where: { opportunityId },
          orderBy: { submittedDate: "desc" },
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
            vendorQuote: true,
          },
        }),
        db.clientFollowUp.findMany({
          where: { opportunityId },
          orderBy: { followupDate: "desc" },
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        db.purchaseOrder.findMany({
          where: { opportunityId },
          orderBy: { poDate: "desc" },
        }),
        db.opportunityStageHistory.findMany({
          where: { opportunityId },
          orderBy: { changedAt: "desc" },
          include: {
            changedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        db.presalesProject.findMany({
          where: { leadId: String(opportunity.leadId) },
          include: {
            boq: true,
            proposal: true,
            requirements: true,
            solution: true,
          },
          orderBy: { updatedAt: "desc" },
        }),
        db.scmStageHistory.findMany({
          where: { opportunityId },
          orderBy: { changedAt: "desc" },
        }),
        db.ovf.findMany({
          where: { purchaseOrder: { opportunityId } },
          orderBy: { id: "desc" },
        }),
        db.scmOrder.findMany({
          where: { opportunityId },
          orderBy: { orderDate: "desc" },
        }),
        db.warehouseReceipt.findMany({
          where: { scmOrder: { opportunityId } },
          orderBy: { receivedDate: "desc" },
        }),
        db.dispatch.findMany({
          where: { warehouseReceipt: { scmOrder: { opportunityId } } },
          orderBy: { dispatchDate: "desc" },
        }),
        db.invoice.findMany({
          where: { dispatch: { warehouseReceipt: { scmOrder: { opportunityId } } } },
          orderBy: { invoiceDate: "desc" },
        }),
        db.deployment.findMany({
          where: { opportunityId },
          orderBy: { id: "desc" },
        }),
      ]);

    const scmSummary = {
      currentStage: scmStageHistory[0]?.toStage ?? (purchaseOrders.length ? "PO_RECEIVED" : null),
      ovfCount: ovfs.length,
      orderCount: scmOrders.length,
      warehouseReceiptCount: warehouseReceipts.length,
      dispatchCount: dispatches.length,
      invoiceCount: invoices.length,
      deploymentCount: deployments.length,
    };

    return {
      opportunity,
      oemAlignments,
      vendorQuotes,
      clientQuotes,
      followUps,
      purchaseOrders,
      stageHistory,
      presalesProjects,
      scmSummary,
    };
  },

  async createOemAlignment(opportunityId: number, payload: any) {
    await ensureOpportunity(opportunityId);
    return db.oemAlignment.create({
      data: {
        opportunityId,
        vendorName: payload.vendorName,
        notes: payload.notes ?? null,
        status: payload.status,
        ownerId: payload.ownerId ?? null,
      },
    });
  },

  async listOemAlignments(opportunityId: number) {
    await ensureOpportunity(opportunityId);
    return db.oemAlignment.findMany({
      where: { opportunityId },
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async createVendorQuote(opportunityId: number, payload: any) {
    await ensureOpportunity(opportunityId);
    return db.vendorQuote.create({
      data: {
        opportunityId,
        oemAlignmentId: payload.oemAlignmentId ?? null,
        vendorName: payload.vendorName,
        referenceNumber: payload.referenceNumber ?? null,
        amount: payload.amount ?? null,
        pricingJson: payload.pricingJson ?? null,
        receivedDate: new Date(payload.receivedDate),
        validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
        attachmentUrl: payload.attachmentUrl || null,
        remarks: payload.remarks ?? null,
        ownerId: payload.ownerId ?? null,
      },
    });
  },

  async listVendorQuotes(opportunityId: number) {
    await ensureOpportunity(opportunityId);
    return db.vendorQuote.findMany({
      where: { opportunityId },
      orderBy: { receivedDate: "desc" },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async createClientQuote(opportunityId: number, payload: any) {
    await ensureOpportunity(opportunityId);
    return db.clientQuoteSubmission.create({
      data: {
        opportunityId,
        vendorQuoteId: payload.vendorQuoteId ?? null,
        quoteNumber: payload.quoteNumber,
        version: payload.version ?? "1",
        amount: payload.amount ?? null,
        submittedDate: new Date(payload.submittedDate),
        attachmentUrl: payload.attachmentUrl || null,
        status: payload.status,
        ownerId: payload.ownerId ?? null,
      },
    });
  },

  async listClientQuotes(opportunityId: number) {
    await ensureOpportunity(opportunityId);
    return db.clientQuoteSubmission.findMany({
      where: { opportunityId },
      orderBy: { submittedDate: "desc" },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        vendorQuote: true,
      },
    });
  },

  async createFollowUp(opportunityId: number, payload: any) {
    await ensureOpportunity(opportunityId);
    return db.clientFollowUp.create({
      data: {
        opportunityId,
        clientQuoteId: payload.clientQuoteId ?? null,
        followupDate: new Date(payload.followupDate),
        mode: payload.mode,
        summary: payload.summary,
        nextFollowupDate: payload.nextFollowupDate ? new Date(payload.nextFollowupDate) : null,
        ownerId: payload.ownerId ?? null,
      },
    });
  },

  async listFollowUps(opportunityId: number) {
    await ensureOpportunity(opportunityId);
    return db.clientFollowUp.findMany({
      where: { opportunityId },
      orderBy: { followupDate: "desc" },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  },

  async closeWon(opportunityId: number, userId: number, notes?: string) {
    await ensureOpportunity(opportunityId);
    const opportunity = await db.opportunity.update({
      where: { id: opportunityId },
      data: {
        salesStage: "WON",
        stage: "Won",
        closureStatus: "WON",
        closureReason: notes ?? null,
      },
    });

    await db.opportunityStageHistory.create({
      data: {
        opportunityId,
        toStage: "WON",
        changedById: userId,
        notes: notes ?? null,
      },
    });

    return opportunity;
  },

  async closeLost(opportunityId: number, userId: number, reason: string, notes?: string) {
    await ensureOpportunity(opportunityId);
    const opportunity = await db.opportunity.update({
      where: { id: opportunityId },
      data: {
        salesStage: "LOST",
        stage: "Lost",
        closureStatus: "LOST",
        closureReason: reason,
        lostReason: reason,
      },
    });

    await db.opportunityStageHistory.create({
      data: {
        opportunityId,
        toStage: "LOST",
        changedById: userId,
        notes: [reason, notes].filter(Boolean).join(" - ") || null,
      },
    });

    return opportunity;
  },

  async createPurchaseOrder(opportunityId: number, payload: any) {
    await ensureOpportunity(opportunityId);
    const po = await db.purchaseOrder.create({
      data: {
        opportunityId,
        quotationId: payload.quotationId ?? null,
        clientQuoteSubmissionId: payload.clientQuoteSubmissionId ?? null,
        poNumber: payload.poNumber,
        poDate: new Date(payload.poDate),
        poValue: payload.poValue,
        attachmentUrl: payload.attachmentUrl || null,
        scmOwnerId: payload.scmOwnerId ?? null,
        scmHandoffAt: payload.scmHandoffAt ? new Date(payload.scmHandoffAt) : new Date(),
        internalEtaDays: payload.internalEtaDays ?? null,
        status: payload.status,
      },
    });

    await db.opportunity.update({
      where: { id: opportunityId },
      data: {
        salesStage: "PO_RECEIVED",
        stage: "Won",
        closureStatus: "WON",
      },
    });

    await db.scmStageHistory.create({
      data: {
        opportunityId,
        toStage: "PO_RECEIVED",
        notes: "Purchase order received and handed off to SCM",
      },
    });

    return po;
  },
};
