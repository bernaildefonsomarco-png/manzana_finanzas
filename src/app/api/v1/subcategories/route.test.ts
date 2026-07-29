// SCR-CAT-02/03 (`25` §8): GET /api/v1/subcategories trae el conteo de
// movimientos y ordena las mas usadas primero.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getClassificationCatalog: vi.fn(),
  getSubcategoryMovementCounts: vi.fn(),
  createServiceClient: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/classification.repository", () => ({
  getClassificationCatalog: mocks.getClassificationCatalog,
  getSubcategoryMovementCounts: mocks.getSubcategoryMovementCounts,
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

function subcategory(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "s1",
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServiceClient.mockReturnValue({});
});

describe("GET /api/v1/subcategories", () => {
  it("camino feliz: trae movement_count y ordena las mas usadas primero", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getClassificationCatalog.mockResolvedValue({
      categories: [],
      subcategories: [
        subcategory({ id: "poco-usada", label: "Poco usada" }),
        subcategory({ id: "muy-usada", label: "Muy usada" }),
      ],
      tags: [],
      related_people: [],
    });
    mocks.getSubcategoryMovementCounts.mockResolvedValue([
      { subcategory_id: "poco-usada", movement_count: 1 },
      { subcategory_id: "muy-usada", movement_count: 47 },
    ]);

    const response = await GET(new Request("http://localhost/api/v1/subcategories"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.subcategories.map((s: { id: string }) => s.id)).toEqual(["muy-usada", "poco-usada"]);
    expect(body.data.subcategories[0].movement_count).toBe(47);
  });

  it("subcategoria sin movimientos trae movement_count 0, no se omite", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getClassificationCatalog.mockResolvedValue({
      categories: [],
      subcategories: [subcategory({ id: "nueva" })],
      tags: [],
      related_people: [],
    });
    mocks.getSubcategoryMovementCounts.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/v1/subcategories"));
    const body = await response.json();

    expect(body.data.subcategories[0].movement_count).toBe(0);
  });

  it("SCR-CAT-02: category_id filtra solo las subcategorias de esa categoria", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getClassificationCatalog.mockResolvedValue({
      categories: [],
      subcategories: [
        subcategory({ id: "s-transporte", category_id: "transporte" }),
        subcategory({ id: "s-salud", category_id: "salud" }),
      ],
      tags: [],
      related_people: [],
    });
    mocks.getSubcategoryMovementCounts.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/v1/subcategories?category_id=transporte"));
    const body = await response.json();

    expect(body.data.subcategories.map((s: { id: string }) => s.id)).toEqual(["s-transporte"]);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/subcategories"));

    expect(response.status).toBe(401);
  });
});

describe("POST /api/v1/subcategories", () => {
  it("validacion: nombre vacio devuelve VALIDATION_ERROR", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });

    const response = await POST(
      new Request("http://localhost/api/v1/subcategories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category_id: "transporte", label: "" }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("AC-CAT-04: subcategoria duplicada tras normalizar devuelve CONFLICT", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.dispatch.mockRejectedValue({ code: "23505" });

    const response = await POST(
      new Request("http://localhost/api/v1/subcategories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category_id: "transporte", label: "Uber" }),
      })
    );

    expect(response.status).toBe(409);
  });
});
