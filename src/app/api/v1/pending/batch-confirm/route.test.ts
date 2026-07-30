import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  confirmPendingItemWithCore: vi.fn(),
  getPendingItemById: vi.fn(),
  markPendingBatchConfirmId: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/core/pending/confirm-pending", async (original) => ({
  ...(await original()),
  confirmPendingItemWithCore: mocks.confirmPendingItemWithCore,
}));
vi.mock("@/data/repositories/pending.repository", async (original) => ({
  ...(await original()),
  getPendingItemById: mocks.getPendingItemById,
  markPendingBatchConfirmId: mocks.markPendingBatchConfirmId,
}));

import { POST } from "./route";

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.confirmPendingItemWithCore.mockReset();
  mocks.getPendingItemById.mockReset();
  mocks.markPendingBatchConfirmId.mockReset();
  mocks.getApiAuth.mockResolvedValue({
    userId: "11111111-1111-4111-8111-111111111111",
    client: {},
  });
  mocks.getPendingItemById.mockImplementation(async (_client, _userId, id: string) => ({
    id,
    status: "pending",
    risk_level: "low",
    confirmable: true,
  }));
  mocks.confirmPendingItemWithCore.mockImplementation(async (input) => ({
    pendingItem: { id: input.pendingItemId },
    movement: { id: `movement-${input.pendingItemId}` },
    idempotent: false,
    autoResolvedDuplicate: false,
  }));
});

describe("pending batch confirm", () => {
  it("solo confirma los ids explicitos del lote visible", async () => {
    const ids = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];
    const response = await POST(
      new Request("http://localhost/api/v1/pending/batch-confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "test-batch-confirm-key",
        },
        body: JSON.stringify({ pending_item_ids: ids }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toMatchObject({
      requested: 2,
      confirmed: 2,
      failed: 0,
    });
    expect(mocks.confirmPendingItemWithCore).toHaveBeenCalledTimes(2);
    expect(
      mocks.confirmPendingItemWithCore.mock.calls.map(
        (call) => call[0].pendingItemId,
      ),
    ).toEqual(ids);
  });

  it("rechaza lotes con ids repetidos", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const response = await POST(
      new Request("http://localhost/api/v1/pending/batch-confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "test-batch-confirm-key",
        },
        body: JSON.stringify({ pending_item_ids: [id, id] }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.confirmPendingItemWithCore).not.toHaveBeenCalled();
  });

  it("AC-API-05: exige Idempotency-Key", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/pending/batch-confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pending_item_ids: ["22222222-2222-4222-8222-222222222222"],
        }),
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.confirmPendingItemWithCore).not.toHaveBeenCalled();
  });

  it("RUL-PEND-11/AC-PEND-08: excluye automaticamente el riesgo alto sin intentar confirmarlo", async () => {
    const lowRiskId = "22222222-2222-4222-8222-222222222222";
    const highRiskId = "33333333-3333-4333-8333-333333333333";
    mocks.getPendingItemById.mockImplementation(async (_c, _u, id: string) => ({
      id,
      status: "pending",
      risk_level: id === highRiskId ? "high" : "low",
      confirmable: true,
    }));

    const response = await POST(
      new Request("http://localhost/api/v1/pending/batch-confirm", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "batch-confirm-key-1" },
        body: JSON.stringify({ pending_item_ids: [lowRiskId, highRiskId] }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.confirmed).toBe(1);
    expect(body.data.excluded).toBe(1);
    expect(mocks.confirmPendingItemWithCore).toHaveBeenCalledTimes(1);
    expect(mocks.confirmPendingItemWithCore).toHaveBeenCalledWith(
      expect.objectContaining({ pendingItemId: lowRiskId }),
    );
  });

  it("RUL-PEND-07: preview:true cuenta y excluye sin confirmar nada ni exigir Idempotency-Key", async () => {
    const lowRiskId = "22222222-2222-4222-8222-222222222222";
    const highRiskId = "33333333-3333-4333-8333-333333333333";
    mocks.getPendingItemById.mockImplementation(async (_c, _u, id: string) => ({
      id,
      status: "pending",
      risk_level: id === highRiskId ? "high" : "low",
      confirmable: true,
    }));

    const response = await POST(
      new Request("http://localhost/api/v1/pending/batch-confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pending_item_ids: [lowRiskId, highRiskId], preview: true }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.would_confirm).toBe(1);
    expect(body.data.excluded).toEqual([{ pending_item_id: highRiskId, reason: "high_risk" }]);
    expect(mocks.confirmPendingItemWithCore).not.toHaveBeenCalled();
  });
});
