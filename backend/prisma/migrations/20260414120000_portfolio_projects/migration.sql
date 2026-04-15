-- CreateEnum
CREATE TYPE "PortfolioDiscipline" AS ENUM ('CLOUD', 'SOFTWARE');

-- CreateEnum
CREATE TYPE "PortfolioProjectKind" AS ENUM ('INTERNAL', 'CLIENT_POC');

-- CreateEnum
CREATE TYPE "PortfolioProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'BLOCKED', 'ON_HOLD', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PortfolioMemberRole" AS ENUM ('LEAD', 'MEMBER', 'VIEWER');

-- CreateTable
CREATE TABLE "portfolio_projects" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "kind" "PortfolioProjectKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "client_name" TEXT,
    "status" "PortfolioProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "disciplines" "PortfolioDiscipline"[] NOT NULL DEFAULT ARRAY[]::"PortfolioDiscipline"[],
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_project_members" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "PortfolioMemberRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_project_artifacts" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "uploaded_by_id" INTEGER NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_project_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_project_activities" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_project_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_projects_organization_id_status_idx" ON "portfolio_projects"("organization_id", "status");

-- CreateIndex
CREATE INDEX "portfolio_projects_organization_id_kind_idx" ON "portfolio_projects"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "portfolio_projects_organization_id_updated_at_idx" ON "portfolio_projects"("organization_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_project_members_project_id_user_id_key" ON "portfolio_project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "portfolio_project_members_user_id_idx" ON "portfolio_project_members"("user_id");

-- CreateIndex
CREATE INDEX "portfolio_project_artifacts_project_id_idx" ON "portfolio_project_artifacts"("project_id");

-- CreateIndex
CREATE INDEX "portfolio_project_activities_project_id_idx" ON "portfolio_project_activities"("project_id");

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_project_members" ADD CONSTRAINT "portfolio_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "portfolio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_project_members" ADD CONSTRAINT "portfolio_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_project_artifacts" ADD CONSTRAINT "portfolio_project_artifacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "portfolio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_project_artifacts" ADD CONSTRAINT "portfolio_project_artifacts_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_project_activities" ADD CONSTRAINT "portfolio_project_activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "portfolio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_project_activities" ADD CONSTRAINT "portfolio_project_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
