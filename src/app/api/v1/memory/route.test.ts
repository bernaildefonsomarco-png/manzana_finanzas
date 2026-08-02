import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listMemory: vi.fn(),
  forgetAllMemory: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/memory.repository", async (original) => ({
  ...(await original()),
  listMemory: mocks.listMemory,
  forgetAllMemory: mocks.forgetAllMemory,
}));

import { DELETE, GET } from "./route";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: { rls: true } });
  mocks.listMemory.mockResolvedValue({
    profile: [], classification: [], preference: [], inactive: [],
  });
  mocks.forgetAllMemory.mockResolvedValue({ deleted: { classification: 2 }, idempotent: false });
});

describe("GET /memory — cinco casos de 51 §6.2", () => {
  it("camino feliz agrupa las tres clases sin cache", async () => {
    const response = await GET(new Request("http://localhost/api/v1/memory?include_inactive=true"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/v1/memory"))).status).toBe(401);
  });

  it("aisla la colección por el usuario autenticado, sin filtro de otro usuario", async () => {
    await GET(new Request("http://localhost/api/v1/memory?scope=profile"));
    expect(mocks.listMemory).toHaveBeenCalledWith(
      { rls: true },
      expect.objectContaining({ userId: "user-1", scope: "profile" }),
    );
  });

  it("rechaza filtros desconocidos", async () => {
    const response = await GET(new Request("http://localhost/api/v1/memory?user_id=user-2"));
    expect(response.status).toBe(400);
    expect(mocks.listMemory).not.toHaveBeenCalled();
  });

  it("repetir la lectura mantiene la misma respuesta y no escribe", async () => {
    const first = await (await GET(new Request("http://localhost/api/v1/memory"))).json();
    const second = await (await GET(new Request("http://localhost/api/v1/memory"))).json();
    expect(second.data).toEqual(first.data);
    expect(mocks.forgetAllMemory).not.toHaveBeenCalled();
  });
});

describe("DELETE /memory — cinco casos de 51 §6.2", () => {
  const request = (confirmation = "OLVIDAR", key = "forget-all-1") =>
    new Request("http://localhost/api/v1/memory", {
      method: "DELETE",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify({ confirmation }),
    });

  it("olvida todo solo con la palabra explícita", async () => {
    expect((await DELETE(request())).status).toBe(200);
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await DELETE(request())).status).toBe(401);
  });

  it("opera únicamente sobre el usuario autenticado", async () => {
    await DELETE(request());
    expect(mocks.forgetAllMemory).toHaveBeenCalledWith(
      { rls: true },
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("rechaza confirmación distinta y falta de Idempotency-Key", async () => {
    expect((await DELETE(request("olvidar"))).status).toBe(400);
    expect((await DELETE(request("OLVIDAR", ""))).status).toBe(400);
  });

  it("marca el replay idempotente", async () => {
    mocks.forgetAllMemory.mockResolvedValue({ deleted: { classification: 2 }, idempotent: true });
    const payload = await (await DELETE(request())).json();
    expect(payload.meta.idempotent_replay).toBe(true);
  });
});
