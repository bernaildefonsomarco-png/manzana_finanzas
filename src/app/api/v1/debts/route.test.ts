import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DEBT_ID = "22222222-2222-4222-8222-222222222222";
const ACCOUNT_ID = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  commitDebtCreation: vi.fn(),
  createServiceClient: vi.fn(),
  getAccount: vi.fn(),
  getApiAuth: vi.fn(),
  listDebts: vi.fn(),
  recordInitialOnboardingValue: vi.fn(),
  refreshDebtLifecycle: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/debts.repository", () => ({
  listDebts: mocks.listDebts,
  sortDebtsByNextPaymentDate: (debts: unknown[]) => debts,
}));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/core/debts/debt-lifecycle-service", () => ({
  refreshDebtLifecycle: mocks.refreshDebtLifecycle,
}));
vi.mock("@/core/onboarding/onboarding-activation", () => ({
  recordInitialOnboardingValue: mocks.recordInitialOnboardingValue,
}));
vi.mock("@/data/repositories/debt-creation-command.repository", () => ({
  SupabaseDebtCreationExecutionPort: class {
    getAccount(userId: string, accountId: string) {
      return mocks.getAccount(userId, accountId);
    }
    commit(input: unknown) {
      return mocks.commitDebtCreation(input);
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.createServiceClient.mockReturnValue({});
  mocks.getAccount.mockResolvedValue(null);
  mocks.listDebts.mockResolvedValue([]);
  mocks.refreshDebtLifecycle.mockResolvedValue({
    lifecycle: {},
    nudges: null,
    timezone: "America/Lima",
  });
  mocks.recordInitialOnboardingValue.mockResolvedValue({ changed: true });
  mocks.commitDebtCreation.mockImplementation(
    async (input: {
      debtId: string;
      command: { payload: { name: string; principal_amount: number } };
      installments: unknown[];
    }) => ({
      debt: {
        id: input.debtId,
        name: input.command.payload.name,
        current_balance: input.command.payload.principal_amount,
      },
      installments: input.installments,
      loan_movement: null,
      idempotent: false,
    })
  );
});

describe("GET /api/v1/debts", () => {
  it("camino feliz: lista las deudas propias", async () => {
    mocks.listDebts.mockResolvedValue([{ id: DEBT_ID, created_at: "2026-01-01" }]);
    const response = await GET(new Request("http://localhost/api/v1/debts"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.debts).toHaveLength(1);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect(
      (await GET(new Request("http://localhost/api/v1/debts"))).status
    ).toBe(401);
  });

  it("validación: filtro inválido devuelve 400", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/debts?direction=ajena")
    );
    expect(response.status).toBe(400);
  });

  it("aislamiento e idempotencia de lectura: siempre consulta por user_id y no escribe", async () => {
    const request = () => new Request("http://localhost/api/v1/debts");
    await GET(request());
    await GET(request());
    expect(mocks.listDebts).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      USER_ID,
      expect.any(Array),
      expect.any(Object)
    );
    expect(mocks.listDebts).toHaveBeenCalledTimes(2);
    expect(mocks.commitDebtCreation).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/debts", () => {
  it("camino feliz: usa CreateDebtCommand y el commit atómico especializado", async () => {
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.debt.name).toBe("Laptop");
    expect(mocks.commitDebtCreation).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedRelatedPersonName: null,
        command: expect.objectContaining({
          type: "CreateDebtCommand",
          payload: expect.objectContaining({
            installment_count: 3,
            installment_amount: 300,
            idempotency_key: "test-debt-create-key-1",
          }),
        }),
      })
    );
    expect(mocks.refreshDebtLifecycle).toHaveBeenCalled();
    expect(mocks.recordInitialOnboardingValue).toHaveBeenCalled();
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(createRequest())).status).toBe(401);
    expect(mocks.commitDebtCreation).not.toHaveBeenCalled();
  });

  it("cuenta de otro usuario: 404, nunca 403", async () => {
    const response = await POST(
      createRequest({ account_id: ACCOUNT_ID, kind: "personal", installment_count: null, installment_amount: null, next_payment_date: null })
    );
    expect(response.status).toBe(404);
    expect(mocks.commitDebtCreation).not.toHaveBeenCalled();
  });

  it("validación: rechaza total de cuotas fuera de tolerancia", async () => {
    const response = await POST(createRequest({ installment_amount: 250 }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.commitDebtCreation).not.toHaveBeenCalled();
  });

  it("idempotencia: retry devuelve 200 y no repite activaciones", async () => {
    mocks.commitDebtCreation.mockResolvedValue({
      debt: { id: DEBT_ID, name: "Laptop" },
      installments: [],
      loan_movement: null,
      idempotent: true,
    });
    const response = await POST(createRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.meta.idempotent_replay).toBe(true);
    expect(mocks.refreshDebtLifecycle).not.toHaveBeenCalled();
    expect(mocks.recordInitialOnboardingValue).not.toHaveBeenCalled();
  });

  it("idempotencia: la misma key con otro payload devuelve conflicto", async () => {
    mocks.commitDebtCreation.mockRejectedValue(
      new Error("DEBT_CREATION_IDEMPOTENCY_CONFLICT")
    );
    const response = await POST(createRequest({ name: "Otro contrato" }));
    expect(response.status).toBe(409);
  });

  it("exige Idempotency-Key", async () => {
    const request = createRequest();
    request.headers.delete("Idempotency-Key");
    expect((await POST(request)).status).toBe(400);
  });

  it("no revierte el commit si el refresco de ciclo queda para el cron", async () => {
    mocks.refreshDebtLifecycle.mockRejectedValue(new Error("temporary"));
    expect((await POST(createRequest())).status).toBe(201);
  });
});

function createRequest(
  overrides: Record<string, unknown> = {}
): Request {
  return new Request("http://localhost/api/v1/debts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "test-debt-create-key-1",
    },
    body: JSON.stringify({
      direction: "i_owe",
      kind: "installment_purchase",
      name: "Laptop",
      related_person_name: null,
      principal_amount: 900,
      currency: "PEN",
      opened_at: "2026-06-01",
      next_payment_date: "2026-07-02",
      installment_count: 3,
      installment_amount: 300,
      ...overrides,
    }),
  });
}
