import { z } from "zod";
import { CATEGORY_IDS, MOVEMENT_TYPES } from "@/shared/types/domain";

export const RiskSemanticLevelSchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "sensitive",
]);

export const RiskSignalAssessmentSchema = z.object({
  action_id: z.string().min(1).max(120),
  semantic_level: RiskSemanticLevelSchema,
  signals: z.array(z.string().min(1).max(120)).max(12),
  confidence: z.number().min(0).max(1),
  requires_confirmation_advisory: z.boolean(),
  safe_explanation: z.string().min(1).max(400),
});

export const RiskSignalOutputSchema = z.object({
  assessments: z.array(RiskSignalAssessmentSchema).max(12),
  confidence: z.number().min(0).max(1),
  safe_explanation: z.string().min(1).max(500),
});

export type RiskSignalOutput = z.infer<typeof RiskSignalOutputSchema>;
export type RiskSignalAssessment = z.infer<typeof RiskSignalAssessmentSchema>;

export const RiskSignalContextPackSchema = z.object({
  context_pack_type: z.literal("risk_signal_context"),
  version: z.literal("v1"),
  user_id: z.string().uuid(),
  locale: z.literal("es-PE"),
  timezone: z.string().min(1),
  channel: z.enum(["whatsapp", "dashboard", "email", "worker"]),
  original_message: z.string().max(2_000),
  actions: z.array(
    z.object({
      action_id: z.string(),
      movement_type: z.enum(MOVEMENT_TYPES),
      amount: z.number().positive().nullable(),
      description: z.string().nullable(),
      category_id: z.enum(CATEGORY_IDS).nullable(),
      category_sensitive: z.boolean(),
      confidence: z.number().min(0).max(1),
      source_evidence: z.array(z.string()).max(20),
    }),
  ),
  risk_context: z.record(z.string(), z.unknown()),
});

export type RiskSignalContextPack = z.infer<typeof RiskSignalContextPackSchema>;
