import { z } from "zod";

export const OnboardingActionRequestSchema = z
  .object({
    action: z.literal("start"),
    source: z.enum(["dashboard_home", "dashboard_movements"]),
  })
  .strict();

export type OnboardingActionRequest = z.infer<
  typeof OnboardingActionRequestSchema
>;
