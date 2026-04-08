-- AlterTable
ALTER TABLE "users" ADD COLUMN "reports_to_id" INTEGER;
ALTER TABLE "users" ADD COLUMN "tags_json" JSONB;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
