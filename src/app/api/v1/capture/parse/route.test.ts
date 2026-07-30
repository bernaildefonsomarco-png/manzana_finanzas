import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getActiveAccounts: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/accounts.repository", () => ({
  getActiveAccounts: mocks.getActiveAccounts,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/v1/capture/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", client: {} });
  mocks.getActiveAccounts.mockResolvedValue([]);
});

describe("POST /api/v1/capture/parse", () => {
  it("AC-CAP-02: 'taxi 15' se resuelve solo con reglas", async () => {
    const response = await POST(request({ line: "taxi 15" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.resolved_by).toBe("reglas");
    expect(body.data.fields.amount.value).toBe(15);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(request({ line: "taxi 15" }));

    expect(response.status).toBe(401);
  });

  it("AC-CAP-03: no escribe nada — no llama a ningun repositorio de escritura", async () => {
    await POST(request({ line: "taxi 15" }));

    expect(mocks.getActiveAccounts).toHaveBeenCalledTimes(1);
  });

  it("validacion: linea vacia devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request({ line: "" }));

    expect(response.status).toBe(400);
  });

  it("validacion: mas de 140 caracteres devuelve VALIDATION_ERROR", async () => {
    const response = await POST(request({ line: "a".repeat(141) }));

    expect(response.status).toBe(400);
  });

  it("idempotencia: no escribe nada, repetir la misma linea da el mismo resultado", async () => {
    const first = await POST(request({ line: "taxi 15" }));
    const second = await POST(request({ line: "taxi 15" }));

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.data).toEqual(secondBody.data);
  });
});
