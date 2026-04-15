import { prisma } from "../../prisma";
import { ApiError } from "../../middleware/errorHandler";
import type { CreateMeetingRoomBookingInput } from "./validators";

const MS_PER_MIN = 60_000;

function mapRow(row: {
  id: number;
  organizationId: number;
  userId: number;
  roomKey: string;
  title: string;
  startAt: Date;
  endAt: Date;
  attendees: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    roomKey: row.roomKey,
    title: row.title,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    attendees: row.attendees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const meetingRoomBookingsService = {
  async listMine(userId: number) {
    const rows = await prisma.meetingRoomBooking.findMany({
      where: { userId },
      orderBy: [{ startAt: "desc" }, { id: "desc" }],
      take: 200,
    });
    return rows.map(mapRow);
  },

  async create(userId: number, input: CreateMeetingRoomBookingInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      throw new ApiError(400, "Your account must be linked to an organization to book a meeting room.");
    }

    const startAt = new Date(input.startAt);
    const endAt = new Date(startAt.getTime() + input.durationMinutes * MS_PER_MIN);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new ApiError(400, "Invalid start time.");
    }
    if (endAt <= startAt) {
      throw new ApiError(400, "Meeting must end after it starts.");
    }

    const overlap = await prisma.meetingRoomBooking.findFirst({
      where: {
        organizationId: user.organizationId,
        roomKey: input.roomKey,
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ApiError(409, "This room is already booked for this time slot.");
    }

    const row = await prisma.meetingRoomBooking.create({
      data: {
        organizationId: user.organizationId,
        userId,
        roomKey: input.roomKey,
        title: input.title.trim(),
        startAt,
        endAt,
        attendees: input.attendees?.trim() ? input.attendees.trim() : null,
      },
    });
    return mapRow(row);
  },

  async remove(userId: number, id: number) {
    const existing = await prisma.meetingRoomBooking.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new ApiError(404, "Booking not found.");
    }
    await prisma.meetingRoomBooking.delete({ where: { id } });
  },
};
