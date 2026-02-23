import { prisma } from "../../prisma";
import { leadStatusEnum } from "./validation";

const defaultStatuses = leadStatusEnum.options;

export const leadsService = {
  async ensureDemoData() {
    const count = await prisma.lead.count();
    if (count > 0) {
      return;
    }

    const admin = await prisma.user.findFirst({
      where: { email: "admin@cachedigitech.com" },
    });

    const assignedToId = admin?.id ?? null;

    await prisma.lead.createMany({
      data: [
        {
          companyName: "Zenora Health Systems",
          contactName: "Aritra Singh",
          designation: "IT Head",
          phone: "+91-9876543210",
          email: "aritra.singh@zenorahealth.com",
          source: "Inbound – Website",
          industry: "Healthcare",
          city: "Mumbai",
          state: "Maharashtra",
          requirement: "Enterprise CRM rollout across 12 hospitals with OPD integration",
          estimatedValue: 18000000,
          status: "Qualified",
          assignedToId,
        },
        {
          companyName: "Northfield Logistics",
          contactName: "Megha Rao",
          designation: "COO",
          phone: "+91-9833011122",
          email: "megha.rao@northfieldlogistics.in",
          source: "Partner – Channel",
          industry: "Logistics",
          city: "Bengaluru",
          state: "Karnataka",
          requirement: "Control tower for fleet, invoicing and collections",
          estimatedValue: 12500000,
          status: "Proposal",
          assignedToId,
        },
        {
          companyName: "Aurelius Finance",
          contactName: "Rahul Verma",
          designation: "CIO",
          phone: "+91-9819002211",
          email: "rahul.verma@aureliusfinance.com",
          source: "Outbound – SDR",
          industry: "Financial Services",
          city: "Delhi",
          state: "Delhi NCR",
          requirement: "Unified CRM for wealth, retail and SME lending teams",
          estimatedValue: 22000000,
          status: "New",
          assignedToId,
        },
        {
          companyName: "Inspire Edu Global",
          contactName: "Sneha Kulkarni",
          designation: "Digital Transformation Lead",
          phone: "+91-9920445566",
          email: "sneha.k@inspireedu.org",
          source: "Event – Trade Show",
          industry: "Education",
          city: "Pune",
          state: "Maharashtra",
          requirement: "Student lifecycle CRM with counselling and placements module",
          estimatedValue: 9000000,
          status: "Contacted",
          assignedToId,
        },
      ],
    });
  },

  async listLeads(params: { search?: string; status?: string; page: number; pageSize: number }) {
    await this.ensureDemoData();

    const where: any = {};

    if (params.status && params.status !== "All") {
      where.status = params.status;
    }

    if (params.search) {
      const search = params.search;
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
        { industry: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          assignedTo: {
            select: { id: true, name: true },
          },
        },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  },

  async createLead(payload: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    source: string;
    industry?: string;
    city?: string;
    state?: string;
    requirement?: string;
    estimatedValue?: number;
    status: string;
    assignedToId?: number | null;
  }) {
    const lead = await prisma.lead.create({
      data: {
        companyName: payload.companyName,
        contactName: payload.contactName,
        email: payload.email,
        phone: payload.phone,
        source: payload.source,
        industry: payload.industry,
        city: payload.city,
        state: payload.state,
        requirement: payload.requirement,
        estimatedValue: payload.estimatedValue ?? null,
        status: payload.status,
        assignedToId: payload.assignedToId ?? null,
      },
    });

    return lead;
  },

  async getLeadById(id: number) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, name: true },
        },
        opportunities: {
          select: {
            id: true,
            stage: true,
            estimatedValue: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return lead;
  },

  async updateLead(id: number, payload: any, userId?: number | null) {
    const existing = await prisma.lead.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Lead not found");
    }

    const data: any = {};

    const assignIfPresent = (key: keyof typeof existing, value: unknown) => {
      if (typeof value !== "undefined") {
        data[key] = value;
      }
    };

    assignIfPresent("companyName", payload.companyName);
    assignIfPresent("contactName", payload.contactName);
    assignIfPresent("email", payload.email);
    assignIfPresent("phone", payload.phone);
    assignIfPresent("source", payload.source);
    assignIfPresent("industry", payload.industry ?? null);
    assignIfPresent("city", payload.city ?? null);
    assignIfPresent("state", payload.state ?? null);
    assignIfPresent("requirement", payload.requirement ?? null);
    assignIfPresent("estimatedValue", typeof payload.estimatedValue === "number" ? payload.estimatedValue : null);
    assignIfPresent("assignedToId", typeof payload.assignedToId === "number" ? payload.assignedToId : null);

    if (typeof payload.status === "string") {
      data.status = payload.status;
    }

    if (typeof payload.lostReason === "string") {
      data.lostReason = payload.lostReason;
    }

    const updated = await prisma.lead.update({
      where: { id },
      data,
    });

    const changedFields: string[] = [];
    (["companyName", "contactName", "email", "phone", "source", "industry", "city", "state", "requirement", "estimatedValue", "assignedToId", "status", "lostReason"] as const).forEach(
      key => {
        if ((existing as any)[key] !== (updated as any)[key]) {
          changedFields.push(key);
        }
      },
    );

    if (changedFields.length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action: "Field Updated",
          entityType: "lead",
          entityId: id,
          metadata: {
            changedFields,
          },
        },
      });
    }

    if (payload.status && payload.status !== existing.status) {
      await prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action: "Status Changed",
          entityType: "lead",
          entityId: id,
          metadata: {
            from: existing.status,
            to: payload.status,
            lostReason: payload.lostReason ?? null,
          },
        },
      });
    }

    return updated;
  },

  async updateLeadStatus(id: number, status: string, userId?: number | null) {
    const lead = await prisma.lead.update({
      where: { id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "Status Changed",
        entityType: "lead",
        entityId: id,
        metadata: {
          from: lead.status,
          to: status,
        },
      },
    });

    return lead;
  },

  async convertLeadToOpportunity(id: number, userId?: number | null) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        opportunities: true,
      },
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    const existingOpportunity = lead.opportunities[0];

    let opportunity = existingOpportunity;

    if (!opportunity) {
      opportunity = await prisma.opportunity.create({
        data: {
          leadId: lead.id,
          companyName: lead.companyName,
          contactName: lead.contactName,
          assignedToId: lead.assignedToId,
          stage: "Qualification",
          estimatedValue: lead.estimatedValue,
        } as any,
      });
    }

    const shouldUpgradeStatus = lead.status === "New" || lead.status === "Contacted";

    const updatedLead = shouldUpgradeStatus
      ? await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "Qualified" },
        })
      : lead;

    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "Lead Converted",
        entityType: "lead",
        entityId: id,
        metadata: {
          opportunityId: opportunity.id,
        },
      },
    });

    return { lead: updatedLead, opportunity };
  },

  async addNote(leadId: number, body: string, userId?: number | null) {
    const note = await prisma.leadNote.create({
      data: {
        leadId,
        authorId: userId ?? null,
        body,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "Note Added",
        entityType: "lead",
        entityId: leadId,
        metadata: {
          noteId: note.id,
        },
      },
    });

    return note;
  },

  async sendEmail(leadId: number, payload: { to: string; subject: string; body: string }, userId?: number | null) {
    const email = await prisma.leadEmail.create({
      data: {
        leadId,
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        createdById: userId ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "Email Sent",
        entityType: "lead",
        entityId: leadId,
        metadata: {
          emailId: email.id,
        },
      },
    });

    return email;
  },

  async getTimeline(leadId: number, params: { type?: string | null; page: number; pageSize: number }) {
    const where: any = {
      entityType: "lead",
      entityId: leadId,
    };

    if (params.type && params.type !== "All") {
      where.action = params.type;
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  },

  async getActivities(leadId: number) {
    const activities = await prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { dueDate: "asc" },
    });

    const open = activities.filter(activity => activity.status !== "Completed" && activity.status !== "Closed");
    const closed = activities.filter(activity => activity.status === "Completed" || activity.status === "Closed");

    return {
      open,
      closed,
    };
  },

  async getPipelineSummary() {
    await this.ensureDemoData();

    const groups = await prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const stages = defaultStatuses.map(status => {
      const group = groups.find(g => g.status === status);
      return {
        status,
        count: group?._count._all ?? 0,
      };
    });

    return stages;
  },
};
