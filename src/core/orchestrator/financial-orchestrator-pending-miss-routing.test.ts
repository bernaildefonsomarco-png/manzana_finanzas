import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationalExecutiveAgent } from "@/agents/conversational-executive-agent";
import type { ConversationalExecutiveRunResult } from "@/agents/conversational-executive-agent";
import type { ConversationAgent } from "@/agents/conversation-agent";
import type { DataAgent } from "@/agents/data-agent";
import { buildSafePlanningContext } from "@/agents/orchestration-planning-agent";
import type { OrchestrationPlan } from "@/agents/orchestration-planning-agent/types";
import { composeLocalOrchestrationPlan } from "@/agents/orchestration-planning-agent/local-fixture-runtime";
import type { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import type { PresentedTurn } from "@/core/channel/types";
import type { PlanTurnBlocksResult } from "@/core/response/response-planner";
import { FinancialOrchestrator } from "./financial-orchestrator";

/**
 * El desvio de `shouldRoutePendingMissToCorrection` existia pero se apagaba
 * entero en cuanto habia plan semantico, es decir siempre que el ejecutivo
 * conversacional esta activo — la configuracion de produccion. Un plan que
 * declara `goal: correction` y ademas pide descartar un borrador que no existe
 * terminaba en la aclaracion "no hay nada que descartar" y nunca llegaba a la
 * ruta de correccion.
 *
 * Estos dos casos fijan el criterio nuevo: manda la ruta del plan.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
const RECEIVED_AT = "2026-08-07T10:00:00.000-05:00";

const externalEventFixture = {
  id: "event-pending-miss-1",
  source: "dashboard" as const,
  event_type: "assistant_turn",
  idempotency_key: "idem-pending-miss-1",
  user_id: USER_ID,
  received_at: RECEIVED_AT,
  status: "received" as const,
  payload_hash: "hash",
  payload_ref: null,
  trace_id: "trace-pending-miss",
  metadata: { thread_id: THREAD_ID } as Record<string, unknown>,
  created_at: RECEIVED_AT,
  updated_at: RECEIVED_AT,
};

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => externalEventFixture),
  updateExternalEventStatus: vi.fn(async () => undefined),
}));

vi.mock("@/data/repositories/conversation-memory.repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/data/repositories/conversation-memory.repository")
  >();
  return {
    ...actual,
    getActiveConversationMemoryState: vi.fn(async () => null),
    upsertConversationMemoryState: vi.fn(async () => null),
  };
});

function createGenericSupabaseClient() {
  const makeBuilder = (): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (resolve: (value: unknown) => void) =>
              resolve({ data: [], error: null });
          }
          if (prop === "maybeSingle" || prop === "single") {
            return () => Promise.resolve({ data: null, error: null });
          }
          return (..._args: unknown[]) => makeBuilder();
        },
      },
    );
  return { from: () => makeBuilder() } as unknown as never;
}

function fakePresentedTurn(): PresentedTurn {
  return {
    text: "ok",
    deliveryMode: null,
    interactiveOptionCount: null,
    sendStatus: "sent",
    sendReason: "test",
    idempotent: false,
    providerMessageId: null,
    errorCode: null,
    enhancement: {
      status: "not_applicable",
      reason: "test",
      confidence: null,
      provider: null,
      model: null,
      latencyMs: null,
      safetyFlags: [],
      styleActive: false,
      styleScope: null,
      styleAdherence: null,
      styleBlockedReasons: [],
      attemptCount: 0,
    },
  };
}

/** Plan del ejecutivo: el turno es una correccion o un registro, segun el caso. */
function executivePlan(goal: "correction" | "record"): OrchestrationPlan {
  const planningContext = buildSafePlanningContext({
    userId: USER_ID,
    timezone: "America/Lima",
    channel: "dashboard",
    originalMessage: "ese ya no va",
    receivedAt: RECEIVED_AT,
    query: {
      kind: "unsupported",
      normalized_text: "ese ya no va",
      requested_amount: null,
      date_range: null,
      movement_filters: null,
      confidence: 0.4,
    },
    turnState: {
      act: goal === "correction" ? "correction" : "financial_capture",
      continuity: "follow_up",
      emotional_state: "neutral",
      experience_mode: "support",
      should_use_active_memory: true,
      should_route_to_conversation_agent: false,
      should_ask_clarification_first: false,
      response_guidance: [],
      personalization_cues: [],
      risk_notes: [],
    },
  });

  return {
    ...composeLocalOrchestrationPlan(planningContext),
    goal,
    workflow: goal === "correction" ? "correction_review" : "financial_capture",
    // El ejecutivo pide descartar un borrador de captura que no existe: es el
    // turno exacto que caia en la aclaracion sin salida.
    financial_resolution: {
      action: "discard",
      target: "capture_draft",
      pending_code: null,
      account_origin_id: null,
      account_destination_id: null,
      category_id: null,
      learn_account_aliases: false,
      confidence: 0.9,
    },
  };
}

function buildOrchestrator(goal: "correction" | "record") {
  const executiveResult = {
    output: {
      orchestration_plan: executivePlan(goal),
      reference_resolution: {
        resolution: "no_candidate",
        focus_id: null,
        candidate_movement_ids: [],
        candidate_entity_ids: [],
        visible_order_ids: [],
        confidence: 0.5,
        ambiguities: [],
        evidence_refs: [],
      },
      financial_proposals: {
        intent: "conversation",
        result: [],
        confidence: 0.8,
        requires_confirmation: false,
        ambiguities: [],
      },
      correction_proposal: {
        is_correction: goal === "correction",
        command_id: null,
        operation: "none",
        correction_type: "none",
        candidate_movement_ids: [],
        target_amount: null,
        target_category_id: null,
        target_account_id: null,
        target_movement_type: null,
        related_person_name: null,
        reference_resolution: "no_candidate",
        confidence: 0.6,
        requires_confirmation: true,
        ambiguities: [],
        safe_explanation: "No encuentro a que movimiento te referis.",
        evidence_signals: [],
      },
      response_composition: {
        response_text: "¿A cual de todos te referis?",
        answer_kind: "clarification",
        confidence: 0.8,
        cited_facts: [],
        used_tools: [],
        follow_up_question: null,
        safety_flags: [],
        grounded_claims: [],
        composition_stage: "safe_clarification",
      },
      confidence: 0.8,
      safety_flags: [],
    },
    runtime: {
      provider: "executive-test",
      model_name: "executive",
      latency_ms: 5,
    },
    compilation: { accepted: true, issues: [], dropped_action_intents: [] },
    tool_calls: [],
    tool_results: [],
    safety: { policy_flags: [], redaction_applied: false },
  } as unknown as ConversationalExecutiveRunResult;

  const presentTurn = vi.fn(async (_plan: PlanTurnBlocksResult) =>
    fakePresentedTurn(),
  );

  const orchestrator = new FinancialOrchestrator(createGenericSupabaseClient(), {
    conversationalExecutiveMode: "active",
    conversationalExecutiveAgent: {
      run: vi.fn(async () => executiveResult),
    } as unknown as ConversationalExecutiveAgent,
    orchestrationPlanningAgent: {
      plan: vi.fn(async () => {
        throw new Error("el planner legado no corre con el ejecutivo activo");
      }),
    } as unknown as OrchestrationPlanningAgent,
    dataAgent: {
      extract: vi.fn(async () => {
        throw new Error("el data agent no corre con el ejecutivo activo");
      }),
    } as unknown as DataAgent,
    conversationAgent: {
      answer: vi.fn(async () => {
        throw new Error("el conversation agent no corre con el ejecutivo activo");
      }),
    } as unknown as ConversationAgent,
    presentTurn,
  });

  return { orchestrator, presentTurn };
}

function turnInput(text: string) {
  return {
    actor: "user" as const,
    text,
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "dashboard" as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("descarte sin borrador con el ejecutivo conversacional activo", () => {
  it("un plan de correccion ya no termina en la aclaracion sin salida", async () => {
    const { orchestrator } = buildOrchestrator("correction");

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: externalEventFixture.trace_id,
      turnInput: turnInput("ese ya no va"),
    });

    expect(result.reason).not.toBe("accepted_with_capture_draft_clarification");
  });

  it("un plan que no es de correccion sigue respondiendo la aclaracion", async () => {
    const { orchestrator } = buildOrchestrator("record");

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: externalEventFixture.trace_id,
      turnInput: turnInput("ese ya no va"),
    });

    expect(result.reason).toBe("accepted_with_capture_draft_clarification");
  });
});
