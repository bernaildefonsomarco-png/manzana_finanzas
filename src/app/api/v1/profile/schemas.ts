import { z } from "zod";

export const UpdateProfileRequestSchema = z
  .object({
    display_name: z.string().trim().min(1).max(120).nullable().optional(),
    phone_e164: z.string().trim().max(32).nullable().optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    locale: z.string().trim().min(2).max(20).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Patch vacio");

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
