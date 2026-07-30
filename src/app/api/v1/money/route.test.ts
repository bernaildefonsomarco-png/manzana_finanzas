// AC-DINERO-01, AC-CUENTAS-01/16 (`09` §4, `24` §6, §17): GET /api/v1/money
// devuelve las cuatro capas con el ejemplo canonico, sin sesion da 401, y no
// crece en numero de consultas con el volumen de cuentas/cajas (WEB-D193).
// W-11 modifica la lectura para incorporar cuotas de deuda, por lo que este
// fichero cubre expresamente los cinco casos de `51` §6.2.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getActiveAccounts: vi.fn(),
  getActiveBoxes: vi.fn(),
  listUpcomingCommitments: vi.fn(),
  listDebtInstallmentCommitments: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getActiveAccounts: mocks.getActiveAccounts,
  getActiveBoxes: mocks.getActiveBoxes,
}));

vi.mock("@/data/repositories/recurring.repository", () => ({
  listUpcomingCommitments: mocks.listUpcomingCommitments,
}));

vi.mock("@/data/repositories/debts.repository", () => ({
  listDebtInstallmentCommitments: mocks.listDebtInstallmentCommitments,
}));

function account(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "acc",
    user_id: "u1",
    name: "Cuenta",
    institution: null,
    type: "banco",
    currency: "PEN",
    initial_balance: 0,
    current_balance: 0,
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
    id: "box",
    user_id: "u1",
    account_id: "acc",
    name: "Caja",
    type: "compromiso",
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/money", () => {
  it("camino feliz: el ejemplo canonico de 09 §4 produce 800/580/220/170", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getActiveAccounts.mockResolvedValue([
      account({ id: "bcp", name: "BCP", current_balance: 630 }),
      account({ id: "yape", name: "Yape", current_balance: 120 }),
      account({ id: "efectivo", name: "Efectivo", current_balance: 50 }),
    ]);
    mocks.getActiveBoxes.mockResolvedValue([
      box({ id: "emergencia", account_id: "bcp", name: "Emergencia", current_balance: 100 }),
      box({ id: "cuota-laptop", account_id: "bcp", name: "Cuota laptop", current_balance: 180 }),
      box({ id: "alquiler", account_id: "bcp", name: "Alquiler", current_balance: 300 }),
    ]);
    mocks.listUpcomingCommitments.mockResolvedValue([
      {
        id: "internet",
        title: "Internet",
        amount: 50,
        currency: "PEN",
        due_at: "2026-08-01",
        kind: "recurring",
        linked_box_id: null,
      },
      {
        id: "cuota",
        title: "Cuota laptop",
        amount: 180,
        currency: "PEN",
        due_at: "2026-08-03",
        kind: "recurring",
        linked_box_id: "cuota-laptop",
      },
    ]);
    mocks.listDebtInstallmentCommitments.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/v1/money"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.total_balance).toBe(800);
    expect(body.data.separated_in_boxes).toBe(580);
    expect(body.data.free_in_accounts).toBe(220);
    expect(body.data.upcoming_uncovered_commitments).toBe(50);
    expect(body.data.operational_free_money).toBe(170);
  });

  it("no suma PEN y USD: calcula las cuatro capas por moneda", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getActiveAccounts.mockResolvedValue([
      account({ id: "pen", currency: "PEN", current_balance: 100 }),
      account({ id: "usd", currency: "USD", current_balance: 100 }),
    ]);
    mocks.getActiveBoxes.mockResolvedValue([
      box({ id: "usd-box", account_id: "usd", current_balance: 20 }),
    ]);
    mocks.listUpcomingCommitments.mockResolvedValue([
      {
        id: "pen-rec",
        title: "Internet",
        amount: 30,
        currency: "PEN",
        due_at: "2026-08-01",
        kind: "recurring",
        linked_box_id: null,
      },
      {
        id: "usd-rec",
        title: "Servicio USD",
        amount: 40,
        currency: "USD",
        due_at: "2026-08-02",
        kind: "recurring",
        linked_box_id: null,
      },
    ]);
    mocks.listDebtInstallmentCommitments.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/v1/money"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.base_currency).toBe("PEN");
    expect(body.data).toMatchObject({
      total_balance: 100,
      separated_in_boxes: 0,
      free_in_accounts: 100,
      upcoming_uncovered_commitments: 30,
      operational_free_money: 70,
    });
    expect(body.data.currency_layers.USD).toMatchObject({
      total_balance: 100,
      separated_in_boxes: 20,
      free_in_accounts: 80,
      upcoming_uncovered_commitments: 40,
      operational_free_money: 40,
    });
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/money"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it("coleccion propia: no acepta un id ajeno ni expone un recurso individual", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getActiveAccounts.mockResolvedValue([]);
    mocks.getActiveBoxes.mockResolvedValue([]);
    mocks.listUpcomingCommitments.mockResolvedValue([]);
    mocks.listDebtInstallmentCommitments.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/v1/money"));

    expect(response.status).toBe(200);
    expect(mocks.getActiveAccounts).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(mocks.listDebtInstallmentCommitments).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      30
    );
  });

  it("validacion: rechaza parametros no documentados", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });

    const response = await GET(
      new Request("http://localhost/api/v1/money?user_id=otro")
    );

    expect(response.status).toBe(400);
    expect(mocks.getActiveAccounts).not.toHaveBeenCalled();
  });

  it("idempotencia de lectura: repetir GET devuelve lo mismo y no escribe", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getActiveAccounts.mockResolvedValue([]);
    mocks.getActiveBoxes.mockResolvedValue([]);
    mocks.listUpcomingCommitments.mockResolvedValue([]);
    mocks.listDebtInstallmentCommitments.mockResolvedValue([]);

    const first = await GET(new Request("http://localhost/api/v1/money"));
    const second = await GET(new Request("http://localhost/api/v1/money"));

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.data).toEqual(secondBody.data);
    expect(mocks.getActiveAccounts).toHaveBeenCalledTimes(2);
    expect(mocks.getActiveBoxes).toHaveBeenCalledTimes(2);
  });

  it("AC-CUENTAS-16 (WEB-D193): el numero de consultas no crece con el numero de cuentas/cajas", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getActiveAccounts.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => account({ id: `acc-${i}`, current_balance: 10 }))
    );
    mocks.getActiveBoxes.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => box({ id: `box-${i}`, current_balance: 1 }))
    );
    mocks.listUpcomingCommitments.mockResolvedValue([]);
    mocks.listDebtInstallmentCommitments.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/v1/money"));

    // Cuatro llamadas fijas, independientes del volumen de filas: cuentas,
    // cajas, compromisos recurrentes, cuotas de deuda. Ninguna se repite por
    // fila (sin N+1 por cuenta).
    expect(mocks.getActiveAccounts).toHaveBeenCalledTimes(1);
    expect(mocks.getActiveBoxes).toHaveBeenCalledTimes(1);
    expect(mocks.listUpcomingCommitments).toHaveBeenCalledTimes(1);
    expect(mocks.listDebtInstallmentCommitments).toHaveBeenCalledTimes(1);
  });

  it("sin cuentas: no muestra 'Dinero libre: S/0.00' (AC-DINERO-05, AC-CUENTAS-04)", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getActiveAccounts.mockResolvedValue([]);
    mocks.getActiveBoxes.mockResolvedValue([]);
    mocks.listUpcomingCommitments.mockResolvedValue([]);
    mocks.listDebtInstallmentCommitments.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/v1/money"));
    const body = await response.json();

    expect(body.data.empty_state).toEqual({
      reason: "no_accounts",
      title: "Agrega tu primera cuenta",
      description:
        "Con una cuenta, Manzana puede distinguir saldo total, dinero separado y dinero libre sin inventar datos.",
    });
  });

  it("30 dias es el horizonte de compromisos, no 31 (RUL-CUENTAS-05)", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getActiveAccounts.mockResolvedValue([]);
    mocks.getActiveBoxes.mockResolvedValue([]);
    mocks.listUpcomingCommitments.mockResolvedValue([]);
    mocks.listDebtInstallmentCommitments.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/v1/money"));

    expect(mocks.listUpcomingCommitments).toHaveBeenCalledWith(expect.anything(), "u1", 30);
    expect(mocks.listDebtInstallmentCommitments).toHaveBeenCalledWith(expect.anything(), "u1", 30);
  });
});
