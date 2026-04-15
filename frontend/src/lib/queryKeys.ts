export const hierarchyTaskKeys = {
  all: ["hierarchyTasks"] as const,
  lists: () => [...hierarchyTaskKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...hierarchyTaskKeys.lists(), filters] as const,
  detail: (id: number) => [...hierarchyTaskKeys.all, "detail", id] as const,
  assignableUsers: (taskId?: number) =>
    [...hierarchyTaskKeys.all, "assignableUsers", taskId ?? "global"] as const,
  handoffDepartments: () => [...hierarchyTaskKeys.all, "handoffDepartments"] as const,
};

export const portfolioProjectKeys = {
  all: ["portfolioProjects"] as const,
  access: () => [...portfolioProjectKeys.all, "access"] as const,
  lists: () => [...portfolioProjectKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...portfolioProjectKeys.lists(), filters] as const,
  detail: (id: number) => [...portfolioProjectKeys.all, "detail", id] as const,
};

export const skillsKeys = {
  all: ["skillsProfile"] as const,
  mine: () => [...skillsKeys.all, "mine"] as const,
};

export const meetingRoomKeys = {
  all: ["meetingRoomBookings"] as const,
  mine: () => [...meetingRoomKeys.all, "mine"] as const,
};
