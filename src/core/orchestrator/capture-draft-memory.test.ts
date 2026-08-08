import { describe, expect, it } from "vitest";
import type { DataAgentOutput } from "@/agents/data-agent";
import type { ConversationTurnState } from "@/agents/conversation-agent";
import type { ConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import type { DataActionPlan } from "./data-action-policy";
import {
  parseCaptureDraftFromMemoryState,
  shouldRememberCaptureDraft,
} from "./capture-draft-memory";

const receivedAt = "2026-07-16T15:00:00.000-05:00";

const financialCaptureTurn: ConversationTurnState = {
  act: "financial_capture",
  continuity: "new_topic",
  emotional_state: "neutral",
  experience_mode: "quick_capture",
  should_use_active_memory: false,
  should_route_to_conversation_agent: false,
  should_ask_clarification_first: false,
  response_guidance: [],
  personalization_cues: [],
  risk_notes: [],
};

const noActionOutput: DataAgentOutput = {
  intent: "conversation",
  confidence: 0.66,
  result: [],
  ambiguities: [],
  requires_confirmation: false,
  evidence_signals: [],
  safe_explanation: "El usuario parece haber mencionado un gasto.",
};

const movementOutput: DataAgentOutput = {
  intent: "record_movement",
  confidence: 0.88,
  result: [
    {
      action_id: "action_1",
      command_id: null,
      movement_type: "gasto",
      amount: 20,
      currency: "PEN",
      occurred_at: receivedAt,
      description: "desayuno",
      category_id: "alimentacion",
      subcategory_id: null,
      tags: [],
      account_origin_id: null,
      account_destination_id: null,
      box_origin_id: null,
      box_destination_id: null,
      debt_hint: null,
      recurring_hint: null,
      related_person_hint: null,
      source_evidence: [
        {
          field: "description",
          value: "desayuno",
          source: "user_text",
        },
      ],
      confidence: 0.88,
    },
  ],
  ambiguities: [],
  requires_confirmation: false,
  evidence_signals: [],
  safe_explanation: "Gasto simple detectado.",
};

describe("CaptureDraftMemory", () => {
  it("recupera un borrador valido desde metadata segura", () => {
    const state = memoryState({
      metadata: {
        capture_draft: {
          version: "v1",
          reason: "financial_capture_no_action",
          original_message: "hice un gasto de 20 soles comprando desayuno",
          received_at: receivedAt,
          source_ref: "external-event-1",
          created_at: receivedAt,
          data_agent_output: noActionOutput,
          financial_plan: {
            kind: "no_action",
            reason: "no_proposed_actions",
            blocked_reasons: [],
            proposed_actions_count: 0,
          },
        },
      },
    });

    expect(parseCaptureDraftFromMemoryState(state)).toMatchObject({
      state_id: "memory-state-1",
      reason: "financial_capture_no_action",
      original_message: "hice un gasto de 20 soles comprando desayuno",
      source_ref: "external-event-1",
      data_agent_output: {
        intent: "conversation",
        result: [],
      },
    });
  });

  it("solo recuerda no_action cuando el turno era captura financiera", () => {
    const plan: DataActionPlan = {
      kind: "no_action",
      reason: "no_proposed_actions",
      actions: [],
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 0,
    };

    expect(
      shouldRememberCaptureDraft({
        turnState: financialCaptureTurn,
        dataAgentOutput: noActionOutput,
        financialActionPlan: plan,
      })
    ).toBe("financial_capture_no_action");

    expect(
      shouldRememberCaptureDraft({
        turnState: {
          ...financialCaptureTurn,
          act: "financial_question",
          experience_mode: "read_only_answer",
        },
        dataAgentOutput: noActionOutput,
        financialActionPlan: plan,
      })
    ).toBeNull();
  });

  it("recuerda capturas bloqueadas con accion propuesta para un follow-up", () => {
    const plan: DataActionPlan = {
      kind: "blocked",
      reason: "all_actions_blocked",
      actions: [
        {
          action_id: "action_1",
          decision: "blocked",
          risk_level: "high",
          reasons: ["missing_amount"],
          movement_input: null,
        },
      ],
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 1,
    };

    expect(
      shouldRememberCaptureDraft({
        turnState: financialCaptureTurn,
        dataAgentOutput: movementOutput,
        financialActionPlan: plan,
      })
    ).toBe("financial_action_blocked");
  });
});

function memoryState(
  overrides: Partial<ConversationMemoryState> = {}
): ConversationMemoryState {
  return {
    id: "memory-state-1",
    user_id: "user-1",
    channel: "whatsapp",
    scope: "capture_draft",
    thread_key: "",
    last_intent: "record_movement",
    last_query_kind: null,
    last_query_text: null,
    last_query_date_range: null,
    last_tool_name: "data_agent",
    last_result_summary: null,
    referenced_movements: [],
    referenced_entities: [],
    continuity_hint: null,
    source_ref: null,
    expires_at: "2026-07-16T15:30:00.000-05:00",
    updated_at: receivedAt,
    metadata: {},
    working_set: null,
    ...overrides,
  };
}
