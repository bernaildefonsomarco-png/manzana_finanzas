import { z } from "zod";

export const UpdateDashboardNudgePreferenceSchema = z
  .object({
    nudge_type: z.enum(["payment_due", "debt_due"]),
    enabled: z.boolean(),
  })
  .strict();

export type UpdateDashboardNudgePreferenceRequest = z.infer<
  typeof UpdateDashboardNudgePreferenceSchema
>;
