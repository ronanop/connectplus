import { z } from "zod";

export const MEETING_ROOM_KEYS = [
  "BOSE",
  "BHABHA",
  "ARYABHATTA",
  "SARABHAI",
  "RAMAN",
  "KALAM",
  "RAMANUJAN",
] as const;

export type MeetingRoomKey = (typeof MEETING_ROOM_KEYS)[number];

export const createMeetingRoomBookingSchema = z.object({
  roomKey: z.enum(["BOSE", "BHABHA", "ARYABHATTA", "SARABHAI", "RAMAN", "KALAM", "RAMANUJAN"]),
  title: z.string().min(1).max(300),
  startAt: z
    .string()
    .min(1)
    .refine(s => !Number.isNaN(Date.parse(s)), "Invalid start time"),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  attendees: z.string().max(8000).optional().nullable(),
});

export type CreateMeetingRoomBookingInput = z.infer<typeof createMeetingRoomBookingSchema>;
