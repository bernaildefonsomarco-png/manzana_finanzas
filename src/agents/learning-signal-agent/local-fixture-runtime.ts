import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime/types";
import {
  LearningSignalOutputSchema,
  type LearningSignalContextPack,
  type LearningSignalOutput,
} from "./types";

export class LocalFixtureLearningSignalAgentRuntime implements AgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    if (request.agent_name !== "learning_signal_agent") {
      throw new Error(
        "LocalFixtureLearningSignalAgentRuntime solo soporta learning_signal_agent",
      );
    }

    const startedAt = Date.now();
    const output = buildLocalLearningSignal(
      request.context_pack as LearningSignalContextPack,
    );

    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "local-learning-signal-fixture-v1",
        latency_ms: Date.now() - startedAt,
        cost_estimate: 0,
      },
      safety: {
        policy_flags: [
          "local_fixture",
          "proposal_only",
          "no_financial_write",
        ],
        redaction_applied: false,
      },
    };
  }
}

export function buildLocalLearningSignal(
  context: LearningSignalContextPack,
): LearningSignalOutput {
  const subject = normalizeSubject(
    context.movement.description ?? context.movement.merchant ?? "movimiento",
  );
  const correction = context.correction;
  const person = correction.related_person_name;
  const outcome = person
    ? `${correction.kind}:${normalizeSubject(person)}`
    : correction.target_value != null
      ? `${correction.kind}:${String(correction.target_value)}`
      : correction.kind;

  return LearningSignalOutputSchema.parse({
    candidates: [
      {
        kind: "correction_pattern",
        canonical_key: `correction:${correction.kind}:${subject}`,
        summary: `El usuario confirmo una correccion para ${subject}: ${outcome}.`,
        search_terms: [
          subject,
          correction.kind,
          context.movement.type,
          context.movement.category_id ?? "",
          person ?? "",
        ].filter(Boolean),
        basis: "confirmed_correction",
        confidence: 1,
        sensitivity: "normal",
        requires_user_confirmation: false,
        valid_until: null,
        evidence_signals: ["correction_confirmed_by_user"],
      },
    ],
    confidence: 1,
    safe_explanation:
      "Se propuso una memoria trazable a partir de una correccion confirmada.",
  });
}

function normalizeSubject(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 120);
}
