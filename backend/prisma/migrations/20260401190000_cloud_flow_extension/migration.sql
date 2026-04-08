-- CreateTable
CREATE TABLE "cloud_engagements" (
  "id" SERIAL NOT NULL,
  "deployment_id" INTEGER NOT NULL,
  "project_id" INTEGER,
  "engagement_name" TEXT NOT NULL,
  "customer" TEXT NOT NULL,
  "assigned_tl_id" INTEGER NOT NULL,
  "stage" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "support_model" TEXT,
  "sla_json" JSONB,
  "intake_json" JSONB,
  "assessment_json" JSONB,
  "architecture_plan_json" JSONB,
  "security_framework_json" JSONB,
  "migration_json" JSONB,
  "managed_support_json" JSONB,
  "migration_started_at" TIMESTAMP(3),
  "validated_at" TIMESTAMP(3),
  "support_started_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cloud_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_stage_history" (
  "id" SERIAL NOT NULL,
  "cloud_engagement_id" INTEGER NOT NULL,
  "from_stage" TEXT,
  "to_stage" TEXT NOT NULL,
  "changed_by_id" INTEGER,
  "notes" TEXT,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cloud_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cloud_engagements_deployment_id_idx" ON "cloud_engagements"("deployment_id");
CREATE INDEX "cloud_engagements_project_id_idx" ON "cloud_engagements"("project_id");
CREATE INDEX "cloud_stage_history_cloud_engagement_id_idx" ON "cloud_stage_history"("cloud_engagement_id");

-- AddForeignKey
ALTER TABLE "cloud_engagements"
ADD CONSTRAINT "cloud_engagements_deployment_id_fkey"
FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cloud_engagements"
ADD CONSTRAINT "cloud_engagements_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cloud_engagements"
ADD CONSTRAINT "cloud_engagements_assigned_tl_id_fkey"
FOREIGN KEY ("assigned_tl_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cloud_stage_history"
ADD CONSTRAINT "cloud_stage_history_cloud_engagement_id_fkey"
FOREIGN KEY ("cloud_engagement_id") REFERENCES "cloud_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cloud_stage_history"
ADD CONSTRAINT "cloud_stage_history_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
