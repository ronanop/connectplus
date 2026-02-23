import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(2),
  modules: z.array(z.enum(["CRM", "HRMS"])).min(1),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

