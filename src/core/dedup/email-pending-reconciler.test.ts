import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingItem } from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({
  listPendingItems: vi.fn(),
  markPendingAutoResolvedDuplicate: vi.fn(),
  evaluateCrossChannelDedup: vi.fn(),
}));

vi.mock("@/data/repositories/pending.repository", () => ({
  listPendingItems: mocks.listPendingItems,
  markPendingAutoResolvedDuplicate: mocks.markPendingAutoResolvedDuplicate,
}));

vi.mock("./cross-channel-preflight", () => ({
  evaluateCrossChannelDedup: mocks.evaluateCrossChannelDedup,
}));

import { reconcileEmailPendingAfterMovements } from "./email-pending-reconciler";

describe("reconcileEmailPendingAfterMovements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPendingItems.mockResolvedValue([pendingItem()]);
    mocks.markPendingAutoResolvedDuplicate.mockResolvedValue(pendingItem());
  });

  it("resuelve un pendiente email solo ante duplicado exacto", async () => {
    mocks.evaluateCrossChannelDedup.mockResolvedValue({
      decision: {
        status: "exact_duplicate",
        matched_reference_id: "movement-1",
      },
    });

    const result = await reconcileEmailPendingAfterMovements({
      client: {} as never,
      userId: "user-1",
      traceId: "trace-1",
      movements: [movement()],
    });

    expect(result).toEqual({
      evaluated: 1,
      auto_resolved: 1,
      pending_item_ids: ["pending-1"],
    });
    expect(mocks.evaluateCrossChannelDedup).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: "pending:pending-1",
        movementInput: expect.objectContaining({
          type: "gasto",
          amount: 20,
          source: "email_confirmed",
        }),
      }),
    );
    expect(mocks.markPendingAutoResolvedDuplicate).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "pending-1",
      "movement-1",
      "user-1",
      "trace-1",
    );
  });

  it("conserva el pendiente cuando la coincidencia requiere confirmacion", async () => {
    mocks.evaluateCrossChannelDedup.mockResolvedValue({
      decision: {
        status: "possible_duplicate",
        matched_reference_id: "movement-1",
      },
    });

    const result = await reconcileEmailPendingAfterMovements({
      client: {} as never,
      userId: "user-1",
      traceId: "trace-1",
      movements: [movement()],
    });

    expect(result.auto_resolved).toBe(0);
    expect(mocks.markPendingAutoResolvedDuplicate).not.toHaveBeenCalled();
  });

  it("ignora pendientes sin monto o fecha verificable", async () => {
    mocks.listPendingItems.mockResolvedValue([
      pendingItem({ normalized_summary: { title: "Sin datos suficientes" } }),
    ]);

    const result = await reconcileEmailPendingAfterMovements({
      client: {} as never,
      userId: "user-1",
      traceId: "trace-1",
      movements: [movement()],
    });

    expect(result.evaluated).toBe(0);
    expect(mocks.evaluateCrossChannelDedup).not.toHaveBeenCalled();
  });
});

function movement() {
  return {
    movement_id: "movement-1",
    movement_type: "gasto" as const,
    amount: 20,
    currency: "PEN" as const,
    occurred_at: "2026-07-19T10:00:00-05:00",
    description: "Desayuno",
    category_id: "alimentacion",
    account_origin_id: "account-1",
    account_destination_id: null,
  };
}

function pendingItem(
  overrides: Partial<PendingItem> = {},
): PendingItem {
  return {
    id: "pending-1",
    user_id: "user-1",
    source: "email_pending",
    type: "movement_confirmation",
    status: "pending",
    normalized_summary: {
      title: "Desayuno",
      amount: 20,
      currency: "PEN",
      occurred_at: "2026-07-19T10:02:00-05:00",
      category_id: "alimentacion",
    },
    proposed_action: {
      movement_type: "gasto",
      movement_input: { account_origin_id: "account-1" },
    },
    confidence: null,
    ambiguities: [],
    source_ref: "email-1",
    metadata: {},
    expires_at: null,
    resolved_at: null,
    resolved_by: null,
    created_at: "2026-07-19T10:03:00-05:00",
    updated_at: "2026-07-19T10:03:00-05:00",
    ...overrides,
  } as PendingItem;
}
