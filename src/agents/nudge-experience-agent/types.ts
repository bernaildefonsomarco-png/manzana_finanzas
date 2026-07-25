import { z } from "zod";
import { NUDGE_TYPES, RISK_LEVELS } from "@/shared/types/domain";

export const NudgeExperienceContextPackSchema = z.object({
  context_pack_type: z.literal("nudge_experience_context"),
  version: z.literal("v1"),
  locale: z.literal("es-PE"),
  candidate: z.object({
    type: z.enum(NUDGE_TYPES),
    risk_level: z.enum(RISK_LEVELS),
    priority: z.number().int(),
  }),
  approved_delivery: z.object({
    channel: z.enum(["whatsapp", "dashboard"]),
    delivery_mode: z.string().min(1).max(80),
    disclosure_level: z.enum(["summary", "standard", "detailed"]),
    redaction_applied: z.boolean(),
  }),
  user_context: z.object({
    tone_style: z.string().max(160).nullable(),
    discreet_mode_enabled: z.boolean(),
  }),
  safe_facts: z.record(z.string(), z.unknown()),
  deterministic_base_text: z.string().min(1).max(1_000),
});

export const NudgeExperienceOutputSchema = z.object({
  response_text: z.string().min(1).max(1_000),
  tone_applied: z.string().min(1).max(160),
  confidence: z.number().min(0).max(1),
  preserved_fact_keys: z.array(z.string()).max(30),
});

export type NudgeExperienceContextPack = z.infer<
  typeof NudgeExperienceContextPackSchema
>;
export type NudgeExperienceOutput = z.infer<typeof NudgeExperienceOutputSchema>;
