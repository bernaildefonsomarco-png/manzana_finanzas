// `AC-API-05`: confirmar un pendiente exige `Idempotency-Key`; el mecanismo
// de fondo (`confirmPendingItemWithCore`, ya idempotente por el propio
// `pending_item_id`) se refleja en `meta.idempotent_replay`.
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

const PENDING_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({
    userId: "11111111-1111-4111-8111-111111111111",
    client: {},
  });
});

function confirmRequest(headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/v1/pending/${PENDING_ID}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({}),
  });
}

function context() {
  return { params: Promise.resolve({ id: PENDING_ID }) };
}

describe("POST /api/v1/pending/[id]/confirm", () => {
  it("AC-API-05: exige Idempotency-Key", async () => {
    const response = await POST(confirmRequest(), context());
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.confirmPendingItemWithCore).not.toHaveBeenCalled();
  });

  it("confirma y devuelve 201 en la primera confirmacion", async () => {
    mocks.confirmPendingItemWithCore.mockResolvedValue({
      pendingItem: { id: PENDING_ID },
      movement: { id: "movement-1" },
      idempotent: false,
      autoResolvedDuplicate: false,
    });

    const response = await POST(
      confirmRequest({ "idempotency-key": "confirm-key-1" }),
      context()
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.meta.idempotent_replay).toBeUndefined();
  });

  it("AC-API-05: repetir la confirmacion devuelve 200 con idempotent_replay:true", async () => {
    mocks.confirmPendingItemWithCore.mockResolvedValue({
      pendingItem: { id: PENDING_ID },
      movement: { id: "movement-1" },
      idempotent: true,
      autoResolvedDuplicate: false,
    });

    const response = await POST(
      confirmRequest({ "idempotency-key": "confirm-key-1" }),
      context()
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.meta.idempotent_replay).toBe(true);
  });
});
