import { describe, expect, it } from "vitest";

import type { ConversationalExecutiveAgent } from "@/agents/conversational-executive-agent";
import type {
  ConversationalExecutiveContextPack,
  ConversationalExecutiveRunResult,
} from "@/agents/conversational-executive-agent";
import type { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import {
  buildSafePlanningContext,
  type OrchestrationPlanningResult,
} from "@/agents/orchestration-planning-agent";
import { composeLocalOrchestrationPlan } from "@/agents/orchestration-planning-agent/local-fixture-runtime";
import { TurnCoordinator } from "./turn-coordinator";

describe("TurnCoordinator", () => {
  it("usa una sola autoridad semantica y no llama al planner legado en active", async () => {
    const fixture = coordinatorFixture();
    const result = await fixture.coordinator.coordinate({
      mode: "active",
      executiveContext: fixture.context,
      traceId: "trace-active",
      workingSet: null,
      executeReadOnlyTool: async () => {
        throw new Error("no aplica");
      },
    });

    expect(fixture.calls()).toEqual({ executive: 1, legacy: 0 });
    expect(result.executive?.mode).toBe("active");
    expect(result.executive?.divergences).toEqual([]);
    expect(result.compiled.route).toBe("conversation_agent");
  });

  it("ejecuta executive y planner sin dar autoridad al shadow", async () => {
    const fixture = coordinatorFixture();
    const result = await fixture.coordinator.coordinate({
      mode: "shadow",
      executiveContext: fixture.context,
      traceId: "trace-shadow",
      workingSet: null,
      executeReadOnlyTool: async () => {
        throw new Error("no aplica");
      },
    });

    expect(fixture.calls()).toEqual({ executive: 1, legacy: 1 });
    expect(result.result.runtime.provider).toBe("legacy-test");
    expect(result.executive?.mode).toBe("shadow");
    expect(result.executive?.divergences).toEqual([]);
  });

  it("en active, si el executive falla, cae al planner legado en vez de lanzar", async () => {
    const fixture = coordinatorFixture({ executiveShouldThrow: true });
    const result = await fixture.coordinator.coordinate({
      mode: "active",
      executiveContext: fixture.context,
      traceId: "trace-active-degraded",
      workingSet: null,
      executeReadOnlyTool: async () => {
        throw new Error("no aplica");
      },
    });

    expect(fixture.calls()).toEqual({ executive: 1, legacy: 1 });
    expect(result.result.runtime.provider).toBe("legacy-test");
    expect(result.executive).toBeNull();
  });
});

function coordinatorFixture(options?: { executiveShouldThrow?: boolean }) {
  const planningContext = buildSafePlanningContext({
    userId: "00000000-0000-4000-8000-000000000001",
    timezone: "America/Lima",
    channel: "whatsapp",
    originalMessage: "cuanto gaste este mes",
    receivedAt: "2026-07-24T10:00:00.000-05:00",
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
  const plan = composeLocalOrchestrationPlan(planningContext);
  let executiveCalls = 0;
  let legacyCalls = 0;
  const executiveResult = {
    output: {
      orchestration_plan: plan,
    },
    runtime: {
      provider: "executive-test",
      model_name: "executive",
      latency_ms: 10,
    },
    tool_calls: [],
    tool_results: [],
    safety: {
      policy_flags: ["single_semantic_turn_authority"],
      redaction_applied: false,
    },
  } as unknown as ConversationalExecutiveRunResult;
  const legacyResult = {
    output: plan,
    runtime: {
      provider: "legacy-test",
      model_name: "legacy",
      latency_ms: 10,
    },
    tool_calls: [],
    safety: {
      policy_flags: [],
      redaction_applied: false,
    },
  } satisfies OrchestrationPlanningResult;
  const executiveAgent = {
    async run() {
      executiveCalls += 1;
      if (options?.executiveShouldThrow) {
        throw new Error("executive timeout");
      }
      return executiveResult;
    },
  } as unknown as ConversationalExecutiveAgent;
  const legacyPlanningAgent = {
    async plan() {
      legacyCalls += 1;
      return legacyResult;
    },
  } as unknown as OrchestrationPlanningAgent;
  const context = {
    context_pack_type: "conversational_executive_context",
    version: "v1",
    planning_context: planningContext,
  } as unknown as ConversationalExecutiveContextPack;

  return {
    context,
    coordinator: new TurnCoordinator({
      executiveAgent,
      legacyPlanningAgent,
    }),
    calls: () => ({ executive: executiveCalls, legacy: legacyCalls }),
  };
}
