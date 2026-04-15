import { api } from "./api";

export type AppNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  channels: unknown;
  metadata: { hierarchyTaskId?: number; activity?: string } | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsPayload = {
  success: boolean;
  data: { notifications: AppNotification[]; unreadCount: number };
  message?: string;
};

export async function fetchNotifications(limit = 80) {
  const res = await api.get<NotificationsPayload>("/api/notifications", { params: { limit } });
  return res.data.data;
}

export async function markNotificationRead(id: number) {
  await api.patch(`/api/notifications/${id}/read`);
}
