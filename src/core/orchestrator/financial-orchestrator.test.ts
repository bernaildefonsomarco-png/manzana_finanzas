import { describe, expect, it, vi } from "vitest";
import { buildSafePlanningContext } from "@/agents/orchestration-planning-agent/types";
import { composeLocalOrchestrationPlan } from "@/agents/orchestration-planning-agent/local-fixture-runtime";
import type { ConversationalExecutiveAgent } from "@/agents/conversational-executive-agent";
import type { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import type { DataAgent } from "@/agents/data-agent";
import type { ConversationAgent } from "@/agents/conversation-agent";
import type { PresentedTurn } from "@/core/channel/types";
import { FinancialOrchestrator } from "./financial-orchestrator";

const externalEventFixture = {
  id: "event-active-fallback-1",
  source: "dashboard" as const,
  event_type: "assistant_turn",
  idempotency_key: "idem-active-fallback-1",
  user_id: "00000000-0000-4000-8000-000000000001",
  received_at: "2026-07-24T10:00:00.000-05:00",
  status: "received" as const,
  payload_hash: "hash",
  payload_ref: null,
  trace_id: "trace-active-orchestrator",
  metadata: {},
  created_at: "2026-07-24T10:00:00.000-05:00",
  updated_at: "2026-07-24T10:00:00.000-05:00",
};

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => externalEventFixture),
  updateExternalEventStatus: vi.fn(async () => undefined),
}));

/**
 * Mock encadenable minimo del query builder de supabase-js: cualquier
 * metodo devuelve un builder encadenable y al final resuelve con una fila
 * vacia (o null para maybeSingle/single). No conocemos de antemano cada
 * cadena exacta que toca el motor completo (planTurn, ToolGateway, etc.),
 * asi que este stub generico evita acoplar el test a esas cadenas.
 */
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

describe("FinancialOrchestrator.handleTurn en modo active", () => {
  it("si el ConversationalExecutiveAgent falla, el turno cae al DataAgent legado y no lanza (Fix 1c ~767)", async () => {
    const planningContext = buildSafePlanningContext({
      userId: externalEventFixture.user_id,
      timezone: "America/Lima",
      channel: "dashboard",
      originalMessage: "cuanto gaste este mes",
      receivedAt: externalEventFixture.received_at,
      query: {
        kind: "movement_search",
        normalized_text: "cuanto gaste este mes",
        requested_amount: null,
        date_range: {
          start: "2026-07-01T00:00:00.000-05:00",
          end: "2026-07-24T10:00:00.000-05:00",
          label: "este mes",
        },
        movement_filters: null,
        confidence: 0.95,
      },
      turnState: {
        act: "financial_question",
        continuity: "new_topic",
        emotional_state: "neutral",
        experience_mode: "read_only_answer",
        should_use_active_memory: false,
        should_route_to_conversation_agent: true,
        should_ask_clarification_first: false,
        response_guidance: [],
        personalization_cues: [],
        risk_notes: [],
      },
    });
    const legacyPlan = composeLocalOrchestrationPlan(planningContext);

    const dataAgentExtract = vi.fn(async () => ({
      output: {
        intent: "conversation" as const,
        confidence: 0.9,
        result: [],
        ambiguities: [],
        requires_confirmation: false,
      },
      runtime: {
        provider: "legacy-data-agent-test",
        model_name: "test",
        latency_ms: 5,
      },
      safety: { policy_flags: [], redaction_applied: false },
    }));

    const executiveRun = vi.fn(async () => {
      throw new Error("executive timeout");
    });

    const legacyPlanningAgentPlan = vi.fn(async () => ({
      output: legacyPlan,
      runtime: {
        provider: "legacy-planner-test",
        model_name: "test",
        latency_ms: 5,
      },
      tool_calls: [],
      safety: { policy_flags: [], redaction_applied: false },
    }));

    const conversationAnswer = vi.fn(async () => ({
      output: {
        response_text: "Respuesta de prueba.",
        answer_kind: "clarification" as const,
        confidence: 0.9,
        cited_facts: [],
        used_tools: [],
        follow_up_question: null,
        safety_flags: [],
      },
      runtime: {
        provider: "legacy-conversation-agent-test",
        model_name: "test",
        latency_ms: 5,
      },
      tool_calls: [],
      safety: { policy_flags: [], redaction_applied: false },
    }));

    const presentTurn = vi.fn(async () => fakePresentedTurn());

    const orchestrator = new FinancialOrchestrator(createGenericSupabaseClient(), {
      conversationalExecutiveMode: "active",
      conversationalExecutiveAgent: {
        run: executiveRun,
      } as unknown as ConversationalExecutiveAgent,
      orchestrationPlanningAgent: {
        plan: legacyPlanningAgentPlan,
      } as unknown as OrchestrationPlanningAgent,
      dataAgent: { extract: dataAgentExtract } as unknown as DataAgent,
      conversationAgent: {
        answer: conversationAnswer,
      } as unknown as ConversationAgent,
      presentTurn,
    });

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-active-orchestrator",
      turnInput: {
        actor: "user",
        text: "cuanto gaste este mes",
        choice: null,
        confirmation: null,
        attachments: [],
        context: { where: null, filters: null, selected: null, visible: [] },
        channel: "dashboard",
      },
    });

    expect(executiveRun).toHaveBeenCalledTimes(1);
    expect(dataAgentExtract).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("accepted");
  });
});
