-- CreateEnum
CREATE TYPE "HierarchyTaskAssignmentMode" AS ENUM ('DIRECT', 'DEPARTMENT_HANDOFF');

-- AlterTable
ALTER TABLE "hierarchy_tasks" ADD COLUMN "assignment_mode" "HierarchyTaskAssignmentMode" NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "hierarchy_tasks" ADD COLUMN "handoff_target_department" TEXT;
