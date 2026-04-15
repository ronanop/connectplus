import { notificationService } from "../modules/notifications/service";

export type HierarchyTaskNotificationMetadata = {
  hierarchyTaskId: number;
  activity: string;
};

const IN_APP = ["in_app"] as const;

/** Assignees + creator, excluding the user who triggered the event. */
export function hierarchyTaskRecipientUserIds(params: {
  assigneeUserIds: number[];
  assignedById: number;
  actorUserId: number;
}): number[] {
  const set = new Set<number>();
  for (const id of params.assigneeUserIds) {
    set.add(id);
  }
  set.add(params.assignedById);
  set.delete(params.actorUserId);
  return [...set];
}

export async function notifyHierarchyTaskUsers(
  userIds: number[],
  payload: {
    type: string;
    title: string;
    message: string;
    priority: "low" | "normal" | "high";
    metadata: HierarchyTaskNotificationMetadata;
  },
): Promise<void> {
  if (userIds.length === 0) {
    return;
  }
  await Promise.all(
    userIds.map(userId =>
      notificationService.createNotification({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        priority: payload.priority,
        channels: [...IN_APP],
        metadata: payload.metadata,
      }),
    ),
  );
}
