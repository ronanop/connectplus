-- Tag-based workplace task flows (see taskFlowRegistry.ts)
ALTER TABLE "work_tasks" ADD COLUMN "task_flow_key" TEXT NOT NULL DEFAULT 'employee';

CREATE INDEX "work_tasks_organization_id_task_flow_key_idx" ON "work_tasks"("organization_id", "task_flow_key");
