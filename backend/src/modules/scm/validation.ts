import { z } from "zod";

export const scmStageEnum = z.enum([
  "PO_RECEIVED",
  "TIME_CALCULATION",
  "PO_SENT_TO_DISTRIBUTOR",
  "DELIVERED_TO_WAREHOUSE",
  "WAREHOUSE_TO_CUSTOMER",
  "MIP_MRN_COLLECTED",
  "INVOICE_SENT_TO_ACCOUNTS",
  "INVOICE_SENT_TO_CUSTOMER",
  "DEPLOYMENT_STARTED",
]);

export const updateScmStageSchema = z.object({
  stage: scmStageEnum,
  notes: z.string().optional(),
});

export const createOvfSchema = z.object({
  purchaseOrderId: z.number().int(),
  status: z.string().min(1).default("TIME_CALCULATION"),
  turnaroundDays: z.number().int().nonnegative().optional(),
  timeCalculationNotes: z.string().optional(),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
  formData: z.record(z.any()).optional(),
});

export const createScmOrderSchema = z.object({
  ovfId: z.number().int(),
  distributorName: z.string().min(1),
  distributorPoRef: z.string().optional(),
  orderDate: z.string().datetime(),
  distributorSentAt: z.string().datetime().optional(),
  expectedDelivery: z.string().datetime().optional(),
  deliveredToWarehouseAt: z.string().datetime().optional(),
  status: z.string().min(1).default("PO_SENT_TO_DISTRIBUTOR"),
  notes: z.string().optional(),
});

export const createWarehouseReceiptSchema = z.object({
  receivedDate: z.string().datetime(),
  grnAttachmentUrl: z.string().url().optional().or(z.literal("")),
  mipMrmAttachmentUrl: z.string().url().optional().or(z.literal("")),
  warehouseNotes: z.string().optional(),
  receivedById: z.number().int(),
});

export const createDispatchSchema = z.object({
  dispatchDate: z.string().datetime(),
  vehicleDetails: z.string().optional(),
  driverContact: z.string().optional(),
  challanUrl: z.string().url().optional().or(z.literal("")),
  customerWarehouseReceiptUrl: z.string().url().optional().or(z.literal("")),
  accountsNotifiedAt: z.string().datetime().optional(),
  deliveryConfirmationUrl: z.string().url().optional().or(z.literal("")),
  deliveredAt: z.string().datetime().optional(),
});

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  lineItems: z.array(z.unknown()).default([]),
  gst: z.record(z.any()).default({}),
  grandTotal: z.number().nonnegative(),
  paymentTerms: z.string().min(1),
  bankDetails: z.record(z.any()).default({}),
  status: z.string().min(1).default("INVOICE_SENT_TO_ACCOUNTS"),
  sentToAccountsAt: z.string().datetime().optional(),
  sentToCustomerAt: z.string().datetime().optional(),
  pdfUrl: z.string().url().optional().or(z.literal("")),
});

export const createDeploymentSchema = z.object({
  opportunityId: z.number().int(),
  projectName: z.string().min(1),
  customer: z.string().min(1),
  assignedTlId: z.number().int(),
  stage: z.string().min(1).default("DEPLOYMENT_STARTED"),
  kickoffReadyAt: z.string().datetime().optional(),
  sowSignoffUrl: z.string().url().optional().or(z.literal("")),
  startDate: z.string().datetime().optional(),
  expectedGolive: z.string().datetime().optional(),
  actualGolive: z.string().datetime().optional(),
  status: z.string().min(1).default("STARTED"),
});

export const createScmExpenseSchema = z.object({
  category: z.string().min(1),
  amount: z.number().nonnegative(),
  date: z.string().datetime(),
  receiptUrl: z.string().url().optional().or(z.literal("")),
  status: z.string().min(1).default("PENDING"),
  approvedById: z.number().int().nullable().optional(),
});
