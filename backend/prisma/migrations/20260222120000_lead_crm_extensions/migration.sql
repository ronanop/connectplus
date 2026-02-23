-- AlterTable: leads - add lost_reason column
ALTER TABLE "leads"
ADD COLUMN "lost_reason" TEXT;

-- CreateTable: lead_notes
CREATE TABLE "lead_notes" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "author_id" INTEGER,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_notes_lead_id_idx" ON "lead_notes"("lead_id");

ALTER TABLE "lead_notes"
ADD CONSTRAINT "lead_notes_lead_id_fkey"
FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_notes"
ADD CONSTRAINT "lead_notes_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: lead_emails
CREATE TABLE "lead_emails" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    CONSTRAINT "lead_emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_emails_lead_id_idx" ON "lead_emails"("lead_id");

ALTER TABLE "lead_emails"
ADD CONSTRAINT "lead_emails_lead_id_fkey"
FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_emails"
ADD CONSTRAINT "lead_emails_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: lead_activities
CREATE TABLE "lead_activities" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_activities_lead_id_status_idx" ON "lead_activities"("lead_id", "status");

ALTER TABLE "lead_activities"
ADD CONSTRAINT "lead_activities_lead_id_fkey"
FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

