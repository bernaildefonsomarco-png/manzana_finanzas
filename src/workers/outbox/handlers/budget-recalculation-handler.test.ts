import { describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "@/core/events/domain-events";
import { createBudgetRecalculationHandler } from "./budget-recalculation-handler";

const mocks = vi.hoisted(() => ({
  runBudgetDailyLifecycle: vi.fn(),
}));

vi.mock("@/data/repositories/budgets.repository", () => ({
  runBudgetDailyLifecycle: mocks.runBudgetDailyLifecycle,
}));

const event = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  event_type: "budget_recalculation_requested",
  aggregate_type: "user_budget",
  aggregate_id: "22222222-2222-4222-8222-222222222222",
  payload: { as_of: "2026-07-30" },
  payload_version: 1,
  status: "pending",
  attempt_count: 1,
  max_attempts: 8,
  next_attempt_at: "2026-07-30T17:00:00.000Z",
  processing_started_at: null,
  published_at: null,
  trace_id: "33333333-3333-4333-8333-333333333333",
  metadata: {},
  created_at: "2026-07-30T17:00:00.000Z",
  updated_at: "2026-07-30T17:00:00.000Z",
  last_error: null,
} satisfies OutboxEvent;

describe("budget recalculation outbox handler", () => {
  it("procesa por usuario fuera de la transacción del movimiento", async () => {
    const client = {} as never;
    const handler = createBudgetRecalculationHandler(client);
    expect(handler.canHandle(event)).toBe(true);
    await handler.handle(event);
    expect(mocks.runBudgetDailyLifecycle).toHaveBeenCalledWith(client, {
      userId: event.user_id,
      asOf: "2026-07-30",
    });
  });

  it("ignora otros eventos", () => {
    const handler = createBudgetRecalculationHandler({} as never);
    expect(
      handler.canHandle({ ...event, event_type: "movement_created" })
    ).toBe(false);
  });
});
