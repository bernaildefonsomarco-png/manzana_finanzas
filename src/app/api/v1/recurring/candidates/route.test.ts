import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listRecurringCandidates: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/recurring.repository", () => ({
  listRecurringCandidates: mocks.listRecurringCandidates,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.listRecurringCandidates.mockResolvedValue([
    { id: "candidate-1", status: "ready_to_suggest" },
  ]);
});

describe("GET /api/v1/recurring/candidates", () => {
  it("camino feliz lista solo candidatos del usuario autenticado", async () => {
    const response = await GET(
      request("?status=ready_to_suggest&limit=10")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.candidates).toHaveLength(1);
    expect(mocks.listRecurringCandidates).toHaveBeenCalledWith(
      {},
      "user-1",
      ["ready_to_suggest"],
      { limit: 10 }
    );
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.listRecurringCandidates).not.toHaveBeenCalled();
  });

  it("colección propia vacía responde 200; no existe un id ajeno que revelar", async () => {
    mocks.listRecurringCandidates.mockResolvedValue([]);

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.candidates).toEqual([]);
  });

  it("validación rechaza estados desconocidos", async () => {
    const response = await GET(request("?status=inventado"));

    expect(response.status).toBe(400);
    expect(mocks.listRecurringCandidates).not.toHaveBeenCalled();
  });

  it("idempotencia no aplica como escritura: dos GET son la misma lectura", async () => {
    const first = await GET(request());
    const second = await GET(request());
    const firstPayload = await first.json();
    const secondPayload = await second.json();

    expect(firstPayload.data).toEqual(secondPayload.data);
    expect(mocks.listRecurringCandidates).toHaveBeenCalledTimes(2);
  });
});

function request(query = "") {
  return new Request(`http://localhost/api/v1/recurring/candidates${query}`);
}
