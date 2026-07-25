import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "@/core/events/domain-events";
import { createLearningEvidenceHandler } from "./learning-evidence-handler";

const mocks = vi.hoisted(() => ({
  getMovementById: vi.fn(),
  learnFromConfirmedCorrection: vi.fn(),
  learnFromConfirmedMovement: vi.fn(),
}));

vi.mock("@/data/repositories/movements.repository", () => ({
  SupabaseFinancialCoreRepository: class {
    getMovementById = mocks.getMovementById;
  },
}));
vi.mock("@/core/learning", () => ({
  LearningEngine: class {
    learnFromConfirmedCorrection = mocks.learnFromConfirmedCorrection;
    learnFromConfirmedMovement = mocks.learnFromConfirmedMovement;
  },
}));

const event = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  event_type: "movement_created",
  aggregate_type: "movement",
  aggregate_id: "33333333-3333-4333-8333-333333333333",
  payload: { command_id: "command-1" },
  payload_version: 1,
  status: "pending",
  attempt_count: 0,
  max_attempts: 6,
  next_attempt_at: "2026-07-24T00:00:00.000Z",
  processing_started_at: null,
  published_at: null,
  trace_id: "44444444-4444-4444-8444-444444444444",
  metadata: {},
  created_at: "2026-07-24T00:00:00.000Z",
  updated_at: "2026-07-24T00:00:00.000Z",
  last_error: null,
} satisfies OutboxEvent;

describe("learning evidence outbox handler", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("convierte movimiento Core confirmado en señal repetible", async () => {
    mocks.getMovementById.mockResolvedValue(movement());
    const handler = createLearningEvidenceHandler({} as never);
    await handler.handle(event);
    expect(mocks.learnFromConfirmedMovement).toHaveBeenCalledWith({
      userId: event.user_id,
      movement: expect.objectContaining({ id: event.aggregate_id }),
      traceId: event.trace_id,
    });
  });

  it("convierte correccion de categoria confirmada en evidencia fuerte", async () => {
    mocks.getMovementById.mockResolvedValue(
      movement({
        status: "corrected",
        metadata: {
          correction_target_type: "category",
          corrected_category_id: "alimentacion",
        },
      }),
    );
    const handler = createLearningEvidenceHandler({} as never);
    await handler.handle({ ...event, event_type: "movement_corrected" });
    expect(mocks.learnFromConfirmedCorrection).toHaveBeenCalledWith({
      userId: event.user_id,
      command: {
        kind: "category",
        command_id: "command-1",
        movement_id: event.aggregate_id,
        category_id: "alimentacion",
      },
      movement: expect.objectContaining({ status: "corrected" }),
      traceId: event.trace_id,
    });
  });
});

function movement(patch: Record<string, unknown> = {}) {
  return {
    id: event.aggregate_id,
    user_id: event.user_id,
    type: "gasto",
    amount: 20,
    currency: "PEN",
    description: "Desayuno",
    merchant: null,
    category_id: "alimentacion",
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    subcategory_id: null,
    idempotency_key: "movement-1",
    affects_total_balance: true,
    affects_account_balance: false,
    occurred_at: "2026-07-24T10:00:00.000Z",
    created_at: "2026-07-24T10:00:00.000Z",
    updated_at: "2026-07-24T10:00:00.000Z",
    status: "confirmed",
    source: "whatsapp",
    source_ref: "whatsapp:event-1",
    confidence: 1,
    requires_review: false,
    deleted_at: null,
    metadata: {},
    ...patch,
  };
}
