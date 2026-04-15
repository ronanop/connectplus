import { api } from "./api";

type Envelope<T> = { success: boolean; data: T; message: string };

export type AttendanceStatus =
  | "PENDING"
  | "PRESENT"
  | "FACE_FAILED"
  | "GEO_FAILED"
  | "MANUAL_PRESENT"
  | "MANUAL_ABSENT"
  | "ABSENT";

export interface AttendanceRecord {
  id: number;
  userId: number;
  organizationId: number;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInDistance: number | null;
  faceMatchScore: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutDistance: number | null;
  checkOutFaceMatchScore: number | null;
  status: AttendanceStatus;
  isLate?: boolean;
  durationMinutes?: number | null;
}

export const attendanceApi = {
  saveFaceDescriptor: (descriptor: number[]) =>
    api.post<Envelope<null>>("/api/attendance/face-descriptor", { descriptor }),

  getFaceDescriptor: (userId?: number) =>
    api.get<Envelope<{ descriptor: number[] }>>("/api/attendance/face-descriptor", {
      params: userId ? { userId } : undefined,
    }),

  resetFaceDescriptor: (userId: number) =>
    api.delete<Envelope<null>>(`/api/attendance/face-descriptor/${userId}`),

  getConfig: () => api.get<Envelope<{ config: Record<string, unknown> }>>("/api/attendance/config"),

  saveConfig: (data: {
    officeLat: number;
    officeLng: number;
    perimeterMeters?: number;
    faceMatchThreshold?: number;
  }) => api.post<Envelope<{ config: Record<string, unknown> }>>("/api/attendance/config", data),

  verifyGeo: (lat: number, lng: number) =>
    api.post<
      Envelope<{
        passed: boolean;
        distance: number;
        token?: string;
        perimeterMeters?: number;
      }>
    >("/api/attendance/verify-geo", { lat, lng }),

  checkIn: (payload: { faceMatchScore: number; verificationToken: string; lat: number; lng: number }) =>
    api.post<Envelope<{ attendance: AttendanceRecord }>>("/api/attendance/check-in", payload),

  checkOut: (payload: { faceMatchScore: number; verificationToken: string; lat: number; lng: number }) =>
    api.post<Envelope<{ attendance: AttendanceRecord }>>("/api/attendance/check-out", payload),

  recordFaceFailed: () => api.post<Envelope<{ attendance: AttendanceRecord }>>("/api/attendance/face-failed"),

  getMyAttendance: (month?: string) =>
    api.get<Envelope<{ records: AttendanceRecord[] }>>("/api/attendance/my", { params: { month } }),

  getMyToday: () => api.get<Envelope<{ attendance: AttendanceRecord | null }>>("/api/attendance/my/today"),

  getTeamAttendance: (params?: Record<string, string | number | undefined>) =>
    api.get<
      Envelope<{
        records: unknown[];
        meta: { total: number; page: number; pageSize: number };
      }>
    >("/api/attendance/team", { params }),

  getTeamHeatmap: (month: string) =>
    api.get<Envelope<{ rows: unknown[] }>>("/api/attendance/team/heatmap", { params: { month } }),

  getTodaySummary: () =>
    api.get<
      Envelope<{
        summary: {
          totalUsers: number;
          totalRecordsToday: number;
          present: number;
          absent: number;
          faceFailed: number;
          geoFailed: number;
          pending: number;
          manualPresent: number;
          manualAbsent: number;
        };
      }>
    >("/api/attendance/today-summary"),

  manualOverride: (data: {
    userId: number;
    date: string;
    status: "MANUAL_PRESENT" | "MANUAL_ABSENT";
    note?: string;
  }) => api.post<Envelope<{ attendance: AttendanceRecord }>>("/api/attendance/override", data),

  resetAllFaceDescriptors: () =>
    api.post<Envelope<{ count: number }>>("/api/attendance/reset-all-face-descriptors"),

  getFaceRegistrationCount: () =>
    api.get<Envelope<{ count: number }>>("/api/attendance/face-registration-count"),
};
