-- AlterEnum
ALTER TYPE "HierarchyTaskStatus" ADD VALUE 'COMPLETION_PENDING_APPROVAL';

-- CreateTable
CREATE TABLE "hierarchy_task_artifacts" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "uploaded_by_id" INTEGER NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "note" TEXT,
    "status_from" VARCHAR(32),
    "status_to" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hierarchy_task_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hierarchy_task_artifacts_task_id_idx" ON "hierarchy_task_artifacts"("task_id");

ALTER TABLE "hierarchy_task_artifacts" ADD CONSTRAINT "hierarchy_task_artifacts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "hierarchy_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hierarchy_task_artifacts" ADD CONSTRAINT "hierarchy_task_artifacts_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hierarchy_tasks" ADD COLUMN "completion_requested_by_id" INTEGER,
ADD COLUMN "completion_requested_at" TIMESTAMP(3),
ADD COLUMN "completion_artifact_id" INTEGER;

CREATE UNIQUE INDEX "hierarchy_tasks_completion_artifact_id_key" ON "hierarchy_tasks"("completion_artifact_id");

ALTER TABLE "hierarchy_tasks" ADD CONSTRAINT "hierarchy_tasks_completion_requested_by_id_fkey" FOREIGN KEY ("completion_requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hierarchy_tasks" ADD CONSTRAINT "hierarchy_tasks_completion_artifact_id_fkey" FOREIGN KEY ("completion_artifact_id") REFERENCES "hierarchy_task_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
