/**
 * Workplace tasks are partitioned by profile tag. Each flow has its own ordered stages (status values).
 * Keys are stable API identifiers; labels match Settings → user tag presets where applicable.
 */

export const TASK_FLOW_KEYS = [
  "employee",
  "manager",
  "organization_member",
  "intern",
  "hr",
] as const;

export type TaskFlowKey = (typeof TASK_FLOW_KEYS)[number];

/** Normalized tag (trim + lower) → flow key */
const TAG_LABEL_TO_FLOW_KEY: Record<string, TaskFlowKey> = {
  employee: "employee",
  manager: "manager",
  "organization member": "organization_member",
  intern: "intern",
  hr: "hr",
};

export type TaskFlowDefinition = {
  key: TaskFlowKey;
  label: string;
  description: string;
  stages: readonly string[];
};

export const TASK_FLOWS: Record<TaskFlowKey, TaskFlowDefinition> = {
  employee: {
    key: "employee",
    label: "Employee",
    description: "Standard execution: pick up work, progress, unblock, complete.",
    stages: ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"],
  },
  manager: {
    key: "manager",
    label: "Manager",
    description: "Planning and delegation with review before closure.",
    stages: ["PLANNING", "DELEGATED", "REVIEWING", "DONE"],
  },
  organization_member: {
    key: "organization_member",
    label: "Organization member",
    description: "Request-driven flow from acknowledgement to closure.",
    stages: ["REQUESTED", "ACKNOWLEDGED", "IN_PROGRESS", "CLOSED"],
  },
  intern: {
    key: "intern",
    label: "Intern",
    description: "Learning-oriented stages with mentor review.",
    stages: ["LEARNING", "PRACTICE", "MENTOR_REVIEW", "DONE"],
  },
  hr: {
    key: "hr",
    label: "HR",
    description: "People-ops intake through resolution.",
    stages: ["INTAKE", "SCREENING", "COORDINATION", "RESOLVED"],
  },
};

export function isTaskFlowKey(s: string): s is TaskFlowKey {
  return (TASK_FLOW_KEYS as readonly string[]).includes(s);
}

export function flowKeysFromUserTags(tags: string[]): TaskFlowKey[] {
  const out: TaskFlowKey[] = [];
  const seen = new Set<TaskFlowKey>();
  for (const t of tags) {
    const key = TAG_LABEL_TO_FLOW_KEY[t.trim().toLowerCase()];
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/** If no tag maps to a flow, default to employee so existing users keep working. */
export function allowedFlowKeysForUser(tags: string[]): TaskFlowKey[] {
  const keys = flowKeysFromUserTags(tags);
  return keys.length > 0 ? keys : ["employee"];
}

export function defaultStatusForFlow(flowKey: TaskFlowKey): string {
  return TASK_FLOWS[flowKey].stages[0] ?? "TODO";
}

export function isValidStatusForFlow(flowKey: TaskFlowKey, status: string): boolean {
  return TASK_FLOWS[flowKey].stages.includes(status);
}

export function listFlowsForApi(): TaskFlowDefinition[] {
  return TASK_FLOW_KEYS.map(k => TASK_FLOWS[k]);
}
