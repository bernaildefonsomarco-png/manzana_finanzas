import { z } from "zod";
import {
  CATEGORY_IDS,
  RECURRING_AMOUNT_VARIABILITIES,
  RECURRING_FREQUENCIES,
  RECURRING_CANDIDATE_STATUSES,
} from "@/shared/types/domain";

export const RecurringSignalContextPackSchema = z.object({
  context_pack_type: z.literal("recurring_signal_context"),
  version: z.literal("v1"),
  locale: z.literal("es-PE"),
  candidate: z.object({
    merchant_key: z.string().min(1).max(180),
    deterministic_display_name: z.string().min(1).max(180),
    category_id: z.enum(CATEGORY_IDS).nullable(),
    confidence: z.number().min(0).max(1),
    status: z.enum(RECURRING_CANDIDATE_STATUSES),
    frequency: z.enum(RECURRING_FREQUENCIES),
    amount_variability: z.enum(RECURRING_AMOUNT_VARIABILITIES),
    movement_count: z.number().int().min(2).max(1_000),
    dates: z.array(z.string()).max(8),
    amounts: z.array(z.number().positive()).max(8),
    sample_titles: z.array(z.string()).max(5),
    next_expected_date: z.string(),
  }),
});

export const RecurringSignalOutputSchema = z.object({
  display_name: z.string().min(1).max(180),
  user_explanation: z.string().min(1).max(400),
  sensitivity: z.enum(["normal", "caution", "sensitive"]),
  requires_confirmation_advisory: z.boolean(),
  confidence: z.number().min(0).max(1),
  preserved_evidence_keys: z.array(z.string()).max(20),
});

export type RecurringSignalContextPack = z.infer<
  typeof RecurringSignalContextPackSchema
>;
export type RecurringSignalOutput = z.infer<typeof RecurringSignalOutputSchema>;
