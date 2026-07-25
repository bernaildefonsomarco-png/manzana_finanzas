import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "@/core/events/domain-events";
import { createInsightLifecycleHandler } from "./insight-lifecycle-handler";

const mocks = vi.hoisted(() => ({
  evaluateAdvancedInsights: vi.fn(),
}));

vi.mock("@/data/repositories/insights.repository", () => ({
  evaluateAdvancedInsights: mocks.evaluateAdvancedInsights,
}));

const movementEvent = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  event_type: "movement_created",
  aggregate_type: "movement",
  aggregate_id: "33333333-3333-4333-8333-333333333333",
  payload: {},
  payload_version: 1,
  status: "pending",
  attempt_count: 1,
  max_attempts: 8,
  next_attempt_at: "2026-07-18T00:00:00.000Z",
  processing_started_at: null,
  published_at: null,
  trace_id: "44444444-4444-4444-8444-444444444444",
  metadata: {},
  created_at: "2026-07-18T00:00:00.000Z",
  updated_at: "2026-07-18T00:00:00.000Z",
  last_error: null,
} satisfies OutboxEvent;

describe("insight lifecycle outbox handler", () => {
  beforeEach(() => {
    mocks.evaluateAdvancedInsights.mockReset();
    mocks.evaluateAdvancedInsights.mockResolvedValue({});
  });

  it.each([
    "movement_created",
    "movement_updated",
    "movement_corrected",
    "movement_deleted",
    "movement_reversed",
  ])("reevalua descubrimientos ante %s", async (eventType) => {
    const client = {} as never;
    const handler = createInsightLifecycleHandler(client);
    const event = { ...movementEvent, event_type: eventType };

    expect(handler.canHandle(event)).toBe(true);
    await handler.handle(event);

    expect(mocks.evaluateAdvancedInsights).toHaveBeenCalledWith(
      client,
      event.user_id,
      { traceId: event.trace_id },
    );
  });

  it.each(["debt_payment_registered", "debt_paid"])(
    "reevalua descubrimientos ante %s",
    async (eventType) => {
      const client = {} as never;
      const handler = createInsightLifecycleHandler(client);
      const event = {
        ...movementEvent,
        event_type: eventType,
        aggregate_type: "debt",
      };

      expect(handler.canHandle(event)).toBe(true);
      await handler.handle(event);

      expect(mocks.evaluateAdvancedInsights).toHaveBeenCalledWith(
        client,
        event.user_id,
        { traceId: event.trace_id },
      );
    },
  );

  it.each(["recurring_payment_confirmed", "recurring_amount_changed"])(
    "reevalua descubrimientos ante %s",
    async (eventType) => {
      const client = {} as never;
      const handler = createInsightLifecycleHandler(client);
      const event = {
        ...movementEvent,
        event_type: eventType,
        aggregate_type: "recurring_rule",
      };

      expect(handler.canHandle(event)).toBe(true);
      await handler.handle(event);

      expect(mocks.evaluateAdvancedInsights).toHaveBeenCalledWith(
        client,
        event.user_id,
        { traceId: event.trace_id },
      );
    },
  );

  it("ignora eventos ajenos al historial financiero", () => {
    const handler = createInsightLifecycleHandler({} as never);

    expect(
      handler.canHandle({
        ...movementEvent,
        event_type: "pending_created",
        aggregate_type: "pending_item",
      }),
    ).toBe(false);
  });
});
