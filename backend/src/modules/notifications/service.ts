import type { Prisma } from "../../generated/prisma";
import { prisma } from "../../prisma";

export type NotificationChannel = "in_app" | "email" | "sms";

export const notificationService = {
  async createNotification(params: {
    userId: number;
    type: string;
    title: string;
    message: string;
    priority: string;
    channels: NotificationChannel[];
    metadata?: Prisma.InputJsonValue | null;
  }) {
    return prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        priority: params.priority,
        channels: params.channels,
        metadata: params.metadata ?? undefined,
      },
    });
  },

  listForUser(userId: number, take = 80) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  countUnreadForUser(userId: number) {
    return prisma.notification.count({
      where: { userId, readAt: null },
    });
  },

  markAsRead(id: number, userId: number) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  },
};

