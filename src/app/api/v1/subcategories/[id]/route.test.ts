// SCR-CAT-02 (`25` §8, RUL-CAT §5): PATCH renombra (re-normaliza y detecta
// duplicados), DELETE archiva sin borrar la referencia de los movimientos.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/core/classification", () => ({
  ClassificationCommandDispatcher: vi.fn().mockImplementation(function ClassificationCommandDispatcher(
    this: { dispatch: typeof mocks.dispatch }
  ) {
    this.dispatch = mocks.dispatch;
  }),
}));

const SUBCATEGORY_ID = "33333333-3333-4333-8333-333333333333";
const ctx = { params: Promise.resolve({ id: SUBCATEGORY_ID }) };

function subcategory(overrides: Partial<Record<string, unknown>>) {
  return {
    id: SUBCATEGORY_ID,
    user_id: "u1",
    category_id: "transporte",
    label: "Uber",
    normalized_label: "uber",
    created_by: "user",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    metadata: {},
    ...overrides,
  };
}

function patchRequest(body: unknown) {
  return new Request(`http://localhost/api/v1/subcategories/${SUBCATEGORY_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new Request(`http://localhost/api/v1/subcategories/${SUBCATEGORY_ID}`, { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServiceClient.mockReturnValue({});
});

describe("PATCH /api/v1/subcategories/[id]", () => {
  it("camino feliz: renombra la subcategoria", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.dispatch.mockResolvedValue({ entity: subcategory({ label: "Taxi", normalized_label: "taxi" }) });

    const response = await PATCH(patchRequest({ label: "Taxi" }), ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.subcategory.label).toBe("Taxi");
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ label: "Taxi" }), ctx);

    expect(response.status).toBe(401);
  });

  it("subcategoria de otro usuario: 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.dispatch.mockRejectedValue({ code: "PGRST116" });

    const response = await PATCH(patchRequest({ label: "Taxi" }), ctx);

    expect(response.status).toBe(404);
  });

  it("validacion: nombre de un solo caracter devuelve VALIDATION_ERROR", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });

    const response = await PATCH(patchRequest({ label: "T" }), ctx);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("RUL-CAT §5: renombrar a un nombre que normaliza igual a otro existente devuelve CONFLICT", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.dispatch.mockRejectedValue({ code: "23505" });

    const response = await PATCH(patchRequest({ label: "Taxi" }), ctx);

    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/v1/subcategories/[id]", () => {
  it("camino feliz: archiva sin borrar la referencia", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.dispatch.mockResolvedValue({ entity: subcategory({ deleted_at: "2026-01-02T00:00:00Z" }) });

    const response = await DELETE(deleteRequest(), ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.subcategory.deleted_at).not.toBeNull();
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), ctx);

    expect(response.status).toBe(401);
  });

  it("subcategoria de otro usuario: 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.dispatch.mockRejectedValue({ code: "PGRST116" });

    const response = await DELETE(deleteRequest(), ctx);

    expect(response.status).toBe(404);
  });

  it("validacion: id invalido devuelve VALIDATION_ERROR", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });

    const response = await DELETE(
      new Request("http://localhost/api/v1/subcategories/no-es-uuid", { method: "DELETE" }),
      { params: Promise.resolve({ id: "no-es-uuid" }) }
    );

    expect(response.status).toBe(400);
  });
});
