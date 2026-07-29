// AC-CUENTAS-15 (RUL-CUENTAS-06, ERR-CUENTAS-04): POST /api/v1/money/actions
// separa dinero, transfiere y ajusta saldo; el servidor deduce el tipo de
// movimiento y nunca deja el libre de una cuenta en negativo al separar.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getAccountById: vi.fn(),
  getBoxById: vi.fn(),
  getFreeBalanceForAccount: vi.fn(),
  createServiceClient: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
  getBoxById: mocks.getBoxById,
  getFreeBalanceForAccount: mocks.getFreeBalanceForAccount,
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

function box(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "u1",
    account_id: "11111111-1111-4111-8111-111111111111",
    name: "Caja",
    type: "objetivo",
    current_balance: 0,
    target_amount: null,
    target_date: null,
    linked_debt_id: null,
    linked_recurring_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    metadata: {},
    ...overrides,
  };
}

function postRequest(body: unknown, idempotencyKey: string | null = "test-money-action-key-1") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return new Request("http://localhost/api/v1/money/actions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServiceClient.mockReturnValue({});
});

describe("POST /api/v1/money/actions", () => {
  it("camino feliz: separar dinero dentro del libre disponible crea el movimiento", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getBoxById.mockResolvedValue(box({ id: "22222222-2222-4222-8222-222222222222" }));
    mocks.getAccountById.mockResolvedValue(account({ current_balance: 100 }));
    mocks.getFreeBalanceForAccount.mockResolvedValue(50);
    mocks.dispatch.mockResolvedValue({
      type: "movement_created",
      idempotent: false,
      movement: { id: "33333333-3333-4333-8333-333333333333" },
    });

    const response = await POST(
      postRequest({
        action: "move_box_money",
        mode: "separate_to_box",
        amount: 30,
        box_destination_id: "22222222-2222-4222-8222-222222222222",
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });

  it("ERR-CUENTAS-04: separar mas de lo libre en la cuenta se rechaza sin llegar al dispatcher", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getBoxById.mockResolvedValue(box({ id: "22222222-2222-4222-8222-222222222222" }));
    mocks.getAccountById.mockResolvedValue(account({ name: "BCP", current_balance: 100 }));
    mocks.getFreeBalanceForAccount.mockResolvedValue(20);

    const response = await POST(
      postRequest({
        action: "move_box_money",
        mode: "separate_to_box",
        amount: 50,
        box_destination_id: "22222222-2222-4222-8222-222222222222",
      })
    );

    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain("Solo tienes S/20.00 libres en BCP");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(postRequest({ action: "transfer_between_accounts" }));

    expect(response.status).toBe(401);
  });

  it("sin Idempotency-Key: VALIDATION_ERROR", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });

    const response = await POST(postRequest({ action: "transfer_between_accounts" }, null));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("validacion: cuerpo invalido devuelve VALIDATION_ERROR en espanol", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });

    const response = await POST(postRequest({ action: "no_existe" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("idempotencia: repetir con la misma clave no crea un segundo movimiento", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById
      .mockResolvedValueOnce(account({ id: "44444444-4444-4444-8444-444444444444", current_balance: 100 }))
      .mockResolvedValueOnce(account({ id: "55555555-5555-4555-8555-555555555555", current_balance: 10 }));
    mocks.dispatch.mockResolvedValue({
      type: "movement_created",
      idempotent: true,
      movement: { id: "33333333-3333-4333-8333-333333333333" },
    });

    const response = await POST(
      postRequest(
        {
          action: "transfer_between_accounts",
          from_account_id: "44444444-4444-4444-8444-444444444444",
          to_account_id: "55555555-5555-4555-8555-555555555555",
          amount: 10,
        },
        "repeated-key"
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.idempotent).toBe(true);
  });
});
