import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  confirmPendingItemWithCore: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/core/pending/confirm-pending", async (original) => ({
  ...(await original()),
  confirmPendingItemWithCore: mocks.confirmPendingItemWithCore,
}));

import { POST } from "./route";

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.confirmPendingItemWithCore.mockReset();
  mocks.getApiAuth.mockResolvedValue({
    userId: "11111111-1111-4111-8111-111111111111",
    client: {},
  });
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
        headers: { "content-type": "application/json" },
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pending_item_ids: [id, id] }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.confirmPendingItemWithCore).not.toHaveBeenCalled();
  });
});
