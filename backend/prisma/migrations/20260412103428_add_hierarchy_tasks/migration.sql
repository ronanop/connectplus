/*
  Warnings:

  - You are about to drop the `org_member_task_assignees` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `org_member_tasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `org_task_review_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `org_task_templates` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "HierarchyTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HierarchyTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "org_member_task_assignees" DROP CONSTRAINT "org_member_task_assignees_task_id_fkey";

-- DropForeignKey
ALTER TABLE "org_member_task_assignees" DROP CONSTRAINT "org_member_task_assignees_user_id_fkey";

-- DropForeignKey
ALTER TABLE "org_member_tasks" DROP CONSTRAINT "org_member_tasks_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "org_member_tasks" DROP CONSTRAINT "org_member_tasks_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "org_member_tasks" DROP CONSTRAINT "org_member_tasks_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "org_member_tasks" DROP CONSTRAINT "org_member_tasks_template_id_fkey";

-- DropForeignKey
ALTER TABLE "org_task_review_comments" DROP CONSTRAINT "org_task_review_comments_author_id_fkey";

-- DropForeignKey
ALTER TABLE "org_task_review_comments" DROP CONSTRAINT "org_task_review_comments_task_id_fkey";

-- DropForeignKey
ALTER TABLE "org_task_templates" DROP CONSTRAINT "org_task_templates_organization_id_fkey";

-- DropTable
DROP TABLE "org_member_task_assignees";

-- DropTable
DROP TABLE "org_member_tasks";

-- DropTable
DROP TABLE "org_task_review_comments";

-- DropTable
DROP TABLE "org_task_templates";

-- CreateTable
CREATE TABLE "hierarchy_tasks" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "HierarchyTaskPriority" NOT NULL,
    "status" "HierarchyTaskStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3) NOT NULL,
    "assigned_by_id" INTEGER NOT NULL,
    "assigned_to_id" INTEGER NOT NULL,
    "department" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hierarchy_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hierarchy_task_comments" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hierarchy_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hierarchy_task_activities" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hierarchy_task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hierarchy_tasks_organization_id_idx" ON "hierarchy_tasks"("organization_id");

-- CreateIndex
CREATE INDEX "hierarchy_tasks_assigned_to_id_idx" ON "hierarchy_tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "hierarchy_tasks_assigned_by_id_idx" ON "hierarchy_tasks"("assigned_by_id");

-- CreateIndex
CREATE INDEX "hierarchy_task_comments_task_id_idx" ON "hierarchy_task_comments"("task_id");

-- CreateIndex
CREATE INDEX "hierarchy_task_activities_task_id_idx" ON "hierarchy_task_activities"("task_id");

-- AddForeignKey
ALTER TABLE "hierarchy_tasks" ADD CONSTRAINT "hierarchy_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_tasks" ADD CONSTRAINT "hierarchy_tasks_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_tasks" ADD CONSTRAINT "hierarchy_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_task_comments" ADD CONSTRAINT "hierarchy_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "hierarchy_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_task_comments" ADD CONSTRAINT "hierarchy_task_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_task_activities" ADD CONSTRAINT "hierarchy_task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "hierarchy_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_task_activities" ADD CONSTRAINT "hierarchy_task_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
