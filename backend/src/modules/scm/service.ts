import { ApiError } from "../../middleware/errorHandler";
import { prisma } from "../../prisma";

const db = prisma as any;

async function ensureOpportunity(opportunityId: number) {
  const opportunity = await db.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      lead: true,
      purchaseOrders: {
        include: {
          scmOwner: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { poDate: "desc" },
      },
    },
  });

  if (!opportunity) {
    throw new ApiError(404, "Opportunity not found");
  }

  return opportunity;
}

async function ensureScmOrder(orderId: number) {
  const order = await db.scmOrder.findUnique({
    where: { id: orderId },
    include: {
      opportunity: true,
    },
  });

  if (!order) {
    throw new ApiError(404, "SCM order not found");
  }

  return order;
}

async function ensureWarehouseReceipt(receiptId: number) {
  const receipt = await db.warehouseReceipt.findUnique({
    where: { id: receiptId },
    include: {
      scmOrder: true,
    },
  });

  if (!receipt) {
    throw new ApiError(404, "Warehouse receipt not found");
  }

  return receipt;
}

async function ensureDispatch(dispatchId: number) {
  const dispatch = await db.dispatch.findUnique({
    where: { id: dispatchId },
    include: {
      warehouseReceipt: {
        include: {
          scmOrder: true,
        },
      },
    },
  });

  if (!dispatch) {
    throw new ApiError(404, "Dispatch not found");
  }

  return dispatch;
}

async function logScmStage(opportunityId: number, toStage: string, changedById?: number | null, notes?: string, fromStage?: string | null) {
  await db.scmStageHistory.create({
    data: {
      opportunityId,
      fromStage: fromStage ?? null,
      toStage,
      changedById: changedById ?? null,
      notes: notes ?? null,
    },
  });
}

export const scmService = {
  async getWorkflow(opportunityId: number) {
    const opportunity = await ensureOpportunity(opportunityId);

    const [stageHistory, ovfs, orders, receipts, dispatches, invoices, deployments, expenses, deploymentStageHistory] = await Promise.all([
      db.scmStageHistory.findMany({
        where: { opportunityId },
        orderBy: { changedAt: "desc" },
        include: {
          changedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      db.ovf.findMany({
        where: {
          purchaseOrder: { opportunityId },
        },
        include: {
          purchaseOrder: true,
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { id: "desc" },
      }),
      db.scmOrder.findMany({
        where: { opportunityId },
        include: {
          ovf: { include: { purchaseOrder: true } },
        },
        orderBy: { orderDate: "desc" },
      }),
      db.warehouseReceipt.findMany({
        where: {
          scmOrder: { opportunityId },
        },
        include: {
          receivedBy: {
            select: { id: true, name: true, email: true },
          },
          scmOrder: true,
        },
        orderBy: { receivedDate: "desc" },
      }),
      db.dispatch.findMany({
        where: {
          warehouseReceipt: {
            scmOrder: { opportunityId },
          },
        },
        include: {
          warehouseReceipt: {
            include: {
              scmOrder: true,
            },
          },
        },
        orderBy: { dispatchDate: "desc" },
      }),
      db.invoice.findMany({
        where: {
          dispatch: {
            warehouseReceipt: {
              scmOrder: { opportunityId },
            },
          },
        },
        include: {
          dispatch: true,
        },
        orderBy: { invoiceDate: "desc" },
      }),
      db.deployment.findMany({
        where: { opportunityId },
        include: {
          assignedTl: {
            select: { id: true, name: true, email: true },
          },
          dispatch: true,
          siteSurveys: true,
          balActivities: true,
          uatTestCases: true,
        },
        orderBy: { id: "desc" },
      }),
      db.scmExpense.findMany({
        where: {
          scmOrder: { opportunityId },
        },
        include: {
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
          scmOrder: true,
        },
        orderBy: { date: "desc" },
      }),
      db.deploymentStageHistory.findMany({
        where: {
          deployment: { opportunityId },
        },
        orderBy: { changedAt: "desc" },
      }),
    ]);

    const latestStage = stageHistory[0]?.toStage ?? (opportunity.purchaseOrders.length ? "PO_RECEIVED" : null);

    return {
      opportunity,
      currentStage: latestStage,
      purchaseOrders: opportunity.purchaseOrders,
      ovfs,
      orders,
      receipts,
      dispatches,
      invoices,
      deployments,
      deploymentSummary: {
        currentStage: deploymentStageHistory[0]?.toStage ?? deployments[0]?.stage ?? null,
        deploymentCount: deployments.length,
        surveyCount: deployments.reduce(
          (sum: number, deployment: any) => sum + (Array.isArray(deployment.siteSurveys) ? deployment.siteSurveys.length : 0),
          0,
        ),
      },
      expenses,
      stageHistory,
    };
  },

  async updateStage(opportunityId: number, stage: string, changedById?: number | null, notes?: string) {
    await ensureOpportunity(opportunityId);
    const latest = await db.scmStageHistory.findFirst({
      where: { opportunityId },
      orderBy: { changedAt: "desc" },
    });
    await logScmStage(opportunityId, stage, changedById, notes, latest?.toStage ?? null);
    return { stage };
  },

  async createOvf(opportunityId: number, payload: any, userId?: number | null) {
    await ensureOpportunity(opportunityId);
    const purchaseOrder = await db.purchaseOrder.findFirst({
      where: {
        id: payload.purchaseOrderId,
        opportunityId,
      },
    });

    if (!purchaseOrder) {
      throw new ApiError(404, "Purchase order not found for opportunity");
    }

    const ovf = await db.ovf.create({
      data: {
        purchaseOrderId: payload.purchaseOrderId,
        formData: payload.formData ?? {},
        approvedById: userId ?? null,
        approvedAt: userId ? new Date() : null,
        status: payload.status,
        turnaroundDays: payload.turnaroundDays ?? null,
        timeCalculationNotes: payload.timeCalculationNotes ?? null,
        attachmentUrl: payload.attachmentUrl || null,
      },
    });

    await logScmStage(opportunityId, "TIME_CALCULATION", userId, payload.timeCalculationNotes);
    return ovf;
  },

  async createOrder(opportunityId: number, payload: any, userId?: number | null) {
    await ensureOpportunity(opportunityId);
    const order = await db.scmOrder.create({
      data: {
        opportunityId,
        ovfId: payload.ovfId,
        distributorName: payload.distributorName,
        distributorPoRef: payload.distributorPoRef ?? null,
        orderDate: new Date(payload.orderDate),
        distributorSentAt: payload.distributorSentAt ? new Date(payload.distributorSentAt) : null,
        expectedDelivery: payload.expectedDelivery ? new Date(payload.expectedDelivery) : null,
        deliveredToWarehouseAt: payload.deliveredToWarehouseAt ? new Date(payload.deliveredToWarehouseAt) : null,
        status: payload.status,
        notes: payload.notes ?? null,
      },
    });

    await logScmStage(opportunityId, "PO_SENT_TO_DISTRIBUTOR", userId, payload.notes);
    return order;
  },

  async listOrders(opportunityId: number) {
    await ensureOpportunity(opportunityId);
    return db.scmOrder.findMany({
      where: { opportunityId },
      include: {
        ovf: { include: { purchaseOrder: true } },
      },
      orderBy: { orderDate: "desc" },
    });
  },

  async createWarehouseReceipt(orderId: number, payload: any, userId?: number | null) {
    const order = await ensureScmOrder(orderId);
    const receipt = await db.warehouseReceipt.create({
      data: {
        scmOrderId: orderId,
        receivedDate: new Date(payload.receivedDate),
        grnAttachmentUrl: payload.grnAttachmentUrl || null,
        mipMrmAttachmentUrl: payload.mipMrmAttachmentUrl || null,
        warehouseNotes: payload.warehouseNotes ?? null,
        receivedById: payload.receivedById,
      },
      include: {
        receivedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logScmStage(order.opportunityId, "DELIVERED_TO_WAREHOUSE", userId, payload.warehouseNotes);
    if (payload.mipMrmAttachmentUrl) {
      await logScmStage(order.opportunityId, "MIP_MRN_COLLECTED", userId, "MIP/MRN documents attached");
    }
    return receipt;
  },

  async createDispatch(receiptId: number, payload: any, userId?: number | null) {
    const receipt = await ensureWarehouseReceipt(receiptId);
    const dispatch = await db.dispatch.create({
      data: {
        warehouseReceiptId: receiptId,
        dispatchDate: new Date(payload.dispatchDate),
        vehicleDetails: payload.vehicleDetails ?? null,
        driverContact: payload.driverContact ?? null,
        challanUrl: payload.challanUrl || null,
        customerWarehouseReceiptUrl: payload.customerWarehouseReceiptUrl || null,
        accountsNotifiedAt: payload.accountsNotifiedAt ? new Date(payload.accountsNotifiedAt) : null,
        deliveryConfirmationUrl: payload.deliveryConfirmationUrl || null,
        deliveredAt: payload.deliveredAt ? new Date(payload.deliveredAt) : null,
      },
    });

    await logScmStage(receipt.scmOrder.opportunityId, "WAREHOUSE_TO_CUSTOMER", userId, payload.vehicleDetails);
    return dispatch;
  },

  async createInvoice(dispatchId: number, payload: any, userId?: number | null) {
    const dispatch = await ensureDispatch(dispatchId);
    const invoice = await db.invoice.create({
      data: {
        dispatchId,
        invoiceNumber: payload.invoiceNumber,
        invoiceDate: new Date(payload.invoiceDate),
        dueDate: new Date(payload.dueDate),
        lineItems: payload.lineItems,
        gst: payload.gst,
        grandTotal: payload.grandTotal,
        paymentTerms: payload.paymentTerms,
        bankDetails: payload.bankDetails,
        status: payload.status,
        sentToAccountsAt: payload.sentToAccountsAt ? new Date(payload.sentToAccountsAt) : new Date(),
        sentToCustomerAt: payload.sentToCustomerAt ? new Date(payload.sentToCustomerAt) : null,
        pdfUrl: payload.pdfUrl || null,
      },
    });

    const opportunityId = dispatch.warehouseReceipt.scmOrder.opportunityId;
    await logScmStage(opportunityId, "INVOICE_SENT_TO_ACCOUNTS", userId, payload.invoiceNumber);
    if (payload.sentToCustomerAt) {
      await logScmStage(opportunityId, "INVOICE_SENT_TO_CUSTOMER", userId, "Invoice forwarded to customer");
    }
    return invoice;
  },

  async createDeployment(dispatchId: number, payload: any, userId?: number | null) {
    await ensureDispatch(dispatchId);
    const deployment = await db.deployment.create({
      data: {
        opportunityId: payload.opportunityId,
        dispatchId,
        projectName: payload.projectName,
        customer: payload.customer,
        assignedTlId: payload.assignedTlId,
        stage: payload.stage,
        kickoffReadyAt: payload.kickoffReadyAt ? new Date(payload.kickoffReadyAt) : new Date(),
        sowSignoffUrl: payload.sowSignoffUrl || null,
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        expectedGolive: payload.expectedGolive ? new Date(payload.expectedGolive) : null,
        actualGolive: payload.actualGolive ? new Date(payload.actualGolive) : null,
        status: payload.status,
      },
      include: {
        assignedTl: {
          select: { id: true, name: true, email: true },
        },
        siteSurveys: true,
        balActivities: true,
        uatTestCases: true,
      },
    });

    await logScmStage(payload.opportunityId, "DEPLOYMENT_STARTED", userId, payload.projectName);
    await db.deploymentStageHistory.create({
      data: {
        deploymentId: deployment.id,
        toStage: "KICKOFF_MEETING",
        changedById: userId ?? null,
        notes: "Deployment created from SCM handoff",
      },
    });
    return deployment;
  },

  async createExpense(orderId: number, payload: any) {
    await ensureScmOrder(orderId);
    return db.scmExpense.create({
      data: {
        scmOrderId: orderId,
        category: payload.category,
        amount: payload.amount,
        date: new Date(payload.date),
        receiptUrl: payload.receiptUrl || null,
        status: payload.status,
        approvedById: payload.approvedById ?? null,
      },
    });
  },
};
