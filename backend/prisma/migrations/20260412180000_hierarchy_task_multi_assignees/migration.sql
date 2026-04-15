-- Multi-assignee hierarchy tasks: junction table + drop assigned_to_id

CREATE TABLE "hierarchy_task_assignees" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hierarchy_task_assignees_pkey" PRIMARY KEY ("id")
);

INSERT INTO "hierarchy_task_assignees" ("task_id", "user_id")
SELECT "id", "assigned_to_id" FROM "hierarchy_tasks";

CREATE UNIQUE INDEX "hierarchy_task_assignees_task_id_user_id_key" ON "hierarchy_task_assignees"("task_id", "user_id");
CREATE INDEX "hierarchy_task_assignees_task_id_idx" ON "hierarchy_task_assignees"("task_id");
CREATE INDEX "hierarchy_task_assignees_user_id_idx" ON "hierarchy_task_assignees"("user_id");

ALTER TABLE "hierarchy_task_assignees" ADD CONSTRAINT "hierarchy_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "hierarchy_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hierarchy_task_assignees" ADD CONSTRAINT "hierarchy_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hierarchy_tasks" DROP CONSTRAINT "hierarchy_tasks_assigned_to_id_fkey";
DROP INDEX IF EXISTS "hierarchy_tasks_assigned_to_id_idx";
ALTER TABLE "hierarchy_tasks" DROP COLUMN "assigned_to_id";
