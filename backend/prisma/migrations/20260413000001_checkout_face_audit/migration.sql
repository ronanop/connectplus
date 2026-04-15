-- AlterTable
ALTER TABLE "attendances" ADD COLUMN "check_out_lat" DOUBLE PRECISION,
ADD COLUMN "check_out_lng" DOUBLE PRECISION,
ADD COLUMN "check_out_distance" DOUBLE PRECISION,
ADD COLUMN "check_out_face_match_score" DOUBLE PRECISION;
