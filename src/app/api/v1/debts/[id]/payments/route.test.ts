import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  commitDebtPayment: vi.fn(),
  createServiceClient: vi.fn(),
  getAccountById: vi.fn(),
  getApiAuth: vi.fn(),
  getDebtById: vi.fn(),
  refreshDebtLifecycle: vi.fn(),
  findDebtPaymentByIdempotencyKey: vi.fn(),
  listDebtInstallments: vi.fn(),
  listDebtPaymentsForDebt: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
}));

vi.mock("@/data/repositories/debts.repository", () => ({
  commitDebtPayment: mocks.commitDebtPayment,
  getDebtById: mocks.getDebtById,
  listDebtPaymentsForDebt: mocks.listDebtPaymentsForDebt,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/core/debts/debt-lifecycle-service", () => ({
  refreshDebtLifecycle: mocks.refreshDebtLifecycle,
}));

vi.mock("@/data/repositories/debt-payment-command.repository", () => ({
  SupabaseDebtPaymentExecutionPort: class {
    constructor(
      private readonly readClient: unknown,
      private readonly writeClient: unknown
    ) {}

    findByIdempotencyKey(userId: string, idempotencyKey: string) {
      return mocks.findDebtPaymentByIdempotencyKey(userId, idempotencyKey);
    }

    getDebt(userId: string, debtId: string) {
      return mocks.getDebtById(this.readClient, userId, debtId);
    }

    getAccount(userId: string, accountId: string) {
      return mocks.getAccountById(this.readClient, userId, accountId);
    }

    listInstallments(userId: string, debtId: string) {
      return mocks.listDebtInstallments(this.readClient, userId, debtId);
    }

    commit(input: unknown) {
      return mocks.commitDebtPayment(this.writeClient, input);
    }

    refreshLifecycle(userId: string, traceId: string) {
      return mocks.refreshDebtLifecycle(this.writeClient, userId, { traceId });
    }
  },
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.refreshDebtLifecycle.mockResolvedValue({
    lifecycle: {},
    nudges: null,
    timezone: "America/Lima",
  });
  mocks.findDebtPaymentByIdempotencyKey.mockResolvedValue(null);
  mocks.listDebtInstallments.mockResolvedValue([]);
  mocks.listDebtPaymentsForDebt.mockResolvedValue([]);
});

describe("debt payment route", () => {
  it("devuelve las asignaciones atomicas creadas por Core", async () => {
    const client = {};
    const serviceClient = {};
    mocks.getApiAuth.mockResolvedValue({
      client,
      userId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.getDebtById.mockResolvedValue(debtFixture());
    mocks.createServiceClient.mockReturnValue(serviceClient);
    mocks.commitDebtPayment.mockImplementation(
      async (_client: unknown, params: { payment: { id: string } }) => ({
        movement: { id: "33333333-3333-4333-8333-333333333333" },
        debt: { ...debtFixture(), current_balance: 70 },
        payment: { ...params.payment, amount: 30 },
        installment_allocations: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            debt_installment_id: "55555555-5555-4555-8555-555555555555",
            allocated_amount: 30,
            allocation_order: 1,
          },
        ],
        allocation_policy: "oldest_open_due_date_first_v1",
        idempotent: false,
      })
    );

    const response = await POST(paymentRequest(30), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.installment_allocations).toHaveLength(1);
    expect(payload.data.installment_allocations[0].allocated_amount).toBe(30);
    expect(payload.data.allocation_policy).toBe(
      "oldest_open_due_date_first_v1"
    );
    expect(mocks.commitDebtPayment).toHaveBeenCalledWith(
      serviceClient,
      expect.objectContaining({
        debtId: "11111111-1111-4111-8111-111111111111",
        payment: expect.objectContaining({ amount: 30 }),
      })
    );
    expect(mocks.refreshDebtLifecycle).toHaveBeenCalledWith(
      serviceClient,
      "22222222-2222-4222-8222-222222222222",
      { traceId: expect.any(String) }
    );
  });

  it("bloquea sobrepago antes de llegar al RPC", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: {},
      userId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.getDebtById.mockResolvedValue(debtFixture());

    const response = await POST(paymentRequest(101), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("CORE_REJECTED");
    expect(mocks.commitDebtPayment).not.toHaveBeenCalled();
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(paymentRequest(30), routeContext())).status).toBe(401);
  });

  it("deuda de otro usuario: 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: {},
      userId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.getDebtById.mockResolvedValue(null);
    expect((await POST(paymentRequest(30), routeContext())).status).toBe(404);
  });

  it("validación: rechaza una fecha futura", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    const request = paymentRequest(30, { paid_at: "2999-01-01T00:00:00.000Z" });
    const response = await POST(request, routeContext());
    expect(response.status).toBe(400);
    expect(mocks.commitDebtPayment).not.toHaveBeenCalled();
  });

  it("idempotencia: devuelve el pago previo sin repetir el commit", async () => {
    const existingDebt = debtFixture();
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: existingDebt.user_id });
    mocks.findDebtPaymentByIdempotencyKey.mockResolvedValue({
      movement: {
        id: "33333333-3333-4333-8333-333333333333",
        debt_id: existingDebt.id,
        type: "pago_deuda",
        account_origin_id: null,
        account_destination_id: null,
      },
      debt: existingDebt,
      payment: {
        id: "44444444-4444-4444-8444-444444444444",
        debt_id: existingDebt.id,
        amount: 30,
        currency: "PEN",
        paid_at: "2026-06-30T12:00:00.000Z",
        source: "dashboard_manual",
        metadata: {
          note: null,
          installment_id: null,
          installment_number: null,
        },
      },
      installment_allocations: [],
      allocation_policy: "oldest_open_due_date_first_v1",
      idempotent: true,
    });
    const response = await POST(paymentRequest(30), routeContext());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.idempotent).toBe(true);
    expect(mocks.commitDebtPayment).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/debts/[id]/payments", () => {
  it("camino feliz: devuelve historial con asignaciones", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getDebtById.mockResolvedValue(debtFixture());
    mocks.listDebtPaymentsForDebt.mockResolvedValue([
      { id: "p1", allocations: [{ allocated_amount: 30 }] },
    ]);
    const response = await GET(paymentGetRequest(), routeContext());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.payments[0].allocations[0].allocated_amount).toBe(30);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(paymentGetRequest(), routeContext())).status).toBe(401);
  });

  it("deuda ajena: 404", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getDebtById.mockResolvedValue(null);
    expect((await GET(paymentGetRequest(), routeContext())).status).toBe(404);
  });

  it("validación: id inválido devuelve 400", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    expect(
      (
        await GET(paymentGetRequest(), {
          params: Promise.resolve({ id: "no-uuid" }),
        })
      ).status
    ).toBe(400);
  });

  it("idempotencia de lectura: repetir GET no registra pagos", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getDebtById.mockResolvedValue(debtFixture());
    await GET(paymentGetRequest(), routeContext());
    await GET(paymentGetRequest(), routeContext());
    expect(mocks.listDebtPaymentsForDebt).toHaveBeenCalledTimes(2);
    expect(mocks.commitDebtPayment).not.toHaveBeenCalled();
  });
});

function paymentRequest(amount: number, overrides: Record<string, unknown> = {}) {
  return new Request(
    "http://localhost/api/v1/debts/11111111-1111-4111-8111-111111111111/payments",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "debt-payment-test-123",
      },
      body: JSON.stringify({
        amount,
        paid_at: "2026-06-30T12:00:00.000Z",
        ...overrides,
      }),
    }
  );
}

function paymentGetRequest() {
  return new Request(
    "http://localhost/api/v1/debts/11111111-1111-4111-8111-111111111111/payments"
  );
}

function routeContext() {
  return {
    params: Promise.resolve({
      id: "11111111-1111-4111-8111-111111111111",
    }),
  };
}

function debtFixture() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    direction: "i_owe",
    kind: "installment_purchase",
    status: "active",
    related_person_id: null,
    related_person: null,
    name: "Laptop",
    principal_amount: 100,
    current_balance: 100,
    currency: "PEN",
    opened_at: "2026-06-01",
    due_date: "2026-06-30",
    next_payment_date: "2026-06-30",
    installment_count: 2,
    installment_amount: 50,
    interest_notes: null,
    source: "dashboard_manual",
    confidence: 1,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    deleted_at: null,
    last_payment_at: null,
    closed_at: null,
  };
}
