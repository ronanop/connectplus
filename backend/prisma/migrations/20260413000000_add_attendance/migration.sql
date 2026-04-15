-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING', 'PRESENT', 'FACE_FAILED', 'GEO_FAILED', 'MANUAL_PRESENT', 'MANUAL_ABSENT', 'ABSENT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "profile_photo_path" TEXT,
ADD COLUMN "face_descriptor" JSONB,
ADD COLUMN "face_enrolled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "attendance_configs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "office_lat" DOUBLE PRECISION NOT NULL,
    "office_lng" DOUBLE PRECISION NOT NULL,
    "perimeter_meters" INTEGER NOT NULL DEFAULT 70,
    "face_match_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "check_in_lat" DOUBLE PRECISION,
    "check_in_lng" DOUBLE PRECISION,
    "check_in_distance" DOUBLE PRECISION,
    "face_match_score" DOUBLE PRECISION,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "overridden_by_id" INTEGER,
    "override_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_configs_organization_id_key" ON "attendance_configs"("organization_id");

-- CreateIndex
CREATE INDEX "attendances_organization_id_date_idx" ON "attendances"("organization_id", "date");

-- CreateIndex
CREATE INDEX "attendances_user_id_idx" ON "attendances"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_user_id_date_key" ON "attendances"("user_id", "date");

-- AddForeignKey
ALTER TABLE "attendance_configs" ADD CONSTRAINT "attendance_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_overridden_by_id_fkey" FOREIGN KEY ("overridden_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
