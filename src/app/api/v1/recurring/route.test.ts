// `AC-API-01` (cursor) y `AC-API-04` (filtro desconocido) sobre el listado
// de reglas recurrentes.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listRecurringDashboard: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/recurring.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/data/repositories/recurring.repository")
  >("@/data/repositories/recurring.repository");
  return {
    ...actual,
    listRecurringDashboard: mocks.listRecurringDashboard,
  };
});
vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: vi.fn(),
}));
vi.mock("@/data/supabase/server", () => ({ createServiceClient: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({
    client: {},
    userId: "11111111-1111-4111-8111-111111111111",
  });
  mocks.listRecurringDashboard.mockResolvedValue({ rules: [], candidates: [] });
});

describe("GET /api/v1/recurring", () => {
  it("AC-API-04: un filtro desconocido devuelve VALIDATION_ERROR", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/v1/recurring?filtro_inventado=x")
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("un cursor corrupto devuelve VALIDATION_ERROR", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/v1/recurring?cursor=no-valido-@@@")
    );
    expect(response.status).toBe(400);
  });

  it("responde con meta.page cuando la query es valida", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/v1/recurring"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.meta.page).toEqual({ next_cursor: null, has_more: false, limit: 25 });
  });
});
