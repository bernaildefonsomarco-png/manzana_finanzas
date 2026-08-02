import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(),
  getHomeHiddenBlocks: vi.fn(),
  setHomeBlockHidden: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/data/repositories/home.repository", () => ({
  getHomeHiddenBlocks: mocks.getHomeHiddenBlocks,
  setHomeBlockHidden: mocks.setHomeBlockHidden,
}));

import { GET, PATCH } from "./route";

const auth = { userId: "user-1", client: { rls: true } };

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue(auth);
  mocks.createServiceClient.mockReturnValue({ service: true });
  mocks.getHomeHiddenBlocks.mockResolvedValue([]);
  mocks.setHomeBlockHidden.mockResolvedValue(["movements"]);
});

function patchRequest(body: unknown, headers: Record<string, string> = { "content-type": "application/json", "idempotency-key": "home-prefs-1" }) {
  return new Request("http://localhost/api/v1/home/preferences", { method: "PATCH", headers, body: JSON.stringify(body) });
}

describe("GET /home/preferences", () => {
  it("lee los bloques ocultos del usuario autenticado", async () => {
    mocks.getHomeHiddenBlocks.mockResolvedValue(["insight"]);
    const res = await GET(new Request("http://localhost/api/v1/home/preferences"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.hidden_blocks).toEqual(["insight"]);
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/v1/home/preferences"));
    expect(res.status).toBe(401);
  });
});

describe("PATCH /home/preferences — cinco casos", () => {
  it("oculta un bloque válido", async () => {
    const res = await PATCH(patchRequest({ block: "movements", hidden: true }));
    expect(res.status).toBe(200);
    expect(mocks.setHomeBlockHidden).toHaveBeenCalledWith({ service: true }, "user-1", "movements", true);
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ block: "movements", hidden: true }));
    expect(res.status).toBe(401);
  });

  it("un bloque desconocido es 400, nunca se llega a escribir", async () => {
    const res = await PATCH(patchRequest({ block: "no_existe", hidden: true }));
    expect(res.status).toBe(400);
    expect(mocks.setHomeBlockHidden).not.toHaveBeenCalled();
  });

  it("sin Idempotency-Key, 400", async () => {
    const res = await PATCH(patchRequest({ block: "movements", hidden: true }, { "content-type": "application/json" }));
    expect(res.status).toBe(400);
    expect(mocks.setHomeBlockHidden).not.toHaveBeenCalled();
  });

  it("aplicar el mismo cambio dos veces es idempotente (el repositorio ya lo garantiza)", async () => {
    const first = await PATCH(patchRequest({ block: "movements", hidden: true }));
    const second = await PATCH(patchRequest({ block: "movements", hidden: true }, { "content-type": "application/json", "idempotency-key": "home-prefs-2" }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});
