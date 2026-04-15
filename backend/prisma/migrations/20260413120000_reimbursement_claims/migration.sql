-- Reimbursement claims (per-day expense, bill uploads, HR approve/deny)

CREATE TABLE "reimbursement_claims" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expense_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "hr_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reimbursement_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reimbursement_attachments" (
    "id" SERIAL NOT NULL,
    "claim_id" INTEGER NOT NULL,
    "stored_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reimbursement_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reimbursement_claims_organization_id_status_idx" ON "reimbursement_claims"("organization_id", "status");
CREATE INDEX "reimbursement_claims_user_id_expense_date_idx" ON "reimbursement_claims"("user_id", "expense_date");
CREATE INDEX "reimbursement_attachments_claim_id_idx" ON "reimbursement_attachments"("claim_id");

ALTER TABLE "reimbursement_claims" ADD CONSTRAINT "reimbursement_claims_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reimbursement_claims" ADD CONSTRAINT "reimbursement_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reimbursement_claims" ADD CONSTRAINT "reimbursement_claims_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reimbursement_attachments" ADD CONSTRAINT "reimbursement_attachments_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "reimbursement_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
