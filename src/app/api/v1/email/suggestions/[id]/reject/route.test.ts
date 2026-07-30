import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  resolveSenderSuggestion: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/data/repositories/email.repository", () => ({
  resolveSenderSuggestion: mocks.resolveSenderSuggestion,
}));

import { POST } from "./route";

const SUGGESTION_ID = "22222222-2222-4222-8222-222222222222";

function request() {
  return new Request(`http://localhost/api/v1/email/suggestions/${SUGGESTION_ID}/reject`, { method: "POST" });
}
function context() {
  return { params: Promise.resolve({ id: SUGGESTION_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", client: {} });
});

describe("POST /api/v1/email/suggestions/[id]/reject", () => {
  it("camino feliz: rechaza la sugerencia", async () => {
    mocks.resolveSenderSuggestion.mockResolvedValue({ id: SUGGESTION_ID, status: "rejected" });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(request(), context());

    expect(response.status).toBe(401);
  });

  it("sugerencia de otro usuario o inexistente: 404, nunca 403", async () => {
    mocks.resolveSenderSuggestion.mockResolvedValue(null);

    const response = await POST(request(), context());

    expect(response.status).toBe(404);
  });

  it("validacion: id invalido devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: "no-es-uuid" }) });

    expect(response.status).toBe(400);
  });

  it("idempotencia: rechazar dos veces la segunda devuelve 404, no un doble efecto", async () => {
    mocks.resolveSenderSuggestion
      .mockResolvedValueOnce({ id: SUGGESTION_ID, status: "rejected" })
      .mockResolvedValueOnce(null);

    const first = await POST(request(), context());
    const second = await POST(request(), context());

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
  });
});
