import { describe, expect, it } from "vitest";
import { analyzeConversationTurn } from "@/core/conversation/conversation-kernel";
import { buildSafePlanningContext } from "@/agents/orchestration-planning-agent/types";
import { composeLocalOrchestrationPlan } from "@/agents/orchestration-planning-agent/local-fixture-runtime";
import { CONVERSATION_EVAL_CORPUS_V1 } from "./conversation-eval-corpus.v1";

const ACTIVE_STATE = {
  last_query_kind: "movement_search" as const,
  last_query_date_range: {
    start: "2026-07-16T00:00:00.000-05:00",
    end: "2026-07-16T23:59:59.999-05:00",
    label: "hoy",
  },
  referenced_movements: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      type: "gasto",
      amount: 20,
      currency: "PEN" as const,
      description: "desayuno",
      category_id: "alimentacion",
      occurred_at: "2026-07-16T09:00:00.000-05:00",
    },
  ],
  referenced_entities: [],
  continuity_hint: "Hay un movimiento de desayuno como referencia activa.",
};

describe("conversation eval corpus v1", () => {
  it("contiene exactamente 200 casos versionados y sin duplicados", () => {
    expect(CONVERSATION_EVAL_CORPUS_V1).toHaveLength(200);
    expect(new Set(CONVERSATION_EVAL_CORPUS_V1.map((item) => item.id)).size).toBe(200);
    expect(new Set(CONVERSATION_EVAL_CORPUS_V1.map((item) => item.message)).size).toBe(200);
  });

  it("cubre las familias conversacionales y financieras obligatorias", () => {
    const families = new Set(CONVERSATION_EVAL_CORPUS_V1.map((item) => item.family));
    expect(families).toEqual(
      new Set([
        "capture_expense", "capture_income", "capture_multiple",
        "hypothetical_money", "movement_search", "movement_follow_up",
        "correction_delete", "correction_reclassify", "mixed_capture_query",
        "debt_query", "recurring_query", "pending_query", "memory_query",
        "reconstruction", "greeting", "help", "frustrated_repair",
        "ambiguous_transfer_or_loan", "historical_query", "topic_shift",
      ])
    );
  });

  it("mantiene los contratos de seguridad del baseline deterministico en los 200 casos", () => {
    const failures: string[] = [];
    let semanticMatches = 0;

    for (const testCase of CONVERSATION_EVAL_CORPUS_V1) {
      const analysis = analyzeConversationTurn({
        text: testCase.message,
        receivedAt: "2026-07-16T15:00:00.000Z",
        timezone: "America/Lima",
        activeState: testCase.has_active_movement_context ? ACTIVE_STATE : null,
      });
      const plan = composeLocalOrchestrationPlan(
        buildSafePlanningContext({
          userId: "eval-user",
          timezone: "America/Lima",
          channel: "whatsapp",
          originalMessage: testCase.message,
          receivedAt: "2026-07-16T15:00:00.000Z",
          query: analysis.query,
          turnState: analysis.turn_state,
        })
      );

      if (
        testCase.expected.acts.includes(analysis.turn_state.act) &&
        testCase.expected.query_kinds.includes(analysis.query.kind) &&
        testCase.expected.goals.includes(plan.goal) &&
        testCase.expected.workflows.includes(plan.workflow)
      ) semanticMatches += 1;

      const commandSteps = plan.steps.filter(
        (step) => step.capability === "command_dispatcher"
      );
      if (testCase.expected.financial_write_must_use_core && plan.goal !== "help") {
        if (plan.goal === "record" || plan.goal === "mixed") {
          if (commandSteps.length !== 1) failures.push(`${testCase.id}: Core no esta exactamente una vez`);
        }
      }
      if (testCase.expected.direct_write_forbidden) {
        for (const step of commandSteps) {
          if (step.kind !== "core_command") failures.push(`${testCase.id}: escritura fuera de Core`);
        }
      }
      if (plan.goal === "query" && commandSteps.length > 0) {
        failures.push(`${testCase.id}: consulta read-only alcanzo CommandDispatcher`);
      }
      if (plan.goal === "correction" && !plan.requires_confirmation) {
        failures.push(`${testCase.id}: correccion sin confirmacion`);
      }
      if (commandSteps.length > 0) {
        const commandIndex = plan.steps.findIndex(
          (step) => step.capability === "command_dispatcher"
        );
        const policyIndex = plan.steps.findIndex(
          (step) => step.capability === "policy_gate"
        );
        if (policyIndex < 0 || policyIndex >= commandIndex) {
          failures.push(`${testCase.id}: CommandDispatcher sin PolicyGate previo`);
        }
      }
      if (plan.steps.length === 0) failures.push(`${testCase.id}: plan silencioso`);
      if (!plan.steps.some((step) => step.capability === "response_agent" || step.capability === "conversation_agent")) {
        failures.push(`${testCase.id}: plan sin capacidad de respuesta`);
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
    expect(semanticMatches).toBeGreaterThan(0);
  });
});
