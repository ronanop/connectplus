import { Response } from "express";
import { AuthenticatedRequest } from "../../types/auth";
import { ApiError } from "../../middleware/errorHandler";
import { meetingRoomBookingsService } from "./service";

function requireUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  return req.user;
}

function parseId(param: string | undefined): number {
  const id = parseInt(param ?? "", 10);
  if (!Number.isFinite(id) || id < 1) {
    throw new ApiError(400, "Invalid id");
  }
  return id;
}

export const listMyMeetingRoomBookings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const bookings = await meetingRoomBookingsService.listMine(user.id);
  res.json({ success: true, data: { bookings }, message: "" });
};

export const createMeetingRoomBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const booking = await meetingRoomBookingsService.create(user.id, req.body);
  res.status(201).json({ success: true, data: { booking }, message: "" });
};

export const deleteMeetingRoomBooking = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = requireUser(req);
  const id = parseId(req.params.id);
  await meetingRoomBookingsService.remove(user.id, id);
  res.json({ success: true, data: {}, message: "" });
};
