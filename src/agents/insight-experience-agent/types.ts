import { z } from "zod";
import { INSIGHT_TYPES, RISK_LEVELS } from "@/shared/types/domain";

export const InsightExperienceContextPackSchema = z.object({
  context_pack_type: z.literal("insight_experience_context"),
  version: z.literal("v1"),
  locale: z.literal("es-PE"),
  candidate: z.object({
    fingerprint: z.string().min(1),
    type: z.enum(INSIGHT_TYPES),
    risk_level: z.enum(RISK_LEVELS),
    rank_score: z.number().min(0).max(100),
    quality_score: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
    safe_facts: z.record(z.string(), z.unknown()),
    deterministic_copy: z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      evidence_text: z.string().min(1),
    }),
  }),
  user_context: z.object({
    onboarding_status: z.string().nullable(),
    tone_style: z.string().nullable(),
    discreet_mode_enabled: z.boolean(),
    recent_feedback: z.array(z.string()).max(10),
  }),
  candidate_channels: z.array(z.enum(["dashboard", "whatsapp"])).min(1),
});

export const InsightExperienceOutputSchema = z.object({
  display_recommendation: z.enum(["now", "dashboard_only", "hold"]),
  framing_angle: z.enum([
    "learning",
    "progress",
    "change",
    "pattern",
    "data_quality",
    "gentle_attention",
    "clarity",
  ]),
  depth: z.enum(["brief", "explanatory", "actionable"]),
  recommended_channel: z.enum(["dashboard", "whatsapp"]),
  hold_reason: z.string().max(240).nullable(),
  confidence: z.number().min(0).max(1),
  preserved_fact_keys: z.array(z.string()).max(40),
});

export type InsightExperienceContextPack = z.infer<
  typeof InsightExperienceContextPackSchema
>;
export type InsightExperienceOutput = z.infer<
  typeof InsightExperienceOutputSchema
>;
