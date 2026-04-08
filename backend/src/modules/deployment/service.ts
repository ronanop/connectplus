import { ApiError } from "../../middleware/errorHandler";
import { prisma } from "../../prisma";

const db = prisma as any;

async function ensureDeployment(deploymentId: number) {
  const deployment = await db.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      assignedTl: {
        select: { id: true, name: true, email: true },
      },
      dispatch: true,
      opportunity: true,
    },
  });

  if (!deployment) {
    throw new ApiError(404, "Deployment not found");
  }

  return deployment;
}

async function logDeploymentStage(deploymentId: number, toStage: string, changedById?: number | null, notes?: string, fromStage?: string | null) {
  await db.deploymentStageHistory.create({
    data: {
      deploymentId,
      fromStage: fromStage ?? null,
      toStage,
      changedById: changedById ?? null,
      notes: notes ?? null,
    },
  });
}

export const deploymentService = {
  async listDeployments() {
    return db.deployment.findMany({
      include: {
        assignedTl: {
          select: { id: true, name: true, email: true },
        },
        opportunity: {
          select: { id: true, companyName: true, contactName: true },
        },
        _count: {
          select: {
            siteSurveys: true,
            balActivities: true,
            uatTestCases: true,
            stageHistory: true,
            cloudEngagements: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });
  },

  async getWorkflow(deploymentId: number) {
    const deployment = await ensureDeployment(deploymentId);
    const [siteSurveys, balActivities, uatTestCases, stageHistory, cloudEngagements, cloudStageHistory] = await Promise.all([
      db.siteSurvey.findMany({
        where: { deploymentId },
        orderBy: { id: "desc" },
      }),
      db.balActivity.findMany({
        where: { deploymentId },
        include: {
          assignedEngineer: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { id: "desc" },
      }),
      db.uatTestCase.findMany({
        where: { deploymentId },
        include: {
          testedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { id: "desc" },
      }),
      db.deploymentStageHistory.findMany({
        where: { deploymentId },
        include: {
          changedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { changedAt: "desc" },
      }),
      db.cloudEngagement.findMany({
        where: { deploymentId },
        include: {
          assignedTl: {
            select: { id: true, name: true, email: true },
          },
          project: true,
        },
        orderBy: { id: "desc" },
      }),
      db.cloudStageHistory.findMany({
        where: {
          cloudEngagement: { deploymentId },
        },
        orderBy: { changedAt: "desc" },
      }),
    ]);

    return {
      deployment,
      siteSurveys,
      balActivities,
      uatTestCases,
      cloudEngagements,
      cloudSummary: {
        currentStage: cloudStageHistory[0]?.toStage ?? cloudEngagements[0]?.stage ?? null,
        engagementCount: cloudEngagements.length,
        linkedProjectCount: cloudEngagements.filter((engagement: any) => engagement.projectId != null).length,
      },
      stageHistory,
      currentStage: stageHistory[0]?.toStage ?? deployment.stage ?? null,
    };
  },

  async updateStage(deploymentId: number, stage: string, changedById?: number | null, notes?: string) {
    const deployment = await ensureDeployment(deploymentId);
    await db.deployment.update({
      where: { id: deploymentId },
      data: {
        stage,
        status: stage === "LIVE" ? "LIVE" : deployment.status,
      },
    });
    await logDeploymentStage(deploymentId, stage, changedById, notes, deployment.stage ?? null);
    return { stage };
  },

  async createKickoff(deploymentId: number, payload: any, changedById?: number | null) {
    const deployment = await ensureDeployment(deploymentId);
    const updated = await db.deployment.update({
      where: { id: deploymentId },
      data: {
        stage: "KICKOFF_MEETING",
        status: "IN_PROGRESS",
        kickoffCompletedAt: payload.kickoffCompletedAt ? new Date(payload.kickoffCompletedAt) : new Date(),
        expectedGolive: payload.expectedGolive ? new Date(payload.expectedGolive) : deployment.expectedGolive,
      },
    });
    await logDeploymentStage(deploymentId, "KICKOFF_MEETING", changedById, payload.notes, deployment.stage ?? null);
    return updated;
  },

  async createSiteSurvey(deploymentId: number, payload: any, changedById?: number | null) {
    await ensureDeployment(deploymentId);
    const record = await db.siteSurvey.create({
      data: {
        deploymentId,
        surveyData: payload.surveyData ?? {},
        floorPlanUrl: payload.floorPlanUrl || null,
        readinessStatus: payload.readinessStatus ?? null,
        engineerSignatureUrl: payload.engineerSignatureUrl || null,
        customerSignatureUrl: payload.customerSignatureUrl || null,
        submittedAt: payload.submittedAt ? new Date(payload.submittedAt) : new Date(),
      },
    });
    await db.deployment.update({
      where: { id: deploymentId },
      data: { stage: "SITE_SURVEY", status: "IN_PROGRESS" },
    });
    await logDeploymentStage(deploymentId, "SITE_SURVEY", changedById, payload.readinessStatus);
    return record;
  },

  async listSiteSurveys(deploymentId: number) {
    await ensureDeployment(deploymentId);
    return db.siteSurvey.findMany({
      where: { deploymentId },
      orderBy: { id: "desc" },
    });
  },

  async createBalActivity(deploymentId: number, payload: any, changedById?: number | null) {
    await ensureDeployment(deploymentId);
    const record = await db.balActivity.create({
      data: {
        deploymentId,
        taskName: payload.taskName,
        assignedEngineerId: payload.assignedEngineerId ?? null,
        estimatedHours: payload.estimatedHours,
        dependencyIds: payload.dependencyIds ?? null,
        taskCategory: payload.taskCategory ?? null,
        status: payload.status,
      },
      include: {
        assignedEngineer: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    await db.deployment.update({
      where: { id: deploymentId },
      data: { stage: "INSTALLATION_STARTED", status: "IN_PROGRESS" },
    });
    await logDeploymentStage(deploymentId, "INSTALLATION_STARTED", changedById, payload.taskName);
    return record;
  },

  async updateBalActivity(activityId: number, payload: any, changedById?: number | null) {
    const existing = await db.balActivity.findUnique({
      where: { id: activityId },
    });
    if (!existing) {
      throw new ApiError(404, "BAL activity not found");
    }
    const record = await db.balActivity.update({
      where: { id: activityId },
      data: {
        taskName: payload.taskName ?? undefined,
        assignedEngineerId: payload.assignedEngineerId ?? undefined,
        estimatedHours: payload.estimatedHours ?? undefined,
        dependencyIds: payload.dependencyIds ?? undefined,
        taskCategory: payload.taskCategory ?? undefined,
        status: payload.status ?? undefined,
        completedAt: payload.completedAt ? new Date(payload.completedAt) : payload.completedAt === null ? null : undefined,
      },
      include: {
        assignedEngineer: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    if (payload.status === "PUNCH_LIST") {
      await db.deployment.update({
        where: { id: existing.deploymentId },
        data: { stage: "PUNCH_LIST", status: "IN_PROGRESS" },
      });
      await logDeploymentStage(existing.deploymentId, "PUNCH_LIST", changedById, payload.taskName ?? existing.taskName);
    }
    return record;
  },

  async createUatTestCase(deploymentId: number, payload: any, changedById?: number | null) {
    await ensureDeployment(deploymentId);
    const record = await db.uatTestCase.create({
      data: {
        deploymentId,
        testName: payload.testName,
        expectedResult: payload.expectedResult,
        actualResult: payload.actualResult ?? null,
        passFail: payload.passFail ?? null,
        comments: payload.comments ?? null,
        signedOffByCustomer: payload.signedOffByCustomer ?? null,
        signoffAt: payload.signoffAt ? new Date(payload.signoffAt) : null,
        testedById: payload.testedById ?? null,
        testedAt: payload.testedAt ? new Date(payload.testedAt) : null,
      },
      include: {
        testedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    await db.deployment.update({
      where: { id: deploymentId },
      data: { stage: "UAT_IN_PROGRESS", status: "IN_PROGRESS" },
    });
    await logDeploymentStage(deploymentId, "UAT_IN_PROGRESS", changedById, payload.testName);
    return record;
  },

  async updateUatTestCase(testCaseId: number, payload: any, changedById?: number | null) {
    const existing = await db.uatTestCase.findUnique({
      where: { id: testCaseId },
    });
    if (!existing) {
      throw new ApiError(404, "UAT test case not found");
    }
    const record = await db.uatTestCase.update({
      where: { id: testCaseId },
      data: {
        actualResult: payload.actualResult ?? undefined,
        passFail: payload.passFail ?? undefined,
        comments: payload.comments ?? undefined,
        testedById: payload.testedById ?? undefined,
        testedAt: payload.testedAt ? new Date(payload.testedAt) : payload.testedAt === null ? null : undefined,
        signedOffByCustomer: payload.signedOffByCustomer ?? undefined,
        signoffAt: payload.signoffAt ? new Date(payload.signoffAt) : payload.signoffAt === null ? null : undefined,
      },
      include: {
        testedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (payload.passFail === "PASS" && payload.signedOffByCustomer) {
      await db.deployment.update({
        where: { id: existing.deploymentId },
        data: { stage: "UAT_COMPLETED", status: "READY_FOR_LIVE" },
      });
      await logDeploymentStage(existing.deploymentId, "UAT_COMPLETED", changedById, existing.testName);
    }

    return record;
  },

  async goLive(deploymentId: number, payload: any, changedById?: number | null) {
    const deployment = await ensureDeployment(deploymentId);
    const updated = await db.deployment.update({
      where: { id: deploymentId },
      data: {
        stage: "LIVE",
        status: "LIVE",
        actualGolive: payload.actualGolive ? new Date(payload.actualGolive) : new Date(),
        liveAt: payload.liveAt ? new Date(payload.liveAt) : new Date(),
        customerSignoffUrl: payload.customerSignoffUrl || null,
      },
    });
    await logDeploymentStage(deploymentId, "LIVE", changedById, payload.notes, deployment.stage ?? null);
    return updated;
  },
};
