-- AlterTable
ALTER TABLE "purchase_orders"
ADD COLUMN "scm_owner_id" INTEGER,
ADD COLUMN "scm_handoff_at" TIMESTAMP(3),
ADD COLUMN "internal_eta_days" INTEGER;

-- AlterTable
ALTER TABLE "ovf"
ADD COLUMN "turnaround_days" INTEGER,
ADD COLUMN "time_calculation_notes" TEXT;

-- AlterTable
ALTER TABLE "scm_orders"
ADD COLUMN "distributor_sent_at" TIMESTAMP(3),
ADD COLUMN "delivered_to_warehouse_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "warehouse_receipts"
ADD COLUMN "mip_mrm_attachment_url" TEXT,
ADD COLUMN "warehouse_notes" TEXT;

-- AlterTable
ALTER TABLE "dispatches"
ADD COLUMN "customer_warehouse_receipt_url" TEXT,
ADD COLUMN "accounts_notified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "sent_to_accounts_at" TIMESTAMP(3),
ADD COLUMN "sent_to_customer_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deployments"
ADD COLUMN "kickoff_ready_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "scm_stage_history" (
  "id" SERIAL NOT NULL,
  "opportunity_id" INTEGER NOT NULL,
  "from_stage" TEXT,
  "to_stage" TEXT NOT NULL,
  "changed_by_id" INTEGER,
  "notes" TEXT,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "scm_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scm_stage_history_opportunity_id_idx" ON "scm_stage_history"("opportunity_id");

-- AddForeignKey
ALTER TABLE "purchase_orders"
ADD CONSTRAINT "purchase_orders_scm_owner_id_fkey"
FOREIGN KEY ("scm_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "scm_stage_history"
ADD CONSTRAINT "scm_stage_history_opportunity_id_fkey"
FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "scm_stage_history"
ADD CONSTRAINT "scm_stage_history_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
