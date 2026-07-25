import { z } from "zod";

export const DisclosureExperienceContextPackSchema = z.object({
  context_pack_type: z.literal("disclosure_experience_context"),
  version: z.literal("v1"),
  locale: z.literal("es-PE"),
  channel: z.enum(["whatsapp", "dashboard", "push", "email_notification"]),
  disclosure_level: z.enum(["summary", "standard", "detailed"]),
  redaction_applied: z.boolean(),
  safe_facts: z.record(z.string(), z.unknown()),
  base_text: z.string().min(1).max(1_000),
});

export const DisclosureExperienceOutputSchema = z.object({
  response_text: z.string().min(1).max(1_000),
  progressive_disclosure_hint: z.string().max(240).nullable(),
  confidence: z.number().min(0).max(1),
  preserved_fact_keys: z.array(z.string()).max(30),
});

export type DisclosureExperienceContextPack = z.infer<
  typeof DisclosureExperienceContextPackSchema
>;
export type DisclosureExperienceOutput = z.infer<
  typeof DisclosureExperienceOutputSchema
>;
