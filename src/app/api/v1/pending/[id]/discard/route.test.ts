// RUL-PEND-05/ACT-PEND-04 (AC-PEND-06): "no era eso" (discard) es distinta
// de "ya lo registré" y alimenta evidencia negativa, no deduplicación.
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
import { PendingRepositoryError } from "@/data/repositories/pending.repository";

const PENDING_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function request(body: unknown = {}) {
  return new Request(`http://localhost/api/v1/pending/${PENDING_ID}/discard`, {
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
  mocks.getApiAuth.mockResolvedValue({ userId: USER_ID, client: {} });
});

describe("POST /api/v1/pending/[id]/discard", () => {
  it("camino feliz: descarta con la razon dada", async () => {
    mocks.markPendingDiscarded.mockResolvedValue({
      id: PENDING_ID,
      status: "discarded",
    });

    const response = await POST(request({ reason: "no era mio" }), context());

    expect(response.status).toBe(200);
    expect(mocks.markPendingDiscarded).toHaveBeenCalledWith(
      {},
      USER_ID,
      PENDING_ID,
      "no era mio",
      USER_ID,
      expect.any(String)
    );
  });

  it("sin razon explicita, usa el valor por defecto", async () => {
    mocks.markPendingDiscarded.mockResolvedValue({ id: PENDING_ID, status: "discarded" });

    await POST(request({}), context());

    expect(mocks.markPendingDiscarded).toHaveBeenCalledWith(
      {},
      USER_ID,
      PENDING_ID,
      "user_discarded",
      USER_ID,
      expect.any(String)
    );
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(request(), context());

    expect(response.status).toBe(401);
  });

  it("pendiente de otro usuario: 404, nunca 403", async () => {
    mocks.markPendingDiscarded.mockRejectedValue(
      new PendingRepositoryError("PENDING_ITEM_NOT_FOUND", "no encontrado")
    );

    const response = await POST(request(), context());

    expect(response.status).toBe(404);
  });

  it("validacion: reason vacio devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request({ reason: "" }), context());

    expect(response.status).toBe(400);
  });

  it("idempotencia: repetir sobre un pendiente ya resuelto devuelve CONFLICT, no un segundo descarte", async () => {
    mocks.markPendingDiscarded.mockRejectedValue(
      new PendingRepositoryError("PENDING_ITEM_ALREADY_RESOLVED", "ya resuelto")
    );

    const response = await POST(request(), context());

    expect(response.status).toBe(409);
  });
});
