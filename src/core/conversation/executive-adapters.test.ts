import { describe, expect, it } from "vitest";

import type {
  ConversationContextPack,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import type { ConversationalExecutiveTrace } from "./turn-coordinator";
import { conversationResultFromPostCoreEvidence } from "./executive-adapters";

describe("executive adapters", () => {
  it("recompone un flujo mixto con evidencia posterior a Core sin fixture", () => {
    const context = postCoreConversationContext();
    const result = conversationResultFromPostCoreEvidence(
      context,
      executiveTrace(),
    );

    expect(result.runtime).toMatchObject({
      provider: "deterministic_grounded_composer",
      model_name: "post-core-evidence-v1",
    });
    expect(result.runtime.provider).not.toBe("local_fixture");
    expect(result.output.response_text).toContain("2 movimientos");
    expect(result.output.response_text).toContain("Desayuno");
    expect(result.output.cited_facts).toContain("movement_count=2");
    expect(result.safety.policy_flags).toContain(
      "post_core_tool_evidence_refreshed",
    );
  });
});

function postCoreConversationContext(): ConversationContextPack {
  const turnState: ConversationTurnState = {
    act: "financial_question",
    continuity: "follow_up",
    emotional_state: "neutral",
    experience_mode: "read_only_answer",
    should_use_active_memory: false,
    should_route_to_conversation_agent: true,
    should_ask_clarification_first: false,
    response_guidance: [],
    personalization_cues: [],
    risk_notes: [],
  };
  return {
    context_pack_type: "conversation_context",
    version: "v1",
    user_id: "00000000-0000-4000-8000-000000000001",
    locale: "es-PE",
    timezone: "America/Lima",
    original_message: "gaste 20 en desayuno, como voy esta semana?",
    received_at: "2026-07-24T10:00:00-05:00",
    query: {
      kind: "movement_search",
      normalized_text: "como voy esta semana",
      requested_amount: null,
      date_range: {
        start: "2026-07-20T00:00:00-05:00",
        end: "2026-07-26T23:59:59-05:00",
        label: "esta semana",
      },
      movement_filters: null,
      confidence: 0.95,
    },
    turn_state: turnState,
    active_conversation_state: {
      state_id: null,
      last_intent: null,
      last_query_kind: null,
      last_query_text: null,
      last_query_date_range: null,
      last_result_summary: null,
      referenced_movements: [],
      referenced_entities: [],
      continuity_hint: null,
      expires_at: null,
      working_set: null,
    },
    preferences_summary: {
      tone_style: null,
      conversation_style: null,
      discreet_mode: false,
      whatsapp_opt_in: true,
      email_opt_in: false,
      quiet_hours: null,
      default_account_id: null,
    },
    memory_summary: {
      frequent_people: [],
      recent_corrections: [],
    },
    permissions: {
      read_only: true,
      can_mutate_financial_data: false,
    },
    tool_results: [
      {
        tool_name: "query_movements",
        status: "called",
        facts: ["movement_count=2", "net_amount=S/ -28.00"],
        warnings: [],
        data: {
          date_label: "esta semana",
          movements: [
            {
              id: "new-core-movement",
              type: "gasto",
              amount: 20,
              currency: "PEN",
              description: "Desayuno",
              occurred_at: "2026-07-24T09:59:00-05:00",
            },
            {
              id: "existing-movement",
              type: "gasto",
              amount: 8,
              currency: "PEN",
              description: "Cafe",
              occurred_at: "2026-07-22T16:00:00-05:00",
            },
          ],
        },
      },
    ],
    data_limits: [],
  };
}

function executiveTrace(): ConversationalExecutiveTrace {
  return {
    mode: "active",
    result: {
      output: {} as never,
      runtime: {
        provider: "api",
        model_name: "model-test",
        latency_ms: 100,
      },
      tool_calls: [],
      tool_results: [],
      safety: {
        policy_flags: ["single_semantic_turn_authority"],
        redaction_applied: false,
      },
    },
    contextPack: {} as never,
    divergences: [],
  };
}
