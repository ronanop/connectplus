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
  }) {
    return prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        priority: params.priority,
        channels: params.channels,
      },
    });
  },

  listForUser(userId: number) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  markAsRead(id: number) {
    return prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  },
};

