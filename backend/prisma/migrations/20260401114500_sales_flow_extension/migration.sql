-- AlterTable
ALTER TABLE "leads"
ADD COLUMN "lead_type" TEXT,
ADD COLUMN "entry_owner_type" TEXT;

-- AlterTable
ALTER TABLE "opportunities"
ADD COLUMN "sales_owner_id" INTEGER,
ADD COLUMN "isr_owner_id" INTEGER,
ADD COLUMN "sales_stage" TEXT NOT NULL DEFAULT 'LEAD_GENERATION',
ADD COLUMN "closure_status" TEXT,
ADD COLUMN "closure_reason" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders"
ADD COLUMN "client_quote_submission_id" INTEGER;

-- CreateTable
CREATE TABLE "oem_alignments" (
  "id" SERIAL NOT NULL,
  "opportunity_id" INTEGER NOT NULL,
  "vendor_name" TEXT NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL,
  "owner_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "oem_alignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_quotes" (
  "id" SERIAL NOT NULL,
  "opportunity_id" INTEGER NOT NULL,
  "oem_alignment_id" INTEGER,
  "vendor_name" TEXT NOT NULL,
  "reference_number" TEXT,
  "amount" DECIMAL(65,30),
  "pricing_json" JSONB,
  "received_date" TIMESTAMP(3) NOT NULL,
  "valid_until" TIMESTAMP(3),
  "attachment_url" TEXT,
  "remarks" TEXT,
  "owner_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vendor_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_quote_submissions" (
  "id" SERIAL NOT NULL,
  "opportunity_id" INTEGER NOT NULL,
  "vendor_quote_id" INTEGER,
  "quote_number" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1',
  "amount" DECIMAL(65,30),
  "submitted_date" TIMESTAMP(3) NOT NULL,
  "attachment_url" TEXT,
  "status" TEXT NOT NULL,
  "owner_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_quote_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_follow_ups" (
  "id" SERIAL NOT NULL,
  "opportunity_id" INTEGER NOT NULL,
  "client_quote_id" INTEGER,
  "followup_date" TIMESTAMP(3) NOT NULL,
  "mode" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "next_followup_date" TIMESTAMP(3),
  "owner_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stage_history" (
  "id" SERIAL NOT NULL,
  "opportunity_id" INTEGER NOT NULL,
  "from_stage" TEXT,
  "to_stage" TEXT NOT NULL,
  "changed_by_id" INTEGER,
  "notes" TEXT,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "opportunity_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunities_sales_stage_idx" ON "opportunities"("sales_stage");
CREATE INDEX "oem_alignments_opportunity_id_idx" ON "oem_alignments"("opportunity_id");
CREATE INDEX "vendor_quotes_opportunity_id_idx" ON "vendor_quotes"("opportunity_id");
CREATE INDEX "client_quote_submissions_opportunity_id_idx" ON "client_quote_submissions"("opportunity_id");
CREATE INDEX "client_follow_ups_opportunity_id_idx" ON "client_follow_ups"("opportunity_id");
CREATE INDEX "opportunity_stage_history_opportunity_id_idx" ON "opportunity_stage_history"("opportunity_id");

-- AddForeignKey
ALTER TABLE "opportunities"
ADD CONSTRAINT "opportunities_sales_owner_id_fkey"
FOREIGN KEY ("sales_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "opportunities"
ADD CONSTRAINT "opportunities_isr_owner_id_fkey"
FOREIGN KEY ("isr_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
ADD CONSTRAINT "purchase_orders_client_quote_submission_id_fkey"
FOREIGN KEY ("client_quote_submission_id") REFERENCES "client_quote_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "oem_alignments"
ADD CONSTRAINT "oem_alignments_opportunity_id_fkey"
FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "oem_alignments"
ADD CONSTRAINT "oem_alignments_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendor_quotes"
ADD CONSTRAINT "vendor_quotes_opportunity_id_fkey"
FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_quotes"
ADD CONSTRAINT "vendor_quotes_oem_alignment_id_fkey"
FOREIGN KEY ("oem_alignment_id") REFERENCES "oem_alignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendor_quotes"
ADD CONSTRAINT "vendor_quotes_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_quote_submissions"
ADD CONSTRAINT "client_quote_submissions_opportunity_id_fkey"
FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_quote_submissions"
ADD CONSTRAINT "client_quote_submissions_vendor_quote_id_fkey"
FOREIGN KEY ("vendor_quote_id") REFERENCES "vendor_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_quote_submissions"
ADD CONSTRAINT "client_quote_submissions_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_follow_ups"
ADD CONSTRAINT "client_follow_ups_opportunity_id_fkey"
FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_follow_ups"
ADD CONSTRAINT "client_follow_ups_client_quote_id_fkey"
FOREIGN KEY ("client_quote_id") REFERENCES "client_quote_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_follow_ups"
ADD CONSTRAINT "client_follow_ups_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "opportunity_stage_history"
ADD CONSTRAINT "opportunity_stage_history_opportunity_id_fkey"
FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "opportunity_stage_history"
ADD CONSTRAINT "opportunity_stage_history_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
