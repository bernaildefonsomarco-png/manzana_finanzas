import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const MOVEMENT_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({ getApiAuth: vi.fn(), getMovementClassificationWhy: vi.fn() }));
vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/classification.repository", () => ({
  getMovementClassificationWhy: mocks.getMovementClassificationWhy,
}));

const why = {
  movement: { id: MOVEMENT_ID, category_id: "alimentacion", subcategory_id: null },
  explanation: "Elegiste esta clasificacion para Rappi.",
  evidence: [{
    polarity: "positive",
    text: "Elegiste esta clasificacion para Rappi.",
    observed_at: "2026-07-01T15:00:00Z",
  }],
  forget_targets: [{
    memory_id: "22222222-2222-4222-8222-222222222222",
    summary: "Rappi suele corresponder a alimentacion.",
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.getMovementClassificationWhy.mockResolvedValue(why);
});

describe("GET /api/v1/movements/[id]/classification/why", () => {
  it("camino feliz: explica con evidencia concreta y target para olvidar", async () => {
    const response = await GET(request(), context(MOVEMENT_ID));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.classification).toMatchObject({
      explanation: expect.stringContaining("Rappi"),
      evidence: [expect.objectContaining({ observed_at: "2026-07-01T15:00:00Z" })],
      forget_targets: [expect.objectContaining({ memory_id: expect.any(String) })],
    });
    expect(JSON.stringify(body)).not.toMatch(/confidence|weight|canonical_key/);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(request(), context(MOVEMENT_ID))).status).toBe(401);
  });

  it("movimiento de otro usuario: 404, nunca 403", async () => {
    mocks.getMovementClassificationWhy.mockResolvedValue(null);
    expect((await GET(request(), context(MOVEMENT_ID))).status).toBe(404);
  });

  it("validacion: movement id invalido devuelve VALIDATION_ERROR", async () => {
    const response = await GET(request(), context("no-es-uuid"));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lectura repetida es estable y no crea una mutacion", async () => {
    const first = await (await GET(request(), context(MOVEMENT_ID))).json();
    const second = await (await GET(request(), context(MOVEMENT_ID))).json();
    expect(second.data).toEqual(first.data);
    expect(mocks.getMovementClassificationWhy).toHaveBeenCalledTimes(2);
  });
});

function request() {
  return new Request(`http://localhost/api/v1/movements/${MOVEMENT_ID}/classification/why`);
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}
