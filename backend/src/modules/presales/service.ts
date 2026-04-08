import { differenceInDays } from "date-fns";
import { prisma } from "../../prisma";
import { presalesStageEnum, priorityEnum } from "./validation";

const db = prisma as any;

type ListProjectsParams = {
  search?: string;
  linkedLeadId?: string;
  stage?: (typeof presalesStageEnum)["options"][number] | "All";
  priority?: (typeof priorityEnum)["options"][number] | "All";
  status?: string;
  page: number;
  pageSize: number;
};

const totalRequirementFields = 5;

const countFilledRequirementFields = (requirements: {
  rawNotes: string | null;
  functionalReq: unknown | null;
  technicalReq: unknown | null;
  constraints: string | null;
  stakeholders: unknown | null;
} | null) => {
  if (!requirements) {
    return 0;
  }

  let count = 0;

  if (requirements.rawNotes && requirements.rawNotes.trim().length > 0) {
    count += 1;
  }

  if (requirements.functionalReq) {
    count += 1;
  }

  if (requirements.technicalReq) {
    count += 1;
  }

  if (requirements.constraints && requirements.constraints.trim().length > 0) {
    count += 1;
  }

  if (requirements.stakeholders) {
    count += 1;
  }

  return count;
};

const calculateWinProbability = (params: {
  project: { expectedCloseDate: Date | null };
  poc: { outcome: string | null } | null;
  proposal: { status: string | null } | null;
  requirements: {
    rawNotes: string | null;
    functionalReq: unknown | null;
    technicalReq: unknown | null;
    constraints: string | null;
    stakeholders: unknown | null;
  } | null;
}) => {
  let score = 0;

  if (params.poc?.outcome === "success") {
    score += 30;
  } else if (params.poc?.outcome === "partial") {
    score += 15;
  } else if (params.poc?.outcome === "fail") {
    score -= 10;
  }

  if (params.proposal?.status === "accepted") {
    score += 40;
  } else if (params.proposal?.status === "sent") {
    score += 20;
  }

  const filledReqFields = countFilledRequirementFields(params.requirements);
  score += (filledReqFields / totalRequirementFields) * 20;

  if (params.project.expectedCloseDate) {
    const daysToClose = differenceInDays(params.project.expectedCloseDate, new Date());
    if (daysToClose < 7) {
      score += 10;
    } else if (daysToClose < 30) {
      score += 5;
    }
  }

  return Math.max(0, Math.min(100, score));
};

export const presalesService = {
  async listProjects(params: ListProjectsParams) {
    const where: any = {};

    if (params.stage && params.stage !== "All") {
      where.currentStage = params.stage;
    }

    if (params.priority && params.priority !== "All") {
      where.priority = params.priority;
    }

    if (params.status && params.status !== "All") {
      where.status = params.status;
    }

    if (params.search) {
      const search = params.search;
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { clientName: { contains: search, mode: "insensitive" } },
        { assignedTo: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params.linkedLeadId) {
      where.leadId = params.linkedLeadId;
    }

    const [items, total] = await Promise.all([
      db.presalesProject.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      db.presalesProject.count({ where }),
    ]);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  },

  async getProjectById(id: string) {
    const project = await db.presalesProject.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { completedAt: "desc" },
        },
        boq: true,
        poc: true,
        proposal: true,
        requirements: true,
        solution: true,
        activities: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return project;
  },

  async createProject(payload: any) {
    const project = await db.presalesProject.create({
      data: {
        leadId: payload.leadId ?? null,
        title: payload.title,
        clientName: payload.clientName,
        assignedTo: payload.assignedTo,
        assignedBy: payload.assignedBy,
        currentStage: payload.currentStage ?? "LEAD_HANDOVER",
        priority: payload.priority ?? "MEDIUM",
        estimatedValue: payload.estimatedValue ?? null,
        expectedCloseDate: payload.expectedCloseDate ? new Date(payload.expectedCloseDate) : null,
        handoffSummary: payload.handoffSummary ?? null,
        winProbability: payload.winProbability ?? 0,
        status: payload.status ?? "active",
        lostReason: payload.lostReason ?? null,
        notes: payload.notes ?? null,
      },
    });

    await db.presalesStageLog.create({
      data: {
        projectId: project.id,
        stage: project.currentStage,
        completedBy: payload.assignedTo,
        notes: null,
        timeTakenMinutes: null,
      },
    });

    return project;
  },

  async updateProject(id: string, payload: any) {
    const existing = await db.presalesProject.findUnique({
      where: { id },
      include: {
        requirements: true,
        solution: true,
        poc: true,
        proposal: true,
      },
    });

    if (!existing) {
      throw new Error("Presales project not found");
    }

    const project = await db.presalesProject.update({
      where: { id },
      data: {
        leadId: payload.leadId ?? undefined,
        title: payload.title ?? undefined,
        clientName: payload.clientName ?? undefined,
        assignedTo: payload.assignedTo ?? undefined,
        assignedBy: payload.assignedBy ?? undefined,
        currentStage: payload.currentStage ?? undefined,
        priority: payload.priority ?? undefined,
        estimatedValue: payload.estimatedValue ?? undefined,
        expectedCloseDate:
          payload.expectedCloseDate !== undefined
            ? payload.expectedCloseDate
              ? new Date(payload.expectedCloseDate)
              : null
            : undefined,
        handoffSummary: payload.handoffSummary ?? undefined,
        winProbability: payload.winProbability ?? undefined,
        status: payload.status ?? undefined,
        lostReason: payload.lostReason ?? undefined,
        notes: payload.notes ?? undefined,
      },
    });

    const requirements = existing.requirements;
    const poc = existing.poc;
    const proposal = existing.proposal;

    const winProbability = calculateWinProbability({
      project,
      poc,
      proposal,
      requirements,
    });

    const updated = await db.presalesProject.update({
      where: { id },
      data: {
        winProbability,
      },
    });

    return updated;
  },

  async getSummary() {
    const [activeCount, byStageRaw, stageLogs, closedProjects, pendingBoqCount] = await Promise.all([
      db.presalesProject.count({
        where: { status: "active" },
      }),
      db.presalesProject.groupBy({
        by: ["currentStage"],
        _count: { _all: true },
      }),
      db.presalesStageLog.findMany({
        where: {
          timeTakenMinutes: {
            not: null,
          },
        },
        select: {
          timeTakenMinutes: true,
        },
      }),
      db.presalesProject.findMany({
        where: {
          OR: [{ status: "closed" }, { currentStage: "CLOSED" }],
        },
        select: {
          lostReason: true,
        },
      }),
      db.bOQ.count({
        where: {
          status: "submitted",
        },
      }),
    ]);

    const byStage = byStageRaw.map((row: any) => ({
      stage: row.currentStage,
      count: row._count._all,
    }));

    let averageStageDurationDays = 0;
    if (stageLogs.length > 0) {
      const totalMinutes = stageLogs.reduce((sum: number, log: any) => sum + (log.timeTakenMinutes ?? 0), 0);
      const averageMinutes = totalMinutes / stageLogs.length;
      averageStageDurationDays = Math.round(averageMinutes / (60 * 24));
    }

    let winRatePercent = 0;
    if (closedProjects.length > 0) {
      let won = 0;
      let lost = 0;
      closedProjects.forEach((project: any) => {
        if (project.lostReason && project.lostReason.trim().length > 0) {
          lost += 1;
        } else {
          won += 1;
        }
      });
      const total = won + lost;
      if (total > 0) {
        winRatePercent = Math.round((won / total) * 100);
      }
    }

    return {
      activeCount,
      byStage,
      averageStageDurationDays,
      winRatePercent,
      boqPendingReviewCount: pendingBoqCount,
    };
  },

  async convertToOpportunity(projectId: string, userId?: number | null) {
    const project = await db.presalesProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Presales project not found");
    }

    if (!project.leadId) {
      throw new Error("Presales project is not linked to a lead");
    }

    const leadId = parseInt(project.leadId, 10);

    if (!Number.isFinite(leadId)) {
      throw new Error("Linked lead id is invalid");
    }

    const { leadsService } = await import("../leads/service");

    const conversion = await leadsService.convertLeadToOpportunity(leadId, userId ?? null);

    await db.presalesProject.update({
      where: { id: projectId },
      data: {
        convertedOpportunityId: conversion.opportunity.id,
      },
    });

    return conversion;
  },

  async listStages(projectId: string) {
    return db.presalesStageLog.findMany({
      where: { projectId },
      orderBy: { completedAt: "asc" },
    });
  },

  async advanceStage(projectId: string, actorName: string, notes?: string | null) {
    const project = await db.presalesProject.findUnique({
      where: { id: projectId },
      include: {
        stages: {
          orderBy: { completedAt: "asc" },
        },
        requirements: true,
        poc: true,
        proposal: true,
      },
    });

    if (!project) {
      throw new Error("Presales project not found");
    }

    const currentStageIndex = presalesStageEnum.options.indexOf(project.currentStage);

    if (currentStageIndex === -1 || currentStageIndex === presalesStageEnum.options.length - 1) {
      return project;
    }

    const lastStageLog = project.stages[project.stages.length - 1] ?? null;
    const now = new Date();

    let timeTakenMinutes: number | null = null;
    if (lastStageLog) {
      const diffMs = now.getTime() - lastStageLog.completedAt.getTime();
      timeTakenMinutes = Math.round(diffMs / (1000 * 60));
    }

    const nextStage = presalesStageEnum.options[currentStageIndex + 1];

    const updatedProject = await db.presalesProject.update({
      where: { id: projectId },
      data: {
        currentStage: nextStage,
      },
    });

    await db.presalesStageLog.create({
      data: {
        projectId,
        stage: nextStage,
        completedBy: actorName,
        notes: notes ?? null,
        timeTakenMinutes,
      },
    });

    const winProbability = calculateWinProbability({
      project: updatedProject,
      poc: project.poc,
      proposal: project.proposal,
      requirements: project.requirements,
    });

    return db.presalesProject.update({
      where: { id: projectId },
      data: {
        winProbability,
      },
    });
  },

  async getRequirementDoc(projectId: string) {
    return db.requirementDoc.findUnique({
      where: { projectId },
    });
  },

  async upsertRequirementDoc(projectId: string, payload: any) {
    const existing = await db.presalesProject.findUnique({
      where: { id: projectId },
      include: {
        requirements: true,
        poc: true,
        proposal: true,
      },
    });

    if (!existing) {
      throw new Error("Presales project not found");
    }

    const requirements = await db.requirementDoc.upsert({
      where: { projectId },
      update: {
        rawNotes: payload.rawNotes ?? undefined,
        functionalReq: payload.functionalReq ?? undefined,
        technicalReq: payload.technicalReq ?? undefined,
        scopeSplit: payload.scopeSplit ?? undefined,
        timelineNotes: payload.timelineNotes ?? undefined,
        complianceSecurity: payload.complianceSecurity ?? undefined,
        handoffNotes: payload.handoffNotes ?? undefined,
        constraints: payload.constraints ?? undefined,
        stakeholders: payload.stakeholders ?? undefined,
        completedAt: new Date(),
      },
      create: {
        projectId,
        rawNotes: payload.rawNotes ?? null,
        functionalReq: payload.functionalReq ?? null,
        technicalReq: payload.technicalReq ?? null,
        scopeSplit: payload.scopeSplit ?? null,
        timelineNotes: payload.timelineNotes ?? null,
        complianceSecurity: payload.complianceSecurity ?? null,
        handoffNotes: payload.handoffNotes ?? null,
        constraints: payload.constraints ?? null,
        stakeholders: payload.stakeholders ?? null,
        completedAt: new Date(),
      },
    });

    const winProbability = calculateWinProbability({
      project: existing,
      poc: existing.poc,
      proposal: existing.proposal,
      requirements,
    });

    await db.presalesProject.update({
      where: { id: projectId },
      data: {
        winProbability,
      },
    });

    return { requirements };
  },

  async upsertSolutionDesign(projectId: string, payload: any) {
    const existing = await db.presalesProject.findUnique({
      where: { id: projectId },
    });

    if (!existing) {
      throw new Error("Presales project not found");
    }

    const solution = await db.solutionDesign.upsert({
      where: { projectId },
      update: {
        architectureUrl: payload.architectureUrl ?? undefined,
        diagramUrl: payload.diagramUrl ?? undefined,
        techStack: payload.techStack ?? undefined,
        systemDesignSummary: payload.systemDesignSummary ?? undefined,
        deploymentTopology: payload.deploymentTopology ?? undefined,
        infraComponents: payload.infraComponents ?? undefined,
        finalizedStack: payload.finalizedStack ?? undefined,
        competitors: payload.competitors ?? undefined,
        recommendedOption: payload.recommendedOption ?? undefined,
        justification: payload.justification ?? undefined,
        completedAt: new Date(),
      },
      create: {
        projectId,
        architectureUrl: payload.architectureUrl ?? null,
        diagramUrl: payload.diagramUrl ?? null,
        techStack: payload.techStack ?? null,
        systemDesignSummary: payload.systemDesignSummary ?? null,
        deploymentTopology: payload.deploymentTopology ?? null,
        infraComponents: payload.infraComponents ?? null,
        finalizedStack: payload.finalizedStack ?? null,
        competitors: payload.competitors ?? null,
        recommendedOption: payload.recommendedOption ?? null,
        justification: payload.justification ?? null,
        completedAt: new Date(),
      },
    });

    return { solution };
  },

  async upsertBoq(projectId: string, payload: any) {
    const existing = await db.presalesProject.findUnique({
      where: { id: projectId },
    });

    if (!existing) {
      throw new Error("Presales project not found");
    }

    let computedTotal: number | null = null;
    if (Array.isArray(payload.lineItems)) {
      computedTotal = payload.lineItems.reduce((sum: number, item: any) => {
        const quantity = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity ?? "0");
        const negotiatedPrice =
          typeof item.negotiatedPrice === "number" ? item.negotiatedPrice : parseFloat(item.negotiatedPrice ?? "0");
        if (!Number.isFinite(quantity) || !Number.isFinite(negotiatedPrice)) {
          return sum;
        }
        return sum + quantity * negotiatedPrice;
      }, 0);
    }

    const boq = await db.bOQ.upsert({
      where: { projectId },
      update: {
        lineItems: payload.lineItems ?? undefined,
        totalValue: computedTotal ?? undefined,
        oemName: payload.oemName ?? undefined,
        validity: payload.validity ? new Date(payload.validity) : undefined,
        attachmentUrl: payload.attachmentUrl ?? undefined,
        effortDays: payload.effortDays ?? undefined,
        resourceCount: payload.resourceCount ?? undefined,
        status: payload.status ?? undefined,
        completedAt: payload.status === "submitted" ? new Date() : undefined,
      },
      create: {
        projectId,
        lineItems: payload.lineItems ?? [],
        totalValue: computedTotal ?? null,
        oemName: payload.oemName ?? null,
        validity: payload.validity ? new Date(payload.validity) : null,
        attachmentUrl: payload.attachmentUrl ?? null,
        effortDays: payload.effortDays ?? null,
        resourceCount: payload.resourceCount ?? null,
        status: payload.status ?? "draft",
        completedAt: payload.status === "submitted" ? new Date() : null,
      },
    });

    return { boq };
  },

  async submitBoq(projectId: string) {
    const existing = await db.bOQ.findUnique({
      where: { projectId },
    });

    if (!existing) {
      throw new Error("BOQ not found for project");
    }

    const boq = await db.bOQ.update({
      where: { projectId },
      data: {
        status: "submitted",
      },
    });

    return { boq };
  },

  async upsertPoc(projectId: string, payload: any) {
    const project = await db.presalesProject.findUnique({
      where: { id: projectId },
      include: {
        requirements: true,
        poc: true,
        proposal: true,
      },
    });

    if (!project) {
      throw new Error("Presales project not found");
    }

    const poc = await db.pOC.upsert({
      where: { projectId },
      update: {
        objective: payload.objective ?? undefined,
        scope: payload.scope ?? undefined,
        successCriteria: payload.successCriteria ?? undefined,
        environment: payload.environment ?? undefined,
        startDate: payload.startDate ? new Date(payload.startDate) : undefined,
        endDate: payload.endDate ? new Date(payload.endDate) : undefined,
        outcome: payload.outcome ?? undefined,
        findings: payload.findings ?? undefined,
        evidenceUrls: payload.evidenceUrls ?? undefined,
        status: payload.status ?? undefined,
        gatingStatus: payload.gatingStatus ?? undefined,
        waiverReason: payload.waiverReason ?? undefined,
      },
      create: {
        projectId,
        objective: payload.objective ?? null,
        scope: payload.scope ?? null,
        successCriteria: payload.successCriteria ?? [],
        environment: payload.environment ?? null,
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        outcome: payload.outcome ?? null,
        findings: payload.findings ?? null,
        evidenceUrls: payload.evidenceUrls ?? [],
        status: payload.status ?? "planned",
        gatingStatus: payload.gatingStatus ?? null,
        waiverReason: payload.waiverReason ?? null,
      },
    });

    const winProbability = calculateWinProbability({
      project,
      poc,
      proposal: project.proposal,
      requirements: project.requirements,
    });

    await db.presalesProject.update({
      where: { id: projectId },
      data: {
        winProbability,
      },
    });

    return { poc };
  },

  async setPocOutcome(projectId: string, outcome: string) {
    const project = await db.presalesProject.findUnique({
      where: { id: projectId },
      include: {
        requirements: true,
        poc: true,
        proposal: true,
      },
    });

    if (!project) {
      throw new Error("Presales project not found");
    }

    const poc = await db.pOC.upsert({
      where: { projectId },
      update: {
        outcome,
        status: outcome === "success" || outcome === "partial" || outcome === "fail" ? "completed" : undefined,
      },
      create: {
        projectId,
        objective: null,
        scope: null,
        successCriteria: [],
        environment: null,
        startDate: null,
        endDate: null,
        outcome,
        findings: null,
        evidenceUrls: [],
        status: outcome === "success" || outcome === "partial" || outcome === "fail" ? "completed" : "planned",
      },
    });

    const winProbability = calculateWinProbability({
      project,
      poc,
      proposal: project.proposal,
      requirements: project.requirements,
    });

    await db.presalesProject.update({
      where: { id: projectId },
      data: {
        winProbability,
      },
    });

    return { poc };
  },

  async upsertProposal(projectId: string, payload: any) {
    const project = await db.presalesProject.findUnique({
      where: { id: projectId },
      include: {
        requirements: true,
        poc: true,
        proposal: true,
      },
    });

    if (!project) {
      throw new Error("Presales project not found");
    }

    const proposal = await db.proposal.upsert({
      where: { projectId },
      update: {
        executiveSummary: payload.executiveSummary ?? undefined,
        scopeOfWork: payload.scopeOfWork ?? undefined,
        technicalApproach: payload.technicalApproach ?? undefined,
        commercials: payload.commercials ?? undefined,
        timeline: payload.timeline ?? undefined,
        teamStructure: payload.teamStructure ?? undefined,
        proposalSummary: payload.proposalSummary ?? undefined,
        termsConditions: payload.termsConditions ?? undefined,
        closureSupportNotes: payload.closureSupportNotes ?? undefined,
        readyForSalesAt: payload.readyForSalesAt ? new Date(payload.readyForSalesAt) : undefined,
        status: payload.status ?? undefined,
        completedAt: payload.status === "sent" ? new Date() : undefined,
      },
      create: {
        projectId,
        executiveSummary: payload.executiveSummary ?? null,
        scopeOfWork: payload.scopeOfWork ?? null,
        technicalApproach: payload.technicalApproach ?? null,
        commercials: payload.commercials ?? null,
        timeline: payload.timeline ?? null,
        teamStructure: payload.teamStructure ?? null,
        proposalSummary: payload.proposalSummary ?? null,
        termsConditions: payload.termsConditions ?? null,
        closureSupportNotes: payload.closureSupportNotes ?? null,
        readyForSalesAt: payload.readyForSalesAt ? new Date(payload.readyForSalesAt) : null,
        status: payload.status ?? "draft",
        completedAt: payload.status === "sent" ? new Date() : null,
      },
    });

    const winProbability = calculateWinProbability({
      project,
      poc: project.poc,
      proposal,
      requirements: project.requirements,
    });

    await db.presalesProject.update({
      where: { id: projectId },
      data: {
        winProbability,
      },
    });

    return { proposal };
  },

  async listBoqBoard() {
    const items = await db.bOQ.findMany({
      orderBy: { completedAt: "desc" },
      include: {
        project: true,
      },
    });

    return items;
  },

  async listPocBoard() {
    const items = await db.pOC.findMany({
      orderBy: { startDate: "desc" },
      include: {
        project: true,
      },
    });

    return items;
  },

  async listProposalBoard() {
    const items = await db.proposal.findMany({
      orderBy: { sentAt: "desc" },
      include: {
        project: true,
      },
    });

    return items;
  },
};
