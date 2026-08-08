import { describe, expect, it } from "vitest";
import type { CaptureDraftResolutionResult } from "./capture-draft-memory";
import {
  shouldRoutePendingMissToCorrection,
  shouldRouteZeroActionTurnToConversation,
} from "./financial-orchestrator";
import type { ConversationTurnState } from "@/agents/conversation-agent";
import type { PendingResolutionResult } from "./pending-resolution-from-text";

const noActivePendingDiscard = {
  kind: "needs_clarification",
  reason: "no_active_pending",
  action: "discard",
  pending_code: null,
  pending_count: 0,
  pending_item: null,
  movement: null,
  idempotent: false,
} satisfies PendingResolutionResult;

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
        orchestrationRoute: null,
      })
    ).toBe(true);
  });

  it("no reenvia referencias explicitas a pendientes", () => {
    expect(
      shouldRoutePendingMissToCorrection({
        pendingResolution: noActivePendingDiscard,
        captureDraftResolution: noActiveCaptureDraft,
        text: "descarta pendiente",
        orchestrationRoute: null,
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
        orchestrationRoute: null,
      })
    ).toBe(false);
  });

  it("no reemplaza una decision semantica con el clasificador degradado", () => {
    expect(
      shouldRoutePendingMissToCorrection({
        pendingResolution: noActivePendingDiscard,
        captureDraftResolution: noActiveCaptureDraft,
        text: "descartalo",
        orchestrationRoute: "data_agent",
      }),
    ).toBe(false);
  });

  // Con el ejecutivo conversacional activo siempre hay plan, asi que el desvio
  // solo existe si obedece al plan: antes se apagaba entero y esta proteccion
  // no corria nunca en produccion.
  it("reenvia a correccion cuando el plan dice que el turno es una correccion", () => {
    expect(
      shouldRoutePendingMissToCorrection({
        pendingResolution: noActivePendingDiscard,
        captureDraftResolution: noActiveCaptureDraft,
        text: "descartalo",
        orchestrationRoute: "correction_agent",
      }),
    ).toBe(true);
  });

  it("obedece al plan aunque el clasificador deterministico no reconozca el texto", () => {
    expect(
      shouldRoutePendingMissToCorrection({
        pendingResolution: noActivePendingDiscard,
        captureDraftResolution: noActiveCaptureDraft,
        text: "ese de ayer no va",
        orchestrationRoute: "correction_agent",
      }),
    ).toBe(true);
  });

  it("no reenvia con plan de correccion si el borrador quedo invalido", () => {
    expect(
      shouldRoutePendingMissToCorrection({
        pendingResolution: noActivePendingDiscard,
        captureDraftResolution: {
          kind: "needs_clarification",
          reason: "invalid_capture_draft",
          action: "discard",
          draft: null,
        } satisfies CaptureDraftResolutionResult,
        text: "descartalo",
        orchestrationRoute: "correction_agent",
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
