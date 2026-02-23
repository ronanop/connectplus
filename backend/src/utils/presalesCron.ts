import cron from "node-cron";
import { differenceInDays } from "date-fns";
import { prisma } from "../prisma";
import { notificationService } from "../modules/notifications/service";

export const registerPresalesCron = () => {
  cron.schedule("0 9 * * *", async () => {
    const projects = await prisma.presalesProject.findMany({
      where: {
        status: "active",
      },
      include: {
        stages: {
          orderBy: { completedAt: "desc" },
          take: 1,
        },
      },
    });

    const managementRoles = await prisma.role.findMany({
      where: {
        name: {
          in: ["MANAGEMENT", "ADMIN", "SUPER_ADMIN"],
        },
      },
    });

    const managementUsers = await prisma.user.findMany({
      where: {
        roleId: {
          in: managementRoles.map(role => role.id),
        },
      },
    });

    for (const project of projects) {
      const lastStage = project.stages[0];

      if (!lastStage) {
        continue;
      }

      const days = differenceInDays(new Date(), lastStage.completedAt);

      if (days <= 7) {
        continue;
      }

      const engineer = await prisma.user.findFirst({
        where: {
          name: {
            equals: project.assignedTo,
            mode: "insensitive",
          },
        },
      });

      const message = `Project ${project.title} has been stuck in ${project.currentStage} for ${days} days.`;

      if (engineer) {
        await notificationService.createNotification({
          userId: engineer.id,
          type: "presales_project_stagnant",
          title: "Presales project stagnant",
          message,
          priority: "high",
          channels: ["in_app"],
        });
      }

      for (const user of managementUsers) {
        await notificationService.createNotification({
          userId: user.id,
          type: "presales_project_stagnant",
          title: "Presales project stagnant",
          message,
          priority: "high",
          channels: ["in_app"],
        });
      }
    }
  });
};

