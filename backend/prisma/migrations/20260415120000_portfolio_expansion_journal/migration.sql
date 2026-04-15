-- AlterEnum
ALTER TYPE "PortfolioProjectKind" ADD VALUE 'CLIENT_PROJECT';

-- CreateEnum
CREATE TYPE "PortfolioJournalEntryType" AS ENUM ('UPDATE', 'WORK_LOG');

-- AlterTable
ALTER TABLE "portfolio_projects" ADD COLUMN "project_type" VARCHAR(120),
ADD COLUMN "scope_of_work" TEXT,
ADD COLUMN "sponsor_user_id" INTEGER,
ADD COLUMN "tentative_completion_date" DATE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_sponsor_user_id_fkey" FOREIGN KEY ("sponsor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "portfolio_project_journal_entries" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entry_type" "PortfolioJournalEntryType" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_project_journal_entries_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "portfolio_project_artifacts" ADD COLUMN "journal_entry_id" INTEGER;

-- CreateIndex
CREATE INDEX "portfolio_project_journal_entries_project_id_created_at_idx" ON "portfolio_project_journal_entries"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "portfolio_project_artifacts_journal_entry_id_idx" ON "portfolio_project_artifacts"("journal_entry_id");

-- AddForeignKey
ALTER TABLE "portfolio_project_journal_entries" ADD CONSTRAINT "portfolio_project_journal_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "portfolio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_project_journal_entries" ADD CONSTRAINT "portfolio_project_journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_project_artifacts" ADD CONSTRAINT "portfolio_project_artifacts_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "portfolio_project_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
