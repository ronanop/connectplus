-- Optional JSON payload for deep links (e.g. hierarchy task id).
ALTER TABLE "notifications" ADD COLUMN "metadata" JSONB;
