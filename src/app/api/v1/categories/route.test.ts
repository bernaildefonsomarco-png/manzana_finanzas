// AC-CAT-01 (`25` §10): GET /api/v1/categories devuelve las 12 con su total
// del periodo, y sin_clasificar nunca se mezcla con "otros".
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getClassificationCatalog: vi.fn(),
  getCategoryTotalsForCurrentPeriod: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/classification.repository", () => ({
  getClassificationCatalog: mocks.getClassificationCatalog,
  getCategoryTotalsForCurrentPeriod: mocks.getCategoryTotalsForCurrentPeriod,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/categories", () => {
  it("camino feliz: cada categoria trae su total del periodo, sin_clasificar aparte", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getClassificationCatalog.mockResolvedValue({
      categories: [
        { id: "alimentacion", label: "Alimentación", sort_order: 1 },
        { id: "otros", label: "Otros", sort_order: 12 },
      ],
      subcategories: [],
      tags: [],
      related_people: [],
    });
    mocks.getCategoryTotalsForCurrentPeriod.mockResolvedValue([
      { category_id: "alimentacion", total: 120.5, movement_count: 4 },
      { category_id: "otros", total: 15, movement_count: 1 },
      { category_id: null, total: 40, movement_count: 2 },
    ]);

    const response = await GET(new Request("http://localhost/api/v1/categories"));
    const body = await response.json();

    expect(response.status).toBe(200);
    const alimentacion = body.data.categories.find((c: { id: string }) => c.id === "alimentacion");
    expect(alimentacion.total_this_period).toBe(120.5);
    const otros = body.data.categories.find((c: { id: string }) => c.id === "otros");
    expect(otros.total_this_period).toBe(15);
    expect(body.data.unclassified).toEqual({ total: 40, movement_count: 2 });
  });

  it("categoria sin movimientos en el periodo trae total 0, no se omite", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getClassificationCatalog.mockResolvedValue({
      categories: [{ id: "salud", label: "Salud", sort_order: 5 }],
      subcategories: [],
      tags: [],
      related_people: [],
    });
    mocks.getCategoryTotalsForCurrentPeriod.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/v1/categories"));
    const body = await response.json();

    expect(body.data.categories[0].total_this_period).toBe(0);
    expect(body.data.unclassified).toEqual({ total: 0, movement_count: 0 });
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/categories"));

    expect(response.status).toBe(401);
  });
});
