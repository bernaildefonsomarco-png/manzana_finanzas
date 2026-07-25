import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "@/core/events/domain-events";
import { createOnboardingActivationHandler } from "./onboarding-activation-handler";

const mocks = vi.hoisted(() => ({
  recordInitialOnboardingValue: vi.fn(),
}));

vi.mock("@/core/onboarding/onboarding-activation", () => ({
  recordInitialOnboardingValue: mocks.recordInitialOnboardingValue,
}));

const event = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  event_type: "movement_created",
  aggregate_type: "movement",
  aggregate_id: "33333333-3333-4333-8333-333333333333",
  payload: {},
  payload_version: 1,
  status: "pending",
  attempt_count: 0,
  max_attempts: 6,
  next_attempt_at: "2026-07-22T00:00:00.000Z",
  processing_started_at: null,
  published_at: null,
  trace_id: "44444444-4444-4444-8444-444444444444",
  metadata: {},
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
  last_error: null,
} satisfies OutboxEvent;

describe("onboarding activation outbox handler", () => {
  beforeEach(() => {
    mocks.recordInitialOnboardingValue.mockReset();
    mocks.recordInitialOnboardingValue.mockResolvedValue({ changed: true });
  });

  it.each([
    ["movement_created", "movement", "movement_confirmed"],
    ["pending_confirmed", "pending_item", "pending_confirmed"],
  ])("consume %s de forma idempotente", async (eventType, aggregateType, trigger) => {
    const client = {} as never;
    const handler = createOnboardingActivationHandler(client);
    const current = {
      ...event,
      event_type: eventType,
      aggregate_type: aggregateType,
    };

    expect(handler.canHandle(current)).toBe(true);
    await handler.handle(current);

    expect(mocks.recordInitialOnboardingValue).toHaveBeenCalledWith(client, {
      userId: event.user_id,
      trigger,
      source: "transactional_outbox",
      traceId: event.trace_id,
    });
  });

  it("ignora updates que no representan primer valor", () => {
    const handler = createOnboardingActivationHandler({} as never);

    expect(
      handler.canHandle({ ...event, event_type: "movement_updated" })
    ).toBe(false);
  });
});
