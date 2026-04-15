import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { notificationService } from "./service";

function serializeNotification(n: {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  channels: unknown;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    priority: n.priority,
    channels: n.channels,
    metadata: n.metadata,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function listMyNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 80;
  const [notifications, unreadCount] = await Promise.all([
    notificationService.listForUser(userId, limit),
    notificationService.countUnreadForUser(userId),
  ]);
  res.json({
    success: true,
    data: {
      notifications: notifications.map(serializeNotification),
      unreadCount,
    },
    message: "",
  });
}

export async function markNotificationRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    throw new ApiError(400, "Invalid notification id");
  }
  const result = await notificationService.markAsRead(id, userId);
  if (result.count === 0) {
    throw new ApiError(404, "Notification not found");
  }
  res.json({ success: true, data: { ok: true }, message: "" });
}
