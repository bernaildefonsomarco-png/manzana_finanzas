import { RecurringSignalAgent } from "@/agents/recurring-signal-agent";
import {
  normalizeRecurringMerchantKey,
  type RecurringCandidateSuggestion,
} from "./recurring-detector";

export type RecurringAgentEnrichment = {
  agent_name: "recurring_signal_agent";
  display_name: string;
  user_explanation: string;
  sensitivity: "normal" | "caution" | "sensitive";
  requires_confirmation_advisory: boolean;
  confidence: number;
  preserved_evidence_keys: string[];
  applied: boolean;
};

export async function enrichRecurringCandidate(
  suggestion: RecurringCandidateSuggestion,
  input: { agent: RecurringSignalAgent; traceId: string },
): Promise<{
  suggestion: RecurringCandidateSuggestion;
  enrichment: RecurringAgentEnrichment | null;
}> {
  try {
    const response = await input.agent.assess(
      {
        context_pack_type: "recurring_signal_context",
        version: "v1",
        locale: "es-PE",
        candidate: {
          merchant_key: suggestion.merchant_key,
          deterministic_display_name: suggestion.evidence.display_name,
          category_id: suggestion.category_id,
          confidence: suggestion.confidence,
          status: suggestion.status,
          frequency: suggestion.evidence.inferred_frequency,
          amount_variability: suggestion.evidence.amount_variability,
          movement_count: suggestion.evidence.movement_count,
          dates: suggestion.evidence.dates,
          amounts: suggestion.evidence.amounts,
          sample_titles: suggestion.evidence.sample_titles,
          next_expected_date: suggestion.evidence.next_expected_date,
        },
      },
      input.traceId,
    );
    const allowedKeys = new Set([
      "merchant_key",
      "deterministic_display_name",
      "category_id",
      "confidence",
      "status",
      "frequency",
      "amount_variability",
      "movement_count",
      "dates",
      "amounts",
      "sample_titles",
      "next_expected_date",
    ]);
    const output = response.output;
    const safe =
      output.preserved_evidence_keys.every((key) => allowedKeys.has(key)) &&
      isRecurringDisplayNameSafe(output.display_name, suggestion) &&
      hasOnlyEvidenceNumbers(output.user_explanation, suggestion);
    const displayName = safe
      ? output.display_name.trim()
      : suggestion.evidence.display_name;
    const sensitivity = safe ? output.sensitivity : "caution";
    const nextStatus =
      suggestion.status === "ready_to_suggest" && sensitivity === "sensitive"
        ? "candidate"
        : suggestion.status;

    return {
      suggestion: {
        ...suggestion,
        status: nextStatus,
        evidence: { ...suggestion.evidence, display_name: displayName },
      },
      enrichment: {
        agent_name: "recurring_signal_agent",
        display_name: displayName,
        user_explanation: safe
          ? output.user_explanation.trim()
          : "Detectamos un patron repetido que requiere confirmacion antes de crear una regla.",
        sensitivity,
        requires_confirmation_advisory: true,
        confidence: safe ? output.confidence : 0,
        preserved_evidence_keys: safe ? output.preserved_evidence_keys : [],
        applied: safe,
      },
    };
  } catch {
    return { suggestion, enrichment: null };
  }
}

export function isRecurringDisplayNameSafe(
  displayName: string,
  suggestion: RecurringCandidateSuggestion,
): boolean {
  const proposed = normalizeRecurringMerchantKey(displayName);
  if (!proposed) return false;
  const evidenceTokens = new Set(
    [suggestion.merchant_key, ...suggestion.evidence.sample_titles]
      .map((value) => normalizeRecurringMerchantKey(value))
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.split(" ")),
  );
  return proposed.split(" ").some((token) => evidenceTokens.has(token));
}

function hasOnlyEvidenceNumbers(
  value: string,
  suggestion: RecurringCandidateSuggestion,
): boolean {
  const allowed = new Set(
    extractNumbers(
      JSON.stringify({
        movement_count: suggestion.evidence.movement_count,
        dates: suggestion.evidence.dates,
        amounts: suggestion.evidence.amounts,
        next_expected_date: suggestion.evidence.next_expected_date,
        interval_days: suggestion.evidence.interval_days,
      }),
    ),
  );
  return extractNumbers(value).every((number) => allowed.has(number));
}

function extractNumbers(value: string): string[] {
  return (value.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((number) =>
    number.replace(",", ".").replace(/\.0+$/, ""),
  );
}
