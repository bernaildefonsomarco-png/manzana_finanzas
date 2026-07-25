import { describe, expect, it } from "vitest";
import type { AgentRuntime } from "@/agents/runtime";
import { RecurringSignalAgent } from "@/agents/recurring-signal-agent";
import { LocalFixtureRecurringSignalAgentRuntime } from "@/agents/recurring-signal-agent/local-fixture-runtime";
import type { RecurringCandidateSuggestion } from "./recurring-detector";
import { enrichRecurringCandidate } from "./recurring-candidate-enricher";

describe("enrichRecurringCandidate", () => {
  it("aplica un nombre explicable sin cambiar cadencia, monto ni fecha", async () => {
    const original = suggestion();
    const result = await enrichRecurringCandidate(original, {
      agent: new RecurringSignalAgent(
        new LocalFixtureRecurringSignalAgentRuntime(),
      ),
      traceId: "trace-1",
    });

    expect(result.enrichment?.applied).toBe(true);
    expect(result.suggestion.evidence.inferred_frequency).toBe(
      original.evidence.inferred_frequency,
    );
    expect(result.suggestion.evidence.inferred_amount).toBe(
      original.evidence.inferred_amount,
    );
    expect(result.suggestion.evidence.next_expected_date).toBe(
      original.evidence.next_expected_date,
    );
  });

  it("rechaza nombres y cifras inventadas y conserva la evidencia deterministica", async () => {
    const original = suggestion();
    const maliciousRuntime: AgentRuntime = {
      async run() {
        return {
          output: {
            display_name: "Seguro privado inventado",
            user_explanation: "Seran S/999 el 30 de agosto.",
            sensitivity: "normal",
            requires_confirmation_advisory: false,
            confidence: 1,
            preserved_evidence_keys: ["amounts", "secret_field"],
          },
          confidence: 1,
          tool_calls: [],
          runtime: { provider: "local_fixture", latency_ms: 0 },
          safety: { policy_flags: [], redaction_applied: false },
        } as never;
      },
    };

    const result = await enrichRecurringCandidate(original, {
      agent: new RecurringSignalAgent(maliciousRuntime),
      traceId: "trace-2",
    });

    expect(result.enrichment?.applied).toBe(false);
    expect(result.suggestion).toEqual(original);
    expect(result.enrichment?.requires_confirmation_advisory).toBe(true);
  });
});

function suggestion(): RecurringCandidateSuggestion {
  return {
    merchant_key: "netflix",
    category_id: "servicios_suscripciones",
    confidence: 0.92,
    status: "ready_to_suggest",
    evidence: {
      detector_version: "recurring-detector-v1",
      source: "confirmed_movements",
      movement_ids: ["m1", "m2", "m3"],
      movement_count: 3,
      dates: ["2026-05-15", "2026-06-15", "2026-07-15"],
      amounts: [39.9, 39.9, 39.9],
      sample_titles: ["Netflix"],
      first_seen: "2026-05-15",
      last_seen: "2026-07-15",
      display_name: "Netflix",
      inferred_frequency: "monthly",
      inferred_amount: 39.9,
      amount_variability: "fixed",
      amount_variation_ratio: 0,
      next_expected_date: "2026-08-15",
      day_of_month: 15,
      date_window_start_day: null,
      date_window_end_day: null,
      category_id: "servicios_suscripciones",
      currency: "PEN",
      interval_days: 31,
    },
  };
}
