import { describe, expect, it } from "vitest";
import type { CaptureDraftResolutionResult } from "./capture-draft-memory";
import {
  shouldRoutePendingMissToCorrection,
  shouldRouteZeroActionTurnToConversation,
} from "./financial-orchestrator";
import type { ConversationTurnState } from "@/agents/conversation-agent";
import type { WhatsAppPendingResolutionResult } from "./whatsapp-pending-confirmation";

const noActivePendingDiscard = {
  kind: "needs_clarification",
  reason: "no_active_pending",
  action: "discard",
  pending_code: null,
  pending_count: 0,
  pending_item: null,
  movement: null,
  idempotent: false,
} satisfies WhatsAppPendingResolutionResult;

const noActiveCaptureDraft = {
  kind: "needs_clarification",
  reason: "no_active_capture_draft",
  action: "discard",
  draft: null,
} satisfies CaptureDraftResolutionResult;

describe("FinancialOrchestrator routing", () => {
  it("reenvia descarte contextual a correccion cuando no hay pendiente ni borrador", () => {
    expect(
      shouldRoutePendingMissToCorrection({
        pendingResolution: noActivePendingDiscard,
        captureDraftResolution: noActiveCaptureDraft,
        text: "descartalo",
        allowDeterministicFallback: true,
      })
    ).toBe(true);
  });

  it("no reenvia referencias explicitas a pendientes", () => {
    expect(
      shouldRoutePendingMissToCorrection({
        pendingResolution: noActivePendingDiscard,
        captureDraftResolution: noActiveCaptureDraft,
        text: "descarta pendiente",
        allowDeterministicFallback: true,
      })
    ).toBe(false);
  });

  it("no reenvia si existe un borrador activo descartado", () => {
    const discardedDraft = {
      kind: "discarded",
      reason: "active_capture_draft_discarded",
      action: "discard",
      draft: {
        state_id: "state",
        reason: "financial_capture_no_action",
        original_message: "gaste en desayuno",
        received_at: "2026-07-16T10:00:00.000Z",
        source_ref: "event",
        created_at: "2026-07-16T10:00:00.000Z",
        data_agent_output: null,
        financial_plan: null,
      },
    } satisfies CaptureDraftResolutionResult;

    expect(
      shouldRoutePendingMissToCorrection({
        pendingResolution: noActivePendingDiscard,
        captureDraftResolution: discardedDraft,
        text: "descartalo",
        allowDeterministicFallback: true,
      })
    ).toBe(false);
  });

  it("no reemplaza una decision semantica con el clasificador degradado", () => {
    expect(
      shouldRoutePendingMissToCorrection({
        pendingResolution: noActivePendingDiscard,
        captureDraftResolution: noActiveCaptureDraft,
        text: "descartalo",
        allowDeterministicFallback: false,
      }),
    ).toBe(false);
  });

  it("usa el intent de DataAgent solo cuando el planner no estuvo disponible", () => {
    expect(
      shouldRouteZeroActionTurnToConversation({
        proposedActionCount: 0,
        dataAgentIntent: "conversation",
        orchestrationRoute: null,
        turnState: turnState({ should_route_to_conversation_agent: false }),
      })
    ).toBe(true);
  });

  it("no reemplaza una ruta semantica de soporte con el intent de DataAgent", () => {
    expect(
      shouldRouteZeroActionTurnToConversation({
        proposedActionCount: 0,
        dataAgentIntent: "conversation",
        orchestrationRoute: "support",
        turnState: turnState({ should_route_to_conversation_agent: true }),
      })
    ).toBe(false);
  });

  it("enruta una consulta semantica aunque DataAgent la marque desconocida", () => {
    expect(
      shouldRouteZeroActionTurnToConversation({
        proposedActionCount: 0,
        dataAgentIntent: "unknown",
        orchestrationRoute: "conversation_agent",
        turnState: turnState({ should_route_to_conversation_agent: false }),
      })
    ).toBe(true);
  });

  it("no desvia una captura con accion financiera lista", () => {
    expect(
      shouldRouteZeroActionTurnToConversation({
        proposedActionCount: 1,
        dataAgentIntent: "record_movement",
        orchestrationRoute: "data_agent",
        turnState: turnState({ should_route_to_conversation_agent: true }),
      })
    ).toBe(false);
  });
});

function turnState(
  overrides: Partial<ConversationTurnState> = {}
): ConversationTurnState {
  return {
    act: "smalltalk",
    continuity: "new_topic",
    emotional_state: "neutral",
    experience_mode: "support",
    should_use_active_memory: false,
    should_route_to_conversation_agent: true,
    should_ask_clarification_first: false,
    personalization_cues: [],
    response_guidance: [],
    risk_notes: [],
    ...overrides,
  };
}
