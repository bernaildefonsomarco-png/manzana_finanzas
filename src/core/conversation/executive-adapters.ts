import type { ConversationAgent } from "@/agents/conversation-agent";
import type {
  ConversationContextPack,
  ConversationTurnState,
} from "@/agents/conversation-agent/types";
import {
  compileSemanticCorrection,
  type CorrectionAgent,
  type CorrectionContextPack,
} from "@/agents/correction-agent";
import type { DataAgent } from "@/agents/data-agent";
import type { CaptureDraftResolutionResult } from "@/core/orchestrator/capture-draft-memory";
import { composeConversationAnswer } from "./grounded-response-composer";
import type {
  CoordinatedTurnPlan,
  ConversationalExecutiveTrace,
} from "./turn-coordinator";

type DataAgentExtractResult = Awaited<ReturnType<DataAgent["extract"]>>;

export function dataAgentResultFromExecutive(
  planning: CoordinatedTurnPlan | null,
): DataAgentExtractResult {
  const executive = requireExecutiveTrace(planning);
  return {
    output: executive.result.output.financial_proposals,
    runtime: executive.result.runtime,
    safety: {
      ...executive.result.safety,
      policy_flags: [
        ...new Set([
          ...executive.result.safety.policy_flags,
          "financial_proposal_from_conversational_executive",
        ]),
      ],
    },
  };
}

export function dataAgentResultFromCaptureDraft(
  draft: Extract<
    CaptureDraftResolutionResult,
    { kind: "ready_to_replay" }
  >["draft"],
): DataAgentExtractResult {
  if (!draft.data_agent_output) {
    throw new Error(
      "El borrador de captura no contiene una propuesta financiera validada.",
    );
  }
  return {
    output: draft.data_agent_output,
    runtime: {
      provider: "stored_capture_draft",
      model_name: "none",
      latency_ms: 0,
    },
    safety: {
      policy_flags: [
        "stored_financial_proposal_reused",
        "no_independent_data_agent_call",
      ],
      redaction_applied: false,
    },
  };
}

export function correctionResultFromExecutive(
  planning: CoordinatedTurnPlan | null,
  contextPack: CorrectionContextPack,
): Awaited<ReturnType<CorrectionAgent["propose"]>> {
  const executive = requireExecutiveTrace(planning);
  return {
    output: compileSemanticCorrection(
      contextPack,
      executive.result.output.correction_proposal,
    ),
    runtime: executive.result.runtime,
    safety: {
      ...executive.result.safety,
      policy_flags: [
        ...new Set([
          ...executive.result.safety.policy_flags,
          "correction_proposal_from_conversational_executive",
          "candidate_ids_bounded_by_context_pack",
          "requires_user_confirmation",
        ]),
      ],
    },
  };
}

export function conversationResultFromExecutive(
  executive: ConversationalExecutiveTrace | null,
): Awaited<ReturnType<ConversationAgent["answer"]>> {
  if (!executive) {
    throw new Error(
      "Falta ConversationalExecutiveAgent para componer la respuesta.",
    );
  }
  return {
    output: executive.result.output.response_composition,
    runtime: executive.result.runtime,
    tool_calls: executive.result.tool_calls,
    safety: {
      ...executive.result.safety,
      policy_flags: [
        ...new Set([
          ...executive.result.safety.policy_flags,
          "response_composition_from_conversational_executive",
        ]),
      ],
    },
  };
}

export function conversationResultFromPostCoreEvidence(
  contextPack: ConversationContextPack,
  executive: ConversationalExecutiveTrace | null,
): Awaited<ReturnType<ConversationAgent["answer"]>> {
  if (!executive) {
    throw new Error(
      "Falta la autoridad ejecutiva que interpreto el flujo mixto.",
    );
  }
  const output = composeConversationAnswer(contextPack);
  return {
    output,
    runtime: {
      provider: "deterministic_grounded_composer",
      model_name: "post-core-evidence-v1",
      latency_ms: 0,
      cost_estimate: 0,
    },
    tool_calls: contextPack.tool_results.map((result) => ({
      tool_name: result.tool_name,
      status: result.status,
    })),
    safety: {
      policy_flags: [
        ...new Set([
          ...executive.result.safety.policy_flags,
          "single_semantic_authority_preserved",
          "post_core_tool_evidence_refreshed",
          "deterministic_grounded_channel_composition",
          "not_a_local_fixture_fallback",
        ]),
      ],
      redaction_applied: executive.result.safety.redaction_applied,
    },
  };
}

export function conversationContextFromExecutive(input: {
  planning: CoordinatedTurnPlan | null;
  query: ConversationContextPack["query"];
  turnState: ConversationTurnState;
}): ConversationContextPack {
  const executive = requireExecutiveTrace(input.planning);
  return {
    ...executive.contextPack.conversation_context,
    query: input.query,
    turn_state: input.turnState,
    tool_results: executive.result.tool_results,
  };
}

export function requireExecutiveTrace(
  planning: CoordinatedTurnPlan | null,
): ConversationalExecutiveTrace {
  if (!planning?.executive) {
    throw new Error(
      "El modo active requiere un ConversationalExecutiveAgent valido.",
    );
  }
  return planning.executive;
}
