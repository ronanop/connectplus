-- CreateTable
CREATE TABLE "org_task_templates" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "department_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description_hint" TEXT,
    "required_job_titles_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_member_tasks" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department_name" TEXT NOT NULL,
    "task_kind" TEXT NOT NULL,
    "task_mode" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "scheduled_start_at" TIMESTAMP(3),
    "scheduled_end_at" TIMESTAMP(3),
    "blocked_reason" TEXT,
    "template_id" INTEGER,
    "created_by_id" INTEGER NOT NULL,
    "assignee_id" INTEGER,
    "batch_group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_member_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_member_task_assignees" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "org_member_task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_task_review_comments" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_task_review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_task_templates_organization_id_department_name_idx" ON "org_task_templates"("organization_id", "department_name");

-- CreateIndex
CREATE INDEX "org_member_tasks_organization_id_status_idx" ON "org_member_tasks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "org_member_tasks_organization_id_assignee_id_idx" ON "org_member_tasks"("organization_id", "assignee_id");

-- CreateIndex
CREATE INDEX "org_member_tasks_organization_id_created_by_id_idx" ON "org_member_tasks"("organization_id", "created_by_id");

-- CreateIndex
CREATE INDEX "org_member_tasks_organization_id_due_date_idx" ON "org_member_tasks"("organization_id", "due_date");

-- CreateIndex
CREATE INDEX "org_member_tasks_batch_group_id_idx" ON "org_member_tasks"("batch_group_id");

-- CreateIndex
CREATE INDEX "org_member_task_assignees_user_id_idx" ON "org_member_task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_member_task_assignees_task_id_user_id_key" ON "org_member_task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "org_task_review_comments_task_id_idx" ON "org_task_review_comments"("task_id");

-- AddForeignKey
ALTER TABLE "org_task_templates" ADD CONSTRAINT "org_task_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_member_tasks" ADD CONSTRAINT "org_member_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_member_tasks" ADD CONSTRAINT "org_member_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "org_task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_member_tasks" ADD CONSTRAINT "org_member_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_member_tasks" ADD CONSTRAINT "org_member_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_member_task_assignees" ADD CONSTRAINT "org_member_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "org_member_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_member_task_assignees" ADD CONSTRAINT "org_member_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_task_review_comments" ADD CONSTRAINT "org_task_review_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "org_member_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_task_review_comments" ADD CONSTRAINT "org_task_review_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
