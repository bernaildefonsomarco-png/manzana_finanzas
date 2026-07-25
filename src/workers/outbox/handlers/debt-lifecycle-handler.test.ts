import { describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "@/core/events/domain-events";
import { createDebtLifecycleHandler } from "./debt-lifecycle-handler";

const mocks = vi.hoisted(() => ({
  refreshDebtLifecycle: vi.fn(),
}));

vi.mock("@/core/debts/debt-lifecycle-service", () => ({
  refreshDebtLifecycle: mocks.refreshDebtLifecycle,
}));

const paymentEvent = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  event_type: "debt_payment_registered",
  aggregate_type: "debt",
  aggregate_id: "33333333-3333-4333-8333-333333333333",
  payload: {},
  payload_version: 1,
  status: "pending",
  attempt_count: 1,
  max_attempts: 8,
  next_attempt_at: "2026-07-01T00:00:00.000Z",
  processing_started_at: null,
  published_at: null,
  trace_id: "44444444-4444-4444-8444-444444444444",
  metadata: {},
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  last_error: null,
} satisfies OutboxEvent;

describe("debt lifecycle outbox handler", () => {
  it("consume pagos de deuda y ejecuta una reevaluacion idempotente", async () => {
    const client = {} as never;
    const handler = createDebtLifecycleHandler(client);

    expect(handler.canHandle(paymentEvent)).toBe(true);
    await handler.handle(paymentEvent);

    expect(mocks.refreshDebtLifecycle).toHaveBeenCalledWith(
      client,
      paymentEvent.user_id,
      { traceId: paymentEvent.trace_id }
    );
  });

  it("ignora eventos que no cambian el ciclo de una deuda", () => {
    const handler = createDebtLifecycleHandler({} as never);

    expect(
      handler.canHandle({
        ...paymentEvent,
        event_type: "debt_installment_due_soon",
        aggregate_type: "debt_installment",
      })
    ).toBe(false);
  });
});
