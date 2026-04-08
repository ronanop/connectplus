-- AlterTable
ALTER TABLE "deployments"
ADD COLUMN "kickoff_completed_at" TIMESTAMP(3),
ADD COLUMN "materials_ready_at" TIMESTAMP(3),
ADD COLUMN "material_movement_at" TIMESTAMP(3),
ADD COLUMN "live_at" TIMESTAMP(3),
ADD COLUMN "customer_signoff_url" TEXT;

-- AlterTable
ALTER TABLE "site_surveys"
ADD COLUMN "readiness_status" TEXT;

-- AlterTable
ALTER TABLE "bal_activities"
ADD COLUMN "task_category" TEXT;

-- AlterTable
ALTER TABLE "uat_test_cases"
ADD COLUMN "signed_off_by_customer" BOOLEAN,
ADD COLUMN "signoff_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "deployment_stage_history" (
  "id" SERIAL NOT NULL,
  "deployment_id" INTEGER NOT NULL,
  "from_stage" TEXT,
  "to_stage" TEXT NOT NULL,
  "changed_by_id" INTEGER,
  "notes" TEXT,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deployment_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deployment_stage_history_deployment_id_idx" ON "deployment_stage_history"("deployment_id");

-- AddForeignKey
ALTER TABLE "deployment_stage_history"
ADD CONSTRAINT "deployment_stage_history_deployment_id_fkey"
FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deployment_stage_history"
ADD CONSTRAINT "deployment_stage_history_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
