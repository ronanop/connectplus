import { z } from "zod";

export const saveFaceDescriptorSchema = z.object({
  descriptor: z.array(z.number()).length(128),
});

export const verifyGeoSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const checkInSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  faceMatchScore: z.number().min(0).max(1),
  verificationToken: z.string().min(1),
});

/** Same proof as check-in: fresh geo token + face score + coordinates. */
export const checkOutSchema = checkInSchema;

export const configSchema = z.object({
  officeLat: z.number(),
  officeLng: z.number(),
  perimeterMeters: z.number().int().min(10).max(5000).optional(),
  faceMatchThreshold: z.number().min(0.5).max(1).optional(),
});

export const manualOverrideSchema = z.object({
  userId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["MANUAL_PRESENT", "MANUAL_ABSENT"]),
  note: z.string().optional(),
});

export const teamAttendanceQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  department: z.string().optional(),
  status: z
    .enum([
      "PENDING",
      "PRESENT",
      "FACE_FAILED",
      "GEO_FAILED",
      "MANUAL_PRESENT",
      "MANUAL_ABSENT",
      "ABSENT",
    ])
    .optional(),
  userId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
