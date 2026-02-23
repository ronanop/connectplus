import { z } from "zod";

export const dashboardPreferenceSchema = z.object({
  config: z.object({
    showLeadOwner: z.boolean().optional(),
    showOpportunityStage: z.boolean().optional(),
    showLeadSource: z.boolean().optional(),
    showOpportunityOwner: z.boolean().optional(),
  }),
});

