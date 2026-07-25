import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  markPendingDiscarded: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/pending.repository", async (original) => ({
  ...(await original()),
  markPendingDiscarded: mocks.markPendingDiscarded,
}));

import { POST } from "./route";

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.markPendingDiscarded.mockReset();
  mocks.getApiAuth.mockResolvedValue({
    userId: "11111111-1111-4111-8111-111111111111",
    client: {},
  });
  mocks.markPendingDiscarded.mockResolvedValue({ status: "discarded" });
});

describe("pending batch discard", () => {
  it("descarta solo los ids explicitos y conserva una razon trazable", async () => {
    const ids = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];
    const response = await POST(
      new Request("http://localhost/api/v1/pending/batch-discard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pending_item_ids: ids,
          reason: "dashboard_batch_discard",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      requested: 2,
      discarded: 2,
      failed: 0,
    });
    expect(mocks.markPendingDiscarded).toHaveBeenCalledTimes(2);
    expect(
      mocks.markPendingDiscarded.mock.calls.map((call) => call[2]),
    ).toEqual(ids);
  });

  it("rechaza ids repetidos antes de mutar", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const response = await POST(
      new Request("http://localhost/api/v1/pending/batch-discard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pending_item_ids: [id, id] }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.markPendingDiscarded).not.toHaveBeenCalled();
  });
});
