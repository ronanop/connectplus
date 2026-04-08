-- AlterTable
ALTER TABLE "PresalesProject"
ADD COLUMN "converted_opportunity_id" INTEGER,
ADD COLUMN "handoff_summary" TEXT;

-- AlterTable
ALTER TABLE "RequirementDoc"
ADD COLUMN "scope_split_json" JSONB,
ADD COLUMN "timeline_notes" TEXT,
ADD COLUMN "compliance_security" TEXT,
ADD COLUMN "handoff_notes" TEXT;

-- AlterTable
ALTER TABLE "SolutionDesign"
ADD COLUMN "system_design_summary" TEXT,
ADD COLUMN "deployment_topology" TEXT,
ADD COLUMN "infra_components_json" JSONB,
ADD COLUMN "finalized_stack_json" JSONB;

-- AlterTable
ALTER TABLE "POC"
ADD COLUMN "gating_status" TEXT,
ADD COLUMN "waiver_reason" TEXT;

-- AlterTable
ALTER TABLE "Proposal"
ADD COLUMN "proposal_summary" TEXT,
ADD COLUMN "closure_support_notes" TEXT,
ADD COLUMN "ready_for_sales_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "PresalesProject"
ADD CONSTRAINT "PresalesProject_converted_opportunity_id_fkey"
FOREIGN KEY ("converted_opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
