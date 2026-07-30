// `AC-API-01` (cursor) y `AC-API-04` (filtro desconocido) sobre el listado
// de reglas recurrentes.
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as routeModule from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listRecurringDashboard: vi.fn(),
  createRecurringRule: vi.fn(),
  getAccountById: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/recurring.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/data/repositories/recurring.repository")
  >("@/data/repositories/recurring.repository");
  return {
    ...actual,
    listRecurringDashboard: mocks.listRecurringDashboard,
    createRecurringRule: mocks.createRecurringRule,
  };
});
vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
}));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({
    client: {},
    userId: "11111111-1111-4111-8111-111111111111",
  });
  mocks.listRecurringDashboard.mockResolvedValue({ rules: [], candidates: [] });
  mocks.createRecurringRule.mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
    name: "Luz",
    expected_amount: null,
    occurrences: [],
  });
  mocks.getAccountById.mockResolvedValue(null);
});

describe("GET /api/v1/recurring", () => {
  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await routeModule.GET(
      new Request("http://localhost/api/v1/recurring"),
    );

    expect(response.status).toBe(401);
    expect(mocks.listRecurringDashboard).not.toHaveBeenCalled();
  });
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

  it("colección propia e idempotente: siempre consulta con el user_id autenticado", async () => {
    const { GET } = await import("./route");
    const first = await GET(new Request("http://localhost/api/v1/recurring"));
    const second = await GET(new Request("http://localhost/api/v1/recurring"));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.listRecurringDashboard).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      "11111111-1111-4111-8111-111111111111",
      expect.any(Array),
      expect.any(Object)
    );
  });
});

describe("POST /api/v1/recurring", () => {
  it("camino feliz: crea una regla variable sin inventar estimación", async () => {
    const { POST } = await import("./route");

    const response = await POST(postRequest(variableRule()));

    expect(response.status).toBe(201);
    expect(mocks.createRecurringRule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        expectedAmount: null,
        amountVariability: "variable",
        idempotencyKey: "recurring-create-test-key",
      })
    );
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(postRequest(variableRule()));

    expect(response.status).toBe(401);
    expect(mocks.createRecurringRule).not.toHaveBeenCalled();
  });

  it("cuenta de otro usuario se oculta como 404, nunca 403", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      postRequest({
        ...variableRule(),
        default_account_id: "44444444-4444-4444-8444-444444444444",
      })
    );

    expect(response.status).toBe(404);
  });

  it("validación: una regla fixed exige monto", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      postRequest({
        ...variableRule(),
        amount_variability: "fixed",
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.createRecurringRule).not.toHaveBeenCalled();
  });

  it("validación: rechaza una fecha de calendario inexistente", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      postRequest({ ...variableRule(), next_expected_date: "2026-02-30" })
    );

    expect(response.status).toBe(400);
    expect(mocks.createRecurringRule).not.toHaveBeenCalled();
  });

  it("no permite next_expected_date anterior a hoy en Lima al crear", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T12:00:00.000-05:00"));
    mocks.createRecurringRule.mockRejectedValue(
      new Error("RECURRING_RULE_NEXT_DATE_IN_PAST")
    );
    const { POST } = await import("./route");

    const response = await POST(
      postRequest({ ...variableRule(), next_expected_date: "2026-07-28" })
    );

    expect(response.status).toBe(400);
    expect(mocks.createRecurringRule).toHaveBeenCalledOnce();
  });

  it("ERR-REC-01 devuelve 409 con mensaje de producto", async () => {
    mocks.createRecurringRule.mockRejectedValue(
      new Error("RECURRING_RULE_NAME_CONFLICT")
    );
    const { POST } = await import("./route");

    const response = await POST(postRequest(variableRule()));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.message).toBe(
      "Ya tienes un pago que viene con ese nombre."
    );
  });

  it("idempotencia: propaga la misma key en cada retry", async () => {
    const { POST } = await import("./route");
    const first = await POST(postRequest(variableRule()));
    const replay = await POST(postRequest(variableRule()));

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(mocks.createRecurringRule).toHaveBeenCalledTimes(2);
    expect(
      mocks.createRecurringRule.mock.calls.map((call) => call[1].idempotencyKey)
    ).toEqual([
      "recurring-create-test-key",
      "recurring-create-test-key",
    ]);
  });

  it("exige Idempotency-Key válida", async () => {
    const { POST } = await import("./route");
    const request = postRequest(variableRule());
    request.headers.delete("Idempotency-Key");

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

function variableRule() {
  return {
    name: "Luz",
    expected_amount: null,
    amount_variability: "variable",
    currency: "PEN",
    frequency: "monthly",
    next_expected_date: "2026-08-15",
  };
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/v1/recurring", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "recurring-create-test-key",
    },
    body: JSON.stringify(body),
  });
}
