import { startOfMonth, subMonths } from "date-fns";
import { prisma } from "../../prisma";

const defaultPreferenceConfig = {
  showLeadOwner: true,
  showOpportunityStage: true,
  showLeadSource: true,
  showOpportunityOwner: true,
};

export const dashboardService = {
  async getAdminSummary() {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));

    const [leadCounts, opportunityCounts, quotationCounts] = await Promise.all([
      prisma.lead.groupBy({
        by: ["createdAt"],
        _count: { _all: true },
        where: {
          createdAt: {
            gte: previousMonthStart,
          },
        },
      }),
      prisma.opportunity.groupBy({
        by: ["createdAt"],
        _count: { _all: true },
        where: {
          createdAt: {
            gte: previousMonthStart,
          },
        },
      }),
      prisma.quotation.groupBy({
        by: ["date"],
        _count: { _all: true },
        where: {
          date: {
            gte: previousMonthStart,
          },
        },
      }),
    ]);

    const isCurrentMonth = (date: Date) => date >= currentMonthStart;

    const leadThisMonth = leadCounts.filter(row => isCurrentMonth(row.createdAt)).reduce((sum, row) => sum + row._count._all, 0);
    const leadLastMonth = leadCounts
      .filter(row => row.createdAt >= previousMonthStart && row.createdAt < currentMonthStart)
      .reduce((sum, row) => sum + row._count._all, 0);

    const opportunityThisMonth = opportunityCounts
      .filter(row => isCurrentMonth(row.createdAt))
      .reduce((sum, row) => sum + row._count._all, 0);
    const opportunityLastMonth = opportunityCounts
      .filter(row => row.createdAt >= previousMonthStart && row.createdAt < currentMonthStart)
      .reduce((sum, row) => sum + row._count._all, 0);

    const quotationThisMonth = quotationCounts
      .filter(row => isCurrentMonth(row.date))
      .reduce((sum, row) => sum + row._count._all, 0);
    const quotationLastMonth = quotationCounts
      .filter(row => row.date >= previousMonthStart && row.date < currentMonthStart)
      .reduce((sum, row) => sum + row._count._all, 0);

    const [leadOwnerGroups, opportunityStageGroups, leadSourceGroups, opportunityOwnerGroups] = await Promise.all([
      prisma.lead.groupBy({
        by: ["assignedToId"],
        _count: { _all: true },
      }),
      prisma.opportunity.groupBy({
        by: ["stage"],
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        _count: { _all: true },
      }),
      prisma.opportunity.groupBy({
        by: ["assignedToId"],
        _count: { _all: true },
      }),
    ]);

    const userIds = Array.from(
      new Set([
        ...leadOwnerGroups.map(g => g.assignedToId).filter((id): id is number => id != null),
        ...opportunityOwnerGroups.map(g => g.assignedToId).filter((id): id is number => id != null),
      ]),
    );

    const usersById =
      userIds.length === 0
        ? {}
        : Object.fromEntries(
            (
              await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true },
              })
            ).map(u => [u.id, u.name]),
          );

    const leadOwner = leadOwnerGroups.map(group => ({
      name: group.assignedToId != null ? usersById[group.assignedToId] ?? "Unassigned" : "Unassigned",
      value: group._count._all,
    }));

    const opportunityOwner = opportunityOwnerGroups.map(group => ({
      name: group.assignedToId != null ? usersById[group.assignedToId] ?? "Unassigned" : "Unassigned",
      value: group._count._all,
    }));

    const opportunityStage = opportunityStageGroups.map(group => ({
      name: group.stage ?? "Unknown",
      value: group._count._all,
    }));

    const leadSource = leadSourceGroups.map(group => ({
      name: group.source ?? "Unknown",
      value: group._count._all,
    }));

    return {
      summaryCards: {
        leadCount: {
          current: leadThisMonth,
          previous: leadLastMonth,
        },
        opportunityCount: {
          current: opportunityThisMonth,
          previous: opportunityLastMonth,
        },
        quotationCount: {
          current: quotationThisMonth,
          previous: quotationLastMonth,
        },
      },
      segments: {
        leadOwner,
        opportunityStage,
        leadSource,
        opportunityOwner,
      },
    };
  },

  async getPreferences(userId: number) {
    const pref = await prisma.dashboardPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      return defaultPreferenceConfig;
    }

    return { ...defaultPreferenceConfig, ...(pref.config as Record<string, unknown>) };
  },

  async savePreferences(userId: number, config: Record<string, unknown>) {
    const mergedConfig = { ...defaultPreferenceConfig, ...config };

    const saved = await prisma.dashboardPreference.upsert({
      where: { userId },
      update: { config: mergedConfig },
      create: {
        userId,
        config: mergedConfig,
      },
    });

    return saved.config;
  },
};

