// AC-DINERO-01, AC-CUENTAS-01/16 (`09` §4, `24` §6, §17): GET /api/v1/money
// devuelve las cuatro capas con el ejemplo canonico, sin sesion da 401, y no
// crece en numero de consultas con el volumen de cuentas/cajas (WEB-D193).
// Sin cuerpo de entrada, "validacion" e "idempotencia" (51 §6.2) no aplican
// a un GET sin parametros: no se inventan casos que no prueban nada.
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

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/money"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
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
