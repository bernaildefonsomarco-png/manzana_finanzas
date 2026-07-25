import { z } from "zod";
import type { Movement } from "@/shared/types/domain";

export const LearningMemoryKindSchema = z.enum([
  "preference",
  "alias",
  "person_context",
  "correction_pattern",
  "narrative_fact",
]);
export type LearningMemoryKind = z.infer<typeof LearningMemoryKindSchema>;

export const LearningEvidenceBasisSchema = z.enum([
  "explicit_user_statement",
  "confirmed_correction",
  "repeated_behavior",
  "explicit_feedback",
]);
export type LearningEvidenceBasis = z.infer<
  typeof LearningEvidenceBasisSchema
>;

export const LearningCandidateProposalSchema = z.object({
  kind: LearningMemoryKindSchema,
  canonical_key: z.string().min(3).max(180),
  summary: z.string().min(3).max(500),
  search_terms: z.array(z.string().min(1).max(80)).max(30),
  basis: LearningEvidenceBasisSchema,
  confidence: z.number().min(0).max(1),
  sensitivity: z.enum(["normal", "sensitive"]),
  requires_user_confirmation: z.boolean(),
  valid_until: z.string().datetime({ offset: true }).nullable(),
  evidence_signals: z.array(z.string().min(1).max(240)).max(10),
});
export type LearningCandidateProposal = z.infer<
  typeof LearningCandidateProposalSchema
>;

export const LearningSignalOutputSchema = z.object({
  candidates: z.array(LearningCandidateProposalSchema).max(8),
  confidence: z.number().min(0).max(1),
  safe_explanation: z.string().min(1).max(500),
});
export type LearningSignalOutput = z.infer<typeof LearningSignalOutputSchema>;

export type LearningSignalContextPack = {
  context_pack_type: "learning_signal_context";
  version: "v1";
  user_id: string;
  locale: "es-PE";
  timezone: string;
  signal_type: "confirmed_correction";
  event_confirmed: true;
  evidence_source: "confirmed_correction";
  evidence_ref: string;
  movement: Pick<
    Movement,
    | "id"
    | "type"
    | "description"
    | "merchant"
    | "category_id"
    | "source"
    | "occurred_at"
  >;
  correction: {
    kind: string;
    related_person_name: string | null;
    target_value: string | number | null;
  };
};
