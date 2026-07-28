import { describe, expect, it } from "vitest";
import { DedupSignalAgent } from "@/agents/dedup-signal-agent";
import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime";
import type { DedupComparableMovement } from "@/core/dedup";
import { planDataAgentFinancialActions } from "./data-action-policy";
import {
  applyDedupPreflight,
  calculateRecentAmountMedian,
} from "./financial-action-preflight";

const userId = "00000000-0000-4000-8000-000000000001";

describe("financial action preflight", () => {
  it("bloquea un duplicado exacto entre canales sin crear otro movimiento", async () => {
    const plan = readyPlan();
    const result = await applyDedupPreflight({
      client: clientWithoutPersistenceErrors(),
      agent: new DedupSignalAgent(new DifferentTransactionRuntime()),
      plan,
      recentMovements: [movement({
        reference_id: "movement-email-1",
        source: "email_confirmed",
        source_ref: "email-1",
        occurred_at: "2026-07-18T10:02:00-05:00",
      })],
      userId,
      traceId: "00000000-0000-4000-8000-0000000000aa",
    });

    expect(result.plan.kind).toBe("blocked");
    expect(result.plan.actions[0].decision).toBe("blocked");
    expect(result.plan.actions[0].movement_input).toBeNull();
    expect(result.decisions[0].decision.status).toBe("exact_duplicate");
  });

  it("mantiene listo un movimiento sin evidencia de duplicado", async () => {
    const result = await applyDedupPreflight({
      client: clientWithoutPersistenceErrors(),
      agent: new DedupSignalAgent(new DifferentTransactionRuntime()),
      plan: readyPlan(),
      recentMovements: [movement({
        reference_id: "movement-old",
        amount: 70,
        description: "mercado",
        merchant: "Mercado",
        occurred_at: "2026-07-10T10:00:00-05:00",
      })],
      userId,
      traceId: "00000000-0000-4000-8000-0000000000bb",
    });

    expect(result.plan.kind).toBe("ready_for_core");
    expect(result.decisions[0].decision.status).toBe("distinct");
    expect(result.semantic_agent_runs).toBe(0);
  });

  it("persiste la referencia unica del evento y no el action_id reutilizable", async () => {
    const persisted: Array<Record<string, unknown>> = [];
    const client = {
      from: () => ({
        upsert: async (value: Record<string, unknown>) => {
          persisted.push(value);
          return { error: null };
        },
      }),
    } as never;

    await applyDedupPreflight({
      client,
      agent: new DedupSignalAgent(new DifferentTransactionRuntime()),
      plan: readyPlan(),
      recentMovements: [],
      userId,
      traceId: "00000000-0000-4000-8000-0000000000bc",
    });

    expect(persisted[0]?.incoming_reference_id).toBe(
      "whatsapp:event-1:action-1",
    );
  });

  it("calcula una mediana estable para evaluar montos inusuales", () => {
    expect(calculateRecentAmountMedian([
      movement({ reference_id: "a", amount: 10 }),
      movement({ reference_id: "b", amount: 30 }),
      movement({ reference_id: "c", amount: 20 }),
      movement({ reference_id: "d", amount: 40 }),
    ])).toBe(25);
  });
});

function readyPlan() {
  return planDataAgentFinancialActions({
    dataAgentOutput: {
      intent: "record_movement",
      confidence: 0.99,
      result: [{
        action_id: "action-1",
        movement_type: "gasto",
        amount: 20,
        currency: "PEN",
        occurred_at: "2026-07-18T10:00:00-05:00",
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
        source_evidence: [],
        confidence: 0.99,
      }],
      ambiguities: [],
      requires_confirmation: false,
      evidence_signals: [],
      safe_explanation: "Gasto claro.",
    },
    accounts: [],
    categories: [{ id: "alimentacion", is_sensitive: false }],
    sourceRef: "whatsapp:event-1",
    receivedAt: "2026-07-18T10:00:00-05:00",
    channel: "whatsapp",
  });
}

function movement(
  overrides: Partial<DedupComparableMovement> = {},
): DedupComparableMovement {
  return {
    reference_id: "movement-1",
    movement_type: "gasto",
    amount: 20,
    currency: "PEN",
    occurred_at: "2026-07-18T10:00:00-05:00",
    description: "desayuno",
    merchant: "desayuno",
    source: "whatsapp",
    source_ref: "wamid-1",
    ...overrides,
  };
}

function clientWithoutPersistenceErrors() {
  return {
    from: () => ({
      upsert: async () => ({ error: null }),
    }),
  } as never;
}

class DifferentTransactionRuntime implements AgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context = request.context_pack as {
      candidates: Array<{ reference_id: string }>;
    };
    return {
      output: {
        assessments: context.candidates.map((candidate) => ({
          candidate_reference_id: candidate.reference_id,
          relation: "different",
          confidence: 0.99,
          evidence_signals: ["semantic_difference"],
          safe_explanation: "Parece una operacion distinta.",
        })),
        confidence: 0.99,
        safe_explanation: "Comparacion completada.",
      } as TOutput,
      confidence: 0.99,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "test",
        latency_ms: 1,
      },
      safety: { policy_flags: [], redaction_applied: false },
    };
  }
}
