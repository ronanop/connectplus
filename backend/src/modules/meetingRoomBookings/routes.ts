import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createMeetingRoomBooking,
  deleteMeetingRoomBooking,
  listMyMeetingRoomBookings,
} from "./controller";
import { createMeetingRoomBookingSchema } from "./validators";

export const meetingRoomBookingsRouter = Router();

meetingRoomBookingsRouter.use(authenticate);
meetingRoomBookingsRouter.get("/mine", asyncHandler(listMyMeetingRoomBookings));
meetingRoomBookingsRouter.post(
  "/",
  validateRequest(createMeetingRoomBookingSchema),
  asyncHandler(createMeetingRoomBooking),
);
meetingRoomBookingsRouter.delete("/:id", asyncHandler(deleteMeetingRoomBooking));
