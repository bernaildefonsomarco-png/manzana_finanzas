import type { AgentRuntimeRequest, AgentRuntimeResponse } from "@/agents/runtime";
import {
  RecurringSignalContextPackSchema,
  RecurringSignalOutputSchema,
} from "./types";

export class LocalFixtureRecurringSignalAgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context = RecurringSignalContextPackSchema.parse(request.context_pack);
    const candidate = context.candidate;
    const output = RecurringSignalOutputSchema.parse({
      display_name: candidate.deterministic_display_name,
      user_explanation: `Detectamos ${candidate.movement_count} movimientos con una frecuencia parecida.`,
      sensitivity: "normal",
      requires_confirmation_advisory: true,
      confidence: 1,
      preserved_evidence_keys: [
        "merchant_key",
        "movement_count",
        "dates",
        "amounts",
        "frequency",
        "next_expected_date",
      ],
    });

    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "recurring-signal-fixture-v1",
        latency_ms: 0,
      },
      safety: {
        policy_flags: [
          "advisory_only",
          "cadence_and_amount_are_deterministic",
          "user_confirmation_remains_required",
        ],
        redaction_applied: false,
      },
    };
  }
}
