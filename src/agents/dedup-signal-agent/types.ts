import { z } from "zod";
import { MOVEMENT_SOURCES, MOVEMENT_TYPES } from "@/shared/types/domain";

const DedupComparableSchema = z.object({
  reference_id: z.string(),
  movement_type: z.enum(MOVEMENT_TYPES),
  amount: z.number().positive(),
  currency: z.enum(["PEN", "USD"]),
  occurred_at: z.string().datetime({ offset: true }),
  description: z.string().nullable(),
  merchant: z.string().nullable(),
  source: z.enum(MOVEMENT_SOURCES),
});

export const DedupSignalContextPackSchema = z.object({
  context_pack_type: z.literal("dedup_signal_context"),
  version: z.literal("v1"),
  user_id: z.string().uuid(),
  incoming: DedupComparableSchema,
  candidates: z.array(
    DedupComparableSchema.extend({
      deterministic_score: z.number().min(0).max(1),
      deterministic_reasons: z.array(z.string()).max(12),
    }),
  ).max(8),
});

export const DedupSignalAssessmentSchema = z.object({
  candidate_reference_id: z.string(),
  relation: z.enum(["same_transaction", "possibly_same", "different"]),
  confidence: z.number().min(0).max(1),
  evidence_signals: z.array(z.string().min(1).max(120)).max(12),
  safe_explanation: z.string().min(1).max(400),
});

export const DedupSignalOutputSchema = z.object({
  assessments: z.array(DedupSignalAssessmentSchema).max(8),
  confidence: z.number().min(0).max(1),
  safe_explanation: z.string().min(1).max(500),
});

export type DedupSignalContextPack = z.infer<typeof DedupSignalContextPackSchema>;
export type DedupSignalOutput = z.infer<typeof DedupSignalOutputSchema>;
