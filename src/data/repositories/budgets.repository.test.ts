import { describe, expect, it, vi } from "vitest";
import {
  commitBudgetOperation,
  commitGoalOperation,
  listBudgetsWithProgress,
  resolveBudgetSuggestion,
} from "./budgets.repository";

describe("listBudgetsWithProgress", () => {
  it("AC-PRES-10/15: calcula todos con una sola lectura de movimientos y conserva referencias", async () => {
    const budgets = [
      budgetRow("b1", "alimentacion", 400),
      budgetRow("b2", "transporte", 200),
      budgetRow("b3", null, 900),
    ];
    const movements = [
      movementRow("m1", "alimentacion", 318.5),
      movementRow("m2", "transporte", 50),
    ];
    const from = vi.fn((table: string) =>
      thenableQuery(table === "budgets" ? budgets : movements)
    );

    const result = await listBudgetsWithProgress(
      { from } as never,
      "user-1",
      {
        date: "2026-07-20",
        periodKind: "mensual",
      }
    );

    expect(result).toHaveLength(3);
    expect(result.find((budget) => budget.id === "b1")).toMatchObject({
      spent: 318.5,
      remaining: 81.5,
      band: "atencion",
      movement_ids: ["m1"],
    });
    expect(result.find((budget) => budget.id === "b3")?.movement_ids).toEqual([
      "m1",
      "m2",
    ]);
    expect(
      from.mock.calls.filter(([table]) => table === "movements")
    ).toHaveLength(1);
  });

  it.each([
    ["BUDGET_CATEGORY_NOT_FOUND", "BUDGET_NOT_FOUND"],
    ["BUDGET_PREVIOUS_PERIOD_NOT_FOUND", "BUDGET_NOT_FOUND"],
    ["BUDGET_SUGGESTION_NOT_FOUND", "BUDGET_NOT_FOUND"],
    ["BUDGET_STATE_CONFLICT", "BUDGET_CONFLICT"],
    ["BUDGET_SUGGESTION_ALREADY_RESOLVED", "BUDGET_CONFLICT"],
  ] as const)(
    "normaliza %s para que la API no responda 500",
    async (rpcMessage, expectedCode) => {
      const client = rpcFailure(rpcMessage);
      const operation =
        rpcMessage === "BUDGET_SUGGESTION_NOT_FOUND" ||
        rpcMessage === "BUDGET_SUGGESTION_ALREADY_RESOLVED"
          ? resolveBudgetSuggestion(client as never, "user-1", {
              suggestionKey: "suggestion-key-123456",
              resolution: "dismissed",
              payload: {},
              idempotencyKey: "idem-key-123456",
              traceId: "trace-1",
            })
          : commitBudgetOperation(client as never, "user-1", {
              operation: "create",
              budgetId: null,
              payload: {},
              idempotencyKey: "idem-key-123456",
              traceId: "trace-1",
            });

      await expect(operation).rejects.toMatchObject({ code: expectedCode });
    },
  );

  it("normaliza GOAL_STATE_CONFLICT para que la API responda conflicto", async () => {
    const client = rpcFailure("GOAL_STATE_CONFLICT");
    await expect(
      commitGoalOperation(client as never, "user-1", {
        operation: "pause",
        goalId: "goal-1",
        payload: {},
        idempotencyKey: "idem-key-123456",
        traceId: "trace-1",
      }),
    ).rejects.toMatchObject({ code: "GOAL_CONFLICT" });
  });
});

function budgetRow(
  id: string,
  categoryId: "alimentacion" | "transporte" | null,
  amount: number
) {
  return {
    id,
    user_id: "user-1",
    category_id: categoryId,
    currency: "PEN",
    period_kind: "mensual",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    base_amount: amount,
    rollover_amount: 0,
    amount,
    kind: "presupuesto",
    rollover: false,
    auto_renew: true,
    alerted_thresholds: [],
    source: "manual",
    status: "activo",
    created_at: "2026-07-01T05:00:00.000Z",
    updated_at: "2026-07-01T05:00:00.000Z",
    deleted_at: null,
    metadata: {},
    categories: categoryId ? { id: categoryId, label: categoryId } : null,
  };
}

function movementRow(
  id: string,
  categoryId: "alimentacion" | "transporte",
  amount: number
) {
  return {
    id,
    user_id: "user-1",
    type: "gasto",
    status: "confirmed",
    amount,
    currency: "PEN",
    occurred_at: "2026-07-15T17:00:00.000Z",
    description: null,
    merchant: null,
    category_id: categoryId,
    subcategory_id: null,
    source: "dashboard_manual",
    source_ref: null,
    idempotency_key: `key-${id}`,
    confidence: null,
    requires_review: false,
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    related_person_id: null,
    affects_total_balance: true,
    affects_account_balance: true,
    created_at: "2026-07-15T17:00:00.000Z",
    updated_at: "2026-07-15T17:00:00.000Z",
    deleted_at: null,
    metadata: {},
  };
}

function thenableQuery(data: unknown[]) {
  const result = { data, error: null };
  const query: Record<string, unknown> & PromiseLike<typeof result> = {
    then(onfulfilled, onrejected) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };
  for (const method of [
    "select",
    "eq",
    "is",
    "order",
    "in",
    "lte",
    "gte",
    "lt",
    "or",
    "limit",
  ]) {
    query[method] = vi.fn(() => query);
  }
  return query;
}

function rpcFailure(message: string) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: { message, details: null, code: "P0001" },
    }),
  };
}
