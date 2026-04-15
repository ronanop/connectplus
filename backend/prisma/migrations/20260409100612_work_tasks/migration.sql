-- CreateTable
CREATE TABLE "work_tasks" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "created_by_id" INTEGER NOT NULL,
    "assignee_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_task_comments" (
    "id" SERIAL NOT NULL,
    "work_task_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_task_activities" (
    "id" SERIAL NOT NULL,
    "work_task_id" INTEGER NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_tasks_organization_id_assignee_id_idx" ON "work_tasks"("organization_id", "assignee_id");

-- CreateIndex
CREATE INDEX "work_tasks_organization_id_status_idx" ON "work_tasks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "work_tasks_created_by_id_idx" ON "work_tasks"("created_by_id");

-- CreateIndex
CREATE INDEX "work_task_comments_work_task_id_idx" ON "work_task_comments"("work_task_id");

-- CreateIndex
CREATE INDEX "work_task_activities_work_task_id_idx" ON "work_task_activities"("work_task_id");

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_comments" ADD CONSTRAINT "work_task_comments_work_task_id_fkey" FOREIGN KEY ("work_task_id") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_comments" ADD CONSTRAINT "work_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_activities" ADD CONSTRAINT "work_task_activities_work_task_id_fkey" FOREIGN KEY ("work_task_id") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_task_activities" ADD CONSTRAINT "work_task_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
