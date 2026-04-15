import { api } from "./api";

type ApiEnvelope<T> = { success: boolean; data: T; message?: string };

export type MeetingRoomKey =
  | "BOSE"
  | "BHABHA"
  | "ARYABHATTA"
  | "SARABHAI"
  | "RAMAN"
  | "KALAM"
  | "RAMANUJAN";

export interface MeetingRoomBookingRow {
  id: number;
  organizationId: number;
  userId: number;
  roomKey: MeetingRoomKey;
  title: string;
  startAt: string;
  endAt: string;
  attendees: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MEETING_ROOMS: { key: MeetingRoomKey; label: string }[] = [
  { key: "BOSE", label: "Bose" },
  { key: "BHABHA", label: "Bhabha" },
  { key: "ARYABHATTA", label: "Aryabhatta" },
  { key: "SARABHAI", label: "Sarabhai" },
  { key: "RAMAN", label: "Raman" },
  { key: "KALAM", label: "Kalam" },
  { key: "RAMANUJAN", label: "Ramanujan" },
];

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const;

export const meetingRoomsApi = {
  async listMine(): Promise<MeetingRoomBookingRow[]> {
    const res = await api.get<ApiEnvelope<{ bookings: MeetingRoomBookingRow[] }>>("/api/meeting-room-bookings/mine");
    return res.data.data.bookings;
  },

  async create(body: {
    roomKey: MeetingRoomKey;
    title: string;
    startAt: string;
    durationMinutes: number;
    attendees?: string | null;
  }): Promise<MeetingRoomBookingRow> {
    const res = await api.post<ApiEnvelope<{ booking: MeetingRoomBookingRow }>>("/api/meeting-room-bookings", body);
    return res.data.data.booking;
  },

  async deleteBooking(id: number): Promise<void> {
    await api.delete(`/api/meeting-room-bookings/${id}`);
  },
};
