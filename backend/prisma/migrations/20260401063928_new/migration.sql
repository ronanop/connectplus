-- CreateEnum
CREATE TYPE "PresalesStage" AS ENUM ('INITIATED', 'LEAD_HANDOVER', 'REQUIREMENT_ANALYSIS', 'SOLUTION_DESIGN', 'SYSTEM_DESIGN', 'TECH_STACK_FINALIZATION', 'BOQ_CREATION', 'POC', 'PROPOSAL_GENERATION', 'DEAL_CLOSURE_SUPPORT', 'CLOSED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

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

-- CreateTable
CREATE TABLE "PresalesProject" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "currentStage" "PresalesStage" NOT NULL DEFAULT 'INITIATED',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "estimatedValue" DOUBLE PRECISION,
    "expectedCloseDate" TIMESTAMP(3),
    "winProbability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lostReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresalesProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresalesStageLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" "PresalesStage" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedBy" TEXT NOT NULL,
    "notes" TEXT,
    "timeTakenMinutes" INTEGER,

    CONSTRAINT "PresalesStageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementDoc" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rawNotes" TEXT,
    "functionalReq" JSONB,
    "technicalReq" JSONB,
    "constraints" TEXT,
    "stakeholders" JSONB,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RequirementDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionDesign" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "architectureUrl" TEXT,
    "diagramUrl" TEXT,
    "techStack" JSONB,
    "competitors" JSONB,
    "recommendedOption" TEXT,
    "justification" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SolutionDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQ" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lineItems" JSONB NOT NULL,
    "totalValue" DOUBLE PRECISION,
    "oemName" TEXT,
    "validity" TIMESTAMP(3),
    "attachmentUrl" TEXT,
    "effortDays" INTEGER,
    "resourceCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BOQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POC" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objective" TEXT,
    "scope" TEXT,
    "successCriteria" JSONB,
    "environment" TEXT,
    "assignedEngineer" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "outcome" TEXT,
    "findings" TEXT,
    "evidenceUrls" JSONB,
    "status" TEXT NOT NULL DEFAULT 'planned',

    CONSTRAINT "POC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executiveSummary" TEXT,
    "scopeOfWork" TEXT,
    "technicalApproach" TEXT,
    "commercials" JSONB,
    "timeline" JSONB,
    "teamStructure" JSONB,
    "termsConditions" TEXT,
    "pdfUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "clientFeedback" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresalesActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresalesActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresalesStageLog_projectId_idx" ON "PresalesStageLog"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementDoc_projectId_key" ON "RequirementDoc"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SolutionDesign_projectId_key" ON "SolutionDesign"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BOQ_projectId_key" ON "BOQ"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "POC_projectId_key" ON "POC"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_projectId_key" ON "Proposal"("projectId");

-- CreateIndex
CREATE INDEX "PresalesActivity_projectId_idx" ON "PresalesActivity"("projectId");

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_emails" ADD CONSTRAINT "lead_emails_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresalesStageLog" ADD CONSTRAINT "PresalesStageLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PresalesProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementDoc" ADD CONSTRAINT "RequirementDoc_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PresalesProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionDesign" ADD CONSTRAINT "SolutionDesign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PresalesProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQ" ADD CONSTRAINT "BOQ_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PresalesProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POC" ADD CONSTRAINT "POC_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PresalesProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PresalesProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresalesActivity" ADD CONSTRAINT "PresalesActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PresalesProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
