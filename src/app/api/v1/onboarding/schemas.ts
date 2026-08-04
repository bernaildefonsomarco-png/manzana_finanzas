import { z } from "zod";

export const OnboardingActionRequestSchema = z
  .object({
    action: z.literal("start"),
    // `44` `SCR-ONB-02` — las cuatro salidas de la bienvenida (`ACT-ONB-01`,
    // `ACT-ONB-02`): una por puerta más "mirar primero", para que el
    // reparto de puertas elegidas (`44` §10) se pueda medir por separado.
    source: z.enum([
      "dashboard_home",
      "dashboard_movements",
      "welcome_movement",
      "welcome_account",
      "welcome_email",
      "welcome_skip",
    ]),
  })
  .strict();

export type OnboardingActionRequest = z.infer<
  typeof OnboardingActionRequestSchema
>;
