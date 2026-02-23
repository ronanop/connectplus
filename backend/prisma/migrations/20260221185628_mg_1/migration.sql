-- DropForeignKey
ALTER TABLE "lead_activities" DROP CONSTRAINT "lead_activities_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "lead_emails" DROP CONSTRAINT "lead_emails_created_by_fkey";

-- DropForeignKey
ALTER TABLE "lead_emails" DROP CONSTRAINT "lead_emails_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "lead_notes" DROP CONSTRAINT "lead_notes_author_id_fkey";

-- DropForeignKey
ALTER TABLE "lead_notes" DROP CONSTRAINT "lead_notes_lead_id_fkey";

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_emails" ADD CONSTRAINT "lead_emails_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
