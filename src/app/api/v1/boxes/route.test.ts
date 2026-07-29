// AC-CUENTAS-09/10 (RUL-CUENTAS-06, ERR-CUENTAS-04): POST /api/v1/boxes crea
// una caja y, si se separa dinero de inmediato, no puede dejar el libre de
// la cuenta en negativo.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getAccountById: vi.fn(),
  getFreeBalanceForAccount: vi.fn(),
  createBox: vi.fn(),
  getBoxById: vi.fn(),
  softDeleteBox: vi.fn(),
  createServiceClient: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
  getActiveBoxes: vi.fn(),
  getBoxById: mocks.getBoxById,
  getFreeBalanceForAccount: mocks.getFreeBalanceForAccount,
  createBox: mocks.createBox,
  softDeleteBox: mocks.softDeleteBox,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/movements.repository", () => ({
  SupabaseFinancialCoreRepository: vi.fn(),
}));

vi.mock("@/core/finance", () => ({
  CommandDispatcher: vi.fn().mockImplementation(function CommandDispatcher(
    this: { dispatch: typeof mocks.dispatch }
  ) {
    this.dispatch = mocks.dispatch;
  }),
}));

function account(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "u1",
    name: "BCP",
    institution: null,
    type: "banco",
    currency: "PEN",
    initial_balance: 0,
    current_balance: 100,
    is_default: false,
    color: null,
    icon: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    metadata: {},
    ...overrides,
  };
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/v1/boxes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServiceClient.mockReturnValue({});
});

describe("POST /api/v1/boxes", () => {
  it("camino feliz: crea una caja sin saldo inicial", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById.mockResolvedValue(account({}));
    mocks.createBox.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Emergencia",
      current_balance: 0,
    });

    const response = await POST(
      postRequest({
        account_id: "11111111-1111-4111-8111-111111111111",
        name: "Emergencia",
        type: "emergencia",
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("ERR-CUENTAS-04: separar mas de lo libre al crear se rechaza antes de crear la caja", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById.mockResolvedValue(account({ name: "BCP" }));
    mocks.getFreeBalanceForAccount.mockResolvedValue(20);

    const response = await POST(
      postRequest({
        account_id: "11111111-1111-4111-8111-111111111111",
        name: "Viaje",
        type: "objetivo",
        initial_balance: 50,
      })
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("Solo tienes S/20.00 libres en BCP");
    expect(mocks.createBox).not.toHaveBeenCalled();
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(postRequest({ account_id: "11111111-1111-4111-8111-111111111111", name: "X" }));

    expect(response.status).toBe(401);
  });

  it("cuenta de otro usuario: 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById.mockResolvedValue(null);

    const response = await POST(
      postRequest({ account_id: "11111111-1111-4111-8111-111111111111", name: "X" })
    );

    expect(response.status).toBe(404);
  });

  it("validacion: nombre vacio devuelve VALIDATION_ERROR en espanol", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });

    const response = await POST(
      postRequest({ account_id: "11111111-1111-4111-8111-111111111111", name: "" })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
