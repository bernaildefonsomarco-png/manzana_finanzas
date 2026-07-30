import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const DEBT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getDebtById: vi.fn(),
  listDebtInstallmentsForDebt: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/debts.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/data/repositories/debts.repository")>();
  return {
    ...actual,
    getDebtById: mocks.getDebtById,
    listDebtInstallmentsForDebt: mocks.listDebtInstallmentsForDebt,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.getDebtById.mockResolvedValue({
    id: DEBT_ID,
    current_balance: 1100,
  });
  mocks.listDebtInstallmentsForDebt.mockResolvedValue([
    installment(1, "2026-08-01", 100),
    installment(2, "2026-09-01", 0),
    installment(3, "2026-10-01", 0),
    installment(4, "2026-11-01", 0),
  ]);
});

describe("POST /api/v1/debts/[id]/payments/preview", () => {
  it("RUL-DEUDAS-03: S/500 aplica 200 + 300 y deja saldo S/600", async () => {
    const response = await POST(request(500), context());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(
      body.data.preview.allocations.map(
        (item: { allocated_amount: number }) => item.allocated_amount
      )
    ).toEqual([200, 300]);
    expect(body.data.preview.projected_balance).toBe(600);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(request(500), context())).status).toBe(401);
  });

  it("deuda de otro usuario: 404, nunca 403", async () => {
    mocks.getDebtById.mockResolvedValue(null);
    expect((await POST(request(500), context())).status).toBe(404);
  });

  it("validación: rechaza monto no positivo", async () => {
    expect((await POST(request(0), context())).status).toBe(400);
  });

  it("validación: rechaza sobrepago ofreciendo las dos salidas", async () => {
    const response = await POST(request(1101), context());
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.message).toContain("Paga exactamente el saldo");
    expect(body.error.message).toContain("otro movimiento");
  });

  it("idempotencia: repetir el preview produce el mismo resultado y no escribe", async () => {
    const first = await (await POST(request(500), context())).json();
    const second = await (await POST(request(500), context())).json();
    expect(second.data.preview).toEqual(first.data.preview);
    expect(mocks.listDebtInstallmentsForDebt).toHaveBeenCalledTimes(2);
  });
});

function request(amount: number) {
  return new Request(
    `http://localhost/api/v1/debts/${DEBT_ID}/payments/preview`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount }),
    }
  );
}

function context() {
  return { params: Promise.resolve({ id: DEBT_ID }) };
}

function installment(number: number, dueDate: string, paidAmount: number) {
  return {
    id: `00000000-0000-4000-8000-00000000000${number}`,
    user_id: USER_ID,
    debt_id: DEBT_ID,
    number,
    due_date: dueDate,
    expected_amount: 300,
    paid_amount: paidAmount,
    status: "pending",
    movement_id: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    movement: null,
    allocations: [],
  };
}
