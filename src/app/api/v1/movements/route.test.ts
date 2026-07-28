// `AC-API-01` (cursor), `AC-API-02` (limite maximo), `AC-API-04` (filtro
// desconocido -> VALIDATION_ERROR) sobre el listado de movimientos.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));

function fakeMovement(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000000",
    user_id: "11111111-1111-4111-8111-111111111111",
    created_at: overrides.created_at ?? "2026-07-14T10:00:00Z",
    occurred_at: overrides.occurred_at ?? "2026-07-14T10:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

/** Mock encadenable minimo del query builder de supabase-js: cada metodo se
 * devuelve a si mismo, y al ser `await`-ado resuelve `{data, error}`. */
function fakeMovementsClient(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "order", "is", "gte", "lte", "or"];
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  builder.limit = vi.fn((n: number) => {
    builder._lastLimit = n;
    return builder;
  });
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => void) =>
    resolve({ data: rows.slice(0, (builder._lastLimit as number) ?? rows.length), error: null });

  return {
    from: vi.fn(() => builder),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/movements", () => {
  it("AC-API-04: un filtro desconocido en la query devuelve VALIDATION_ERROR", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: fakeMovementsClient([]),
      userId: "11111111-1111-4111-8111-111111111111",
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/v1/movements?filtro_inventado=x")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("un cursor corrupto devuelve VALIDATION_ERROR, no la primera pagina silenciosa", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: fakeMovementsClient([]),
      userId: "11111111-1111-4111-8111-111111111111",
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/v1/movements?cursor=no-es-valido-@@@")
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("AC-API-01/02: pide limit+1, y devuelve next_cursor/has_more cuando sobra una fila", async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      fakeMovement({
        id: `id-${i}`,
        created_at: `2026-07-${20 - i}T10:00:00Z`,
        occurred_at: `2026-07-${20 - i}T10:00:00Z`,
      })
    );
    const client = fakeMovementsClient(rows);
    mocks.getApiAuth.mockResolvedValue({
      client,
      userId: "11111111-1111-4111-8111-111111111111",
    });
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/v1/movements?limit=2")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.movements).toHaveLength(2);
    expect(body.meta.page.has_more).toBe(true);
    expect(body.meta.page.next_cursor).not.toBeNull();
    expect(body.meta.page.limit).toBe(2);
  });

  it("AC-API-03: los filtros de la query llegan al servidor (no se descarga todo para filtrar despues)", async () => {
    const client = fakeMovementsClient([]);
    mocks.getApiAuth.mockResolvedValue({
      client,
      userId: "11111111-1111-4111-8111-111111111111",
    });
    const { GET } = await import("./route");

    await GET(
      new Request(
        "http://localhost/api/v1/movements?type=gasto&status=confirmed&category_id=alimentacion"
      )
    );

    const builder = client.from.mock.results[0]!.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.eq).toHaveBeenCalledWith("type", "gasto");
    expect(builder.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(builder.eq).toHaveBeenCalledWith("category_id", "alimentacion");
  });

  it("AC-API-02: un limit por encima de 100 se recorta a 100 (via limit+1=101 pedido)", async () => {
    const client = fakeMovementsClient([]);
    mocks.getApiAuth.mockResolvedValue({
      client,
      userId: "11111111-1111-4111-8111-111111111111",
    });
    const { GET } = await import("./route");

    await GET(new Request("http://localhost/api/v1/movements?limit=500"));

    const builder = client.from.mock.results[0]!.value as { limit: ReturnType<typeof vi.fn> };
    expect(builder.limit).toHaveBeenCalledWith(101);
  });
});
