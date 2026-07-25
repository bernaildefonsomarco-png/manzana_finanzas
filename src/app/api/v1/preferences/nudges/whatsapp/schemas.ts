import { z } from "zod";

const ClockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa una hora valida en formato HH:mm.");

export const UpdateWhatsAppNudgeConsentSchema = z
  .object({
    whatsapp_opt_in: z.boolean(),
    payment_due: z.boolean(),
    debt_due: z.boolean(),
    quiet_hours_start: ClockSchema,
    quiet_hours_end: ClockSchema,
  })
  .strict()
  .refine(
    (value) =>
      !value.whatsapp_opt_in || value.payment_due || value.debt_due,
    {
      message: "Elige al menos un tipo de aviso para activar WhatsApp.",
      path: ["whatsapp_opt_in"],
    },
  );
