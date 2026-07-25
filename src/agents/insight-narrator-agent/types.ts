import { z } from "zod";
import { INSIGHT_TYPES } from "@/shared/types/domain";

export const InsightNarratorContextPackSchema = z.object({
  context_pack_type: z.literal("insight_narrator_context"),
  version: z.literal("v1"),
  locale: z.literal("es-PE"),
  channel: z.enum(["dashboard", "whatsapp"]),
  candidate: z.object({
    fingerprint: z.string().min(1),
    type: z.enum(INSIGHT_TYPES),
    safe_facts: z.record(z.string(), z.unknown()),
    deterministic_copy: z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      evidence_text: z.string().min(1),
      action_label: z.string().nullable(),
    }),
  }),
  experience: z.object({
    framing_angle: z.string(),
    depth: z.string(),
    tone_style: z.string().nullable(),
    discreet_mode_enabled: z.boolean(),
  }),
  limits: z.object({
    title_max: z.number().int().positive(),
    body_max: z.number().int().positive(),
    evidence_max: z.number().int().positive(),
  }),
});

export const InsightNarratorOutputSchema = z.object({
  title: z.string().min(1).max(180),
  body: z.string().min(1).max(500),
  evidence_text: z.string().min(1).max(300),
  action_label: z.string().max(80).nullable(),
  confidence: z.number().min(0).max(1),
  preserved_fact_keys: z.array(z.string()).max(40),
});

export type InsightNarratorContextPack = z.infer<
  typeof InsightNarratorContextPackSchema
>;
export type InsightNarratorOutput = z.infer<
  typeof InsightNarratorOutputSchema
>;
