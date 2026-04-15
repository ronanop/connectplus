CREATE TABLE "meeting_room_bookings" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "room_key" VARCHAR(40) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "attendees" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_room_bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "meeting_room_bookings_organization_id_room_key_start_at_idx" ON "meeting_room_bookings"("organization_id", "room_key", "start_at");
CREATE INDEX "meeting_room_bookings_user_id_start_at_idx" ON "meeting_room_bookings"("user_id", "start_at");

ALTER TABLE "meeting_room_bookings" ADD CONSTRAINT "meeting_room_bookings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_room_bookings" ADD CONSTRAINT "meeting_room_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
