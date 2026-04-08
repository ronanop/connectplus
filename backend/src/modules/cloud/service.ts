import { ApiError } from "../../middleware/errorHandler";
import { prisma } from "../../prisma";

const db = prisma as any;

async function ensureCloudEngagement(id: number) {
  const engagement = await db.cloudEngagement.findUnique({
    where: { id },
    include: {
      deployment: {
        include: {
          opportunity: true,
        },
      },
      assignedTl: {
        select: { id: true, name: true, email: true },
      },
      project: {
        include: {
          tasks: {
            include: {
              assignedTo: { select: { id: true, name: true, email: true } },
              dailyUpdates: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!engagement) {
    throw new ApiError(404, "Cloud engagement not found");
  }

  return engagement;
}

async function ensureDeployment(deploymentId: number) {
  const deployment = await db.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      opportunity: true,
    },
  });

  if (!deployment) {
    throw new ApiError(404, "Deployment not found");
  }

  return deployment;
}

async function logCloudStage(cloudEngagementId: number, toStage: string, changedById?: number | null, notes?: string, fromStage?: string | null) {
  await db.cloudStageHistory.create({
    data: {
      cloudEngagementId,
      fromStage: fromStage ?? null,
      toStage,
      changedById: changedById ?? null,
      notes: notes ?? null,
    },
  });
}

export const cloudService = {
  async listCloudEngagements() {
    return db.cloudEngagement.findMany({
      include: {
        deployment: {
          include: {
            opportunity: {
              select: { id: true, companyName: true, contactName: true },
            },
          },
        },
        assignedTl: {
          select: { id: true, name: true, email: true },
        },
        project: true,
        _count: {
          select: { stageHistory: true },
        },
      },
      orderBy: { id: "desc" },
    });
  },

  async createCloudEngagement(payload: any, userId?: number | null) {
    await ensureDeployment(payload.deploymentId);
    const engagement = await db.cloudEngagement.create({
      data: {
        deploymentId: payload.deploymentId,
        projectId: payload.projectId ?? null,
        engagementName: payload.engagementName,
        customer: payload.customer,
        assignedTlId: payload.assignedTlId,
        stage: "REQUIREMENTS_ASSIGNED",
        status: "ACTIVE",
        supportModel: payload.supportModel ?? null,
        notes: payload.notes ?? null,
      },
      include: {
        assignedTl: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logCloudStage(engagement.id, "REQUIREMENTS_ASSIGNED", userId, "Cloud engagement created");
    return engagement;
  },

  async getWorkflow(id: number) {
    const engagement = await ensureCloudEngagement(id);
    const stageHistory = await db.cloudStageHistory.findMany({
      where: { cloudEngagementId: id },
      include: {
        changedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { changedAt: "desc" },
    });

    return {
      engagement,
      currentStage: stageHistory[0]?.toStage ?? engagement.stage ?? null,
      tasks: engagement.project?.tasks ?? [],
      stageHistory,
    };
  },

  async updateStage(id: number, stage: string, changedById?: number | null, notes?: string) {
    const engagement = await ensureCloudEngagement(id);
    const updated = await db.cloudEngagement.update({
      where: { id },
      data: {
        stage,
        status: stage === "CONTINUOUS_WORKING" ? "ONGOING_SUPPORT" : engagement.status,
        validatedAt: stage === "TESTING_VALIDATION" ? new Date() : undefined,
        supportStartedAt: stage === "OPTIMIZATION_SUPPORT" || stage === "CONTINUOUS_WORKING" ? new Date() : undefined,
      },
    });
    await logCloudStage(id, stage, changedById, notes, engagement.stage ?? null);
    return updated;
  },

  async saveIntake(id: number, payload: any, changedById?: number | null) {
    const engagement = await ensureCloudEngagement(id);
    const updated = await db.cloudEngagement.update({
      where: { id },
      data: {
        intakeJson: payload,
        stage: "REQUIREMENTS_ASSIGNED",
      },
    });
    await logCloudStage(id, "REQUIREMENTS_ASSIGNED", changedById, payload.notes, engagement.stage ?? null);
    return updated;
  },

  async saveAssessment(id: number, payload: any, changedById?: number | null) {
    const engagement = await ensureCloudEngagement(id);
    const updated = await db.cloudEngagement.update({
      where: { id },
      data: {
        assessmentJson: payload,
        stage: "ASSESSMENT_PLANNING",
      },
    });
    await logCloudStage(id, "ASSESSMENT_PLANNING", changedById, payload.assessmentNotes, engagement.stage ?? null);
    return updated;
  },

  async saveArchitecturePlan(id: number, payload: any, changedById?: number | null) {
    const engagement = await ensureCloudEngagement(id);
    const updated = await db.cloudEngagement.update({
      where: { id },
      data: {
        architecturePlanJson: payload,
        stage: "ARCHITECTURE_COSTING",
      },
    });
    await logCloudStage(id, "ARCHITECTURE_COSTING", changedById, payload.notes, engagement.stage ?? null);
    return updated;
  },

  async saveSecurityFramework(id: number, payload: any, changedById?: number | null) {
    const engagement = await ensureCloudEngagement(id);
    const updated = await db.cloudEngagement.update({
      where: { id },
      data: {
        securityFrameworkJson: payload,
        stage: "SECURITY_STANDARDS",
      },
    });
    await logCloudStage(id, "SECURITY_STANDARDS", changedById, payload.notes, engagement.stage ?? null);
    return updated;
  },

  async saveMigration(id: number, payload: any, changedById?: number | null) {
    const engagement = await ensureCloudEngagement(id);
    const updated = await db.cloudEngagement.update({
      where: { id },
      data: {
        projectId: payload.projectId ?? engagement.projectId ?? null,
        migrationJson: payload,
        migrationStartedAt: payload.migrationStartedAt ? new Date(payload.migrationStartedAt) : new Date(),
        stage: "IMPLEMENTATION_MIGRATION",
      },
    });
    await logCloudStage(id, "IMPLEMENTATION_MIGRATION", changedById, payload.notes, engagement.stage ?? null);
    return updated;
  },

  async saveManagedSupport(id: number, payload: any, changedById?: number | null) {
    const engagement = await ensureCloudEngagement(id);
    const updated = await db.cloudEngagement.update({
      where: { id },
      data: {
        managedSupportJson: payload,
        supportStartedAt: payload.supportStartedAt ? new Date(payload.supportStartedAt) : new Date(),
        stage: "OPTIMIZATION_SUPPORT",
      },
    });
    await logCloudStage(id, "OPTIMIZATION_SUPPORT", changedById, payload.notes, engagement.stage ?? null);
    return updated;
  },
};
