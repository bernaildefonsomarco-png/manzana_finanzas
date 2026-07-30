// RUL-EMAIL-11/ACT-PEND-09: aportar contexto libre al confirmar un
// pendiente de correo, maximo 280 caracteres.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  addPendingContext: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/pending.repository", async (original) => ({
  ...(await original()),
  addPendingContext: mocks.addPendingContext,
}));

import { POST } from "./route";
import { PendingRepositoryError } from "@/data/repositories/pending.repository";

const PENDING_ID = "22222222-2222-4222-8222-222222222222";

function request(body: unknown) {
  return new Request(`http://localhost/api/v1/pending/${PENDING_ID}/context`, {
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

describe("POST /api/v1/pending/[id]/context", () => {
  it("camino feliz: guarda el contexto aportado", async () => {
    mocks.addPendingContext.mockResolvedValue({ id: PENDING_ID, metadata: { user_context: "es del alquiler" } });

    const response = await POST(request({ context: "es del alquiler" }), context());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.pending_item.metadata.user_context).toBe("es del alquiler");
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(request({ context: "algo" }), context());

    expect(response.status).toBe(401);
  });

  it("pendiente de otro usuario: 404, nunca 403", async () => {
    mocks.addPendingContext.mockRejectedValue(
      new PendingRepositoryError("PENDING_ITEM_NOT_FOUND", "no encontrado")
    );

    const response = await POST(request({ context: "algo" }), context());

    expect(response.status).toBe(404);
  });

  it("validacion: mas de 280 caracteres devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request({ context: "a".repeat(281) }), context());

    expect(response.status).toBe(400);
  });

  it("idempotencia: aportar contexto dos veces sobrescribe, no duplica", async () => {
    mocks.addPendingContext.mockResolvedValue({ id: PENDING_ID, metadata: { user_context: "version final" } });

    const first = await POST(request({ context: "version inicial" }), context());
    const second = await POST(request({ context: "version final" }), context());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.addPendingContext).toHaveBeenCalledTimes(2);
    const secondBody = await second.json();
    expect(secondBody.data.pending_item.metadata.user_context).toBe("version final");
  });
});
