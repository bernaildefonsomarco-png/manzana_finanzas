// RUL-PEND-05/ACT-PEND-04 (AC-PEND-06): "ya lo registré" es distinto de
// "no era eso" y alimenta la deduplicación, no evidencia negativa.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  getPendingItemById: vi.fn(),
  markPendingAlreadyRegistered: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/pending.repository", async (original) => ({
  ...(await original()),
  getPendingItemById: mocks.getPendingItemById,
  markPendingAlreadyRegistered: mocks.markPendingAlreadyRegistered,
}));

import { POST } from "./route";
import { PendingRepositoryError } from "@/data/repositories/pending.repository";

const PENDING_ID = "22222222-2222-4222-8222-222222222222";
const MOVEMENT_ID = "33333333-3333-4333-8333-333333333333";

function request(body: unknown = {}) {
  return new Request(`http://localhost/api/v1/pending/${PENDING_ID}/already-registered`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context() {
  return { params: Promise.resolve({ id: PENDING_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", client: {} });
});

describe("POST /api/v1/pending/[id]/already-registered", () => {
  it("camino feliz: marca como ya registrado y enlaza el candidato detectado", async () => {
    mocks.getPendingItemById.mockResolvedValue({
      id: PENDING_ID,
      metadata: { dedup_matched_reference_id: MOVEMENT_ID },
    });
    mocks.markPendingAlreadyRegistered.mockResolvedValue({
      id: PENDING_ID,
      status: "already_registered",
    });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(mocks.markPendingAlreadyRegistered).toHaveBeenCalledWith(
      {},
      "11111111-1111-4111-8111-111111111111",
      PENDING_ID,
      "11111111-1111-4111-8111-111111111111",
      MOVEMENT_ID,
      expect.any(String)
    );
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(request(), context());

    expect(response.status).toBe(401);
  });

  it("pendiente de otro usuario: 404, nunca 403", async () => {
    mocks.getPendingItemById.mockResolvedValue(null);

    const response = await POST(request(), context());

    expect(response.status).toBe(404);
  });

  it("validacion: movement_id invalido devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request({ movement_id: "no-es-uuid" }), context());

    expect(response.status).toBe(400);
  });

  it("idempotencia: repetir sobre un pendiente ya resuelto devuelve CONFLICT, no un segundo enlace", async () => {
    mocks.getPendingItemById.mockResolvedValue({ id: PENDING_ID, metadata: {} });
    mocks.markPendingAlreadyRegistered.mockRejectedValue(
      new PendingRepositoryError("PENDING_ITEM_ALREADY_RESOLVED", "ya resuelto")
    );

    const response = await POST(request(), context());

    expect(response.status).toBe(409);
  });
});
