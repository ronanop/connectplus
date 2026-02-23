import { z } from "zod";

export const apiFetchRequestSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  method: z.enum(["GET", "POST"]).default("GET"),
  headers: z.record(z.string()).default({}),
  body: z.record(z.unknown()).optional(),
});

