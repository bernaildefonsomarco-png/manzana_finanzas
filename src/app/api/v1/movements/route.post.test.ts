import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryFinancialCoreRepository } from "@/core/finance/in-memory-repository";
import { POST } from "./route";

const userId = "22222222-2222-4222-8222-222222222222";

let repo: InMemoryFinancialCoreRepository;

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(),
  evaluateCrossChannelDedup: vi.fn(),
  validateMovementClassificationReferences: vi.fn(),
  classificationDispatch: vi.fn(),
  getDebtById: vi.fn(),
  commitDebtCreation: vi.fn(),
  getDebtCreationAccount: vi.fn(),
  findDebtPaymentByIdempotencyKey: vi.fn(),
  commitDebtPayment: vi.fn(),
  getDebtPaymentAccount: vi.fn(),
  listDebtInstallments: vi.fn(),
  refreshLifecycle: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/movements.repository", () => ({
  SupabaseFinancialCoreRepository: function SupabaseFinancialCoreRepository() {
    return repo;
  },
}));

vi.mock("@/core/dedup", () => ({
  evaluateCrossChannelDedup: mocks.evaluateCrossChannelDedup,
}));

vi.mock("@/data/repositories/classification.repository", () => ({
  validateMovementClassificationReferences:
    mocks.validateMovementClassificationReferences,
}));

vi.mock("@/core/classification", () => ({
  ClassificationCommandDispatcher: class {
    dispatch(command: unknown) {
      return mocks.classificationDispatch(command);
    }
  },
}));

vi.mock("@/data/repositories/debts.repository", () => ({
  getDebtById: mocks.getDebtById,
}));

vi.mock("@/data/repositories/debt-creation-command.repository", () => ({
  SupabaseDebtCreationExecutionPort: function SupabaseDebtCreationExecutionPort(
    this: unknown,
    client: unknown,
  ) {
    return {
      getAccount: (uid: string, accountId: string) =>
        mocks.getDebtCreationAccount(client, uid, accountId),
      commit: (input: unknown) => mocks.commitDebtCreation(client, input),
    };
  },
}));

vi.mock("@/data/repositories/debt-payment-command.repository", () => ({
  SupabaseDebtPaymentExecutionPort: function SupabaseDebtPaymentExecutionPort(
    this: unknown,
    readClient: unknown,
    writeClient: unknown,
  ) {
    return {
      findByIdempotencyKey: (uid: string, key: string) =>
        mocks.findDebtPaymentByIdempotencyKey(uid, key),
      getDebt: (uid: string, debtId: string) =>
        mocks.getDebtById(readClient, uid, debtId),
      getAccount: (uid: string, accountId: string) =>
        mocks.getDebtPaymentAccount(readClient, uid, accountId),
      listInstallments: (uid: string, debtId: string) =>
        mocks.listDebtInstallments(readClient, uid, debtId),
      commit: (input: unknown) => mocks.commitDebtPayment(writeClient, input),
      refreshLifecycle: (uid: string, traceId: string) =>
        mocks.refreshLifecycle(writeClient, uid, traceId),
    };
  },
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  repo = new InMemoryFinancialCoreRepository();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId });
  mocks.createServiceClient.mockReturnValue({});
  mocks.evaluateCrossChannelDedup.mockResolvedValue({
    decision: null,
    candidate_count: 0,
    semantic_agent_status: "not_applicable",
    semantic_agent_provider: null,
    semantic_agent_model: null,
    semantic_agent_latency_ms: null,
  });
  mocks.validateMovementClassificationReferences.mockResolvedValue(undefined);
  mocks.listDebtInstallments.mockResolvedValue([]);
  mocks.refreshLifecycle.mockResolvedValue(undefined);
});

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/movements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "test-idempotency-key-1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function gastoBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "gasto",
    amount: 40,
    occurred_at: "2026-07-14T19:20:00-05:00",
    description: "Cafe",
    category_id: "alimentacion",
    ...overrides,
  };
}

describe("POST /api/v1/movements — camino generico", () => {
  it("camino feliz: crea un gasto", async () => {
    const response = await POST(postRequest(gastoBody()));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.movement.type).toBe("gasto");
    expect(payload.data.movement.amount).toBe(40);
  });

  it("sin sesion: responde 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await POST(postRequest(gastoBody()));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("AUTH_REQUIRED");
  });

  it("recurso de otro usuario: una subcategoria ajena se rechaza (nunca se filtra en silencio)", async () => {
    mocks.validateMovementClassificationReferences.mockRejectedValue(
      new Error("No encontre esa subcategoria."),
    );
    const response = await POST(
      postRequest(
        gastoBody({
          subcategory_id: "33333333-3333-4333-8333-333333333333",
        }),
      ),
    );

    expect(response.status).toBe(500);
    expect(
      mocks.validateMovementClassificationReferences,
    ).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        subcategoryId: "33333333-3333-4333-8333-333333333333",
      }),
    );
  });

  it("validacion: rechaza un campo prohibido para el tipo (ERR-MOV-06)", async () => {
    const response = await POST(
      postRequest(gastoBody({ account_destination_id: crypto.randomUUID() })),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
  });

  it("RUL-MOV-10/ERR-MOV-08: una fecha futura se rechaza y ofrece Pagos que vienen", async () => {
    const unaSemanaDespues = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const response = await POST(postRequest(gastoBody({ occurred_at: unaSemanaDespues })));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.details.reason).toBe("future_date");
  });

  it("idempotencia: repetir la misma clave devuelve el resultado original sin duplicar", async () => {
    const first = await POST(postRequest(gastoBody()));
    const firstPayload = await first.json();
    expect(first.status).toBe(201);

    const second = await POST(postRequest(gastoBody()));
    const secondPayload = await second.json();

    expect(second.status).toBe(200);
    expect(secondPayload.data.movement.id).toBe(firstPayload.data.movement.id);
    expect(repo.movements.size).toBe(1);
  });

  it("ajuste con monto negativo se guarda correctamente de punta a punta (WEB-D197, ejemplo: S/100 -> S/85)", async () => {
    const accountId = crypto.randomUUID();
    repo.accountBalances.set(accountId, 100);

    const response = await POST(
      postRequest({
        type: "ajuste",
        amount: -15,
        occurred_at: "2026-07-14T19:20:00-05:00",
        account_destination_id: accountId,
        metadata: { reason: "conte mal el efectivo" },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.movement.amount).toBe(-15);
    expect(repo.accountBalances.get(accountId)).toBe(85);
  });
});

describe("POST /api/v1/movements — creacion de deuda (deuda_adquirida, prestamo_dado, prestamo_recibido)", () => {
  function debtOriginationCommitResult(overrides: Record<string, unknown> = {}) {
    return {
      debt: {
        id: "44444444-4444-4444-8444-444444444444",
        direction: "i_owe",
      },
      installments: [],
      loan_movement: null,
      idempotent: false,
      ...overrides,
    };
  }

  it("camino feliz: crea una deuda_adquirida sin cuenta (WEB-D198)", async () => {
    mocks.commitDebtCreation.mockResolvedValue(debtOriginationCommitResult());

    const response = await POST(
      postRequest({
        type: "deuda_adquirida",
        amount: 500,
        occurred_at: "2026-07-14T19:20:00-05:00",
        related_person_name: "Tienda X",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.debt.id).toBe("44444444-4444-4444-8444-444444444444");
    expect(payload.data.movement).toBeNull();
    expect(mocks.commitDebtCreation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        command: expect.objectContaining({
          payload: expect.objectContaining({
            direction: "i_owe",
            movement_type: "deuda_adquirida",
            account_id: null,
          }),
        }),
      }),
    );
  });

  it("RUL-MOV-08: 23:30 hora de Lima queda con la fecha de ese dia en opened_at", async () => {
    mocks.commitDebtCreation.mockResolvedValue(debtOriginationCommitResult());

    await POST(
      postRequest({
        type: "deuda_adquirida",
        amount: 500,
        // 23:30 del 14 de julio en Lima (UTC-5) es 2026-07-15T04:30:00Z.
        occurred_at: "2026-07-14T23:30:00-05:00",
        related_person_name: "Tienda X",
      }),
    );

    expect(mocks.commitDebtCreation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        command: expect.objectContaining({
          payload: expect.objectContaining({ opened_at: "2026-07-14" }),
        }),
      }),
    );
  });

  it("sin sesion: responde 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await POST(
      postRequest({
        type: "prestamo_dado",
        amount: 200,
        occurred_at: "2026-07-14T19:20:00-05:00",
        related_person_name: "Luis",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("validacion: rechaza deuda_adquirida con cuenta (no hay efectivo de por medio)", async () => {
    const response = await POST(
      postRequest({
        type: "deuda_adquirida",
        amount: 500,
        occurred_at: "2026-07-14T19:20:00-05:00",
        related_person_name: "Tienda X",
        account_id: crypto.randomUUID(),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.commitDebtCreation).not.toHaveBeenCalled();
  });

  it("RUL-MOV-10/ERR-MOV-08: una deuda con fecha futura tambien se rechaza", async () => {
    const unaSemanaDespues = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const response = await POST(
      postRequest({
        type: "deuda_adquirida",
        amount: 500,
        occurred_at: unaSemanaDespues,
        related_person_name: "Tienda X",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.details.reason).toBe("future_date");
    expect(mocks.commitDebtCreation).not.toHaveBeenCalled();
  });

  it("idempotencia: repetir la misma clave devuelve la deuda original", async () => {
    mocks.commitDebtCreation.mockResolvedValueOnce(
      debtOriginationCommitResult(),
    );
    mocks.commitDebtCreation.mockResolvedValueOnce(
      debtOriginationCommitResult({ idempotent: true }),
    );

    const body = {
      type: "prestamo_dado",
      amount: 300,
      occurred_at: "2026-07-14T19:20:00-05:00",
      related_person_name: "Luis",
      account_id: crypto.randomUUID(),
    };
    mocks.getDebtCreationAccount.mockResolvedValue({
      id: body.account_id,
      currency: "PEN",
    });

    const first = await POST(postRequest(body));
    expect(first.status).toBe(201);

    const second = await POST(postRequest(body));
    const secondPayload = await second.json();
    expect(second.status).toBe(200);
    expect(secondPayload.data.idempotent).toBe(true);
  });

  it("prestamo_dado con cuenta valida crea tambien el movimiento vinculado", async () => {
    const accountId = crypto.randomUUID();
    mocks.getDebtCreationAccount.mockResolvedValue({
      id: accountId,
      currency: "PEN",
    });
    mocks.commitDebtCreation.mockResolvedValue(
      debtOriginationCommitResult({
        debt: { id: "55555555-5555-4555-8555-555555555555", direction: "they_owe_me" },
        loan_movement: {
          id: "66666666-6666-4666-8666-666666666666",
          type: "prestamo_dado",
        },
      }),
    );

    const response = await POST(
      postRequest({
        type: "prestamo_dado",
        amount: 300,
        occurred_at: "2026-07-14T19:20:00-05:00",
        related_person_name: "Luis",
        account_id: accountId,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.movement).toMatchObject({ type: "prestamo_dado" });
    expect(mocks.commitDebtCreation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        movementCommit: expect.objectContaining({
          movement: expect.objectContaining({ type: "prestamo_dado" }),
        }),
      }),
    );
  });
});

describe("POST /api/v1/movements — pago de deuda (pago_deuda, devolucion_recibida)", () => {
  function debtFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: "77777777-7777-4777-8777-777777777777",
      user_id: userId,
      direction: "i_owe",
      current_balance: 100,
      currency: "PEN",
      status: "active",
      name: "Deuda de prueba",
      related_person_id: null,
      ...overrides,
    };
  }

  function paymentBody(overrides: Record<string, unknown> = {}) {
    return {
      type: "pago_deuda",
      debt_id: "77777777-7777-4777-8777-777777777777",
      amount: 30,
      occurred_at: "2026-07-14T19:20:00-05:00",
      ...overrides,
    };
  }

  it("camino feliz: registra un pago de deuda", async () => {
    mocks.getDebtById.mockResolvedValue(debtFixture());
    mocks.findDebtPaymentByIdempotencyKey.mockResolvedValue(null);
    mocks.commitDebtPayment.mockResolvedValue({
      movement: { id: "88888888-8888-4888-8888-888888888888", type: "pago_deuda" },
      debt: debtFixture({ current_balance: 70 }),
      payment: { id: "99999999-9999-4999-8999-999999999999", amount: 30 },
      installment_allocations: [],
      allocation_policy: "oldest_open_due_date_first_v1",
      idempotent: false,
    });

    const response = await POST(postRequest(paymentBody()));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.movement.type).toBe("pago_deuda");
    expect(payload.data.debt.current_balance).toBe(70);
  });

  it("sin sesion: responde 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await POST(postRequest(paymentBody()));
    expect(response.status).toBe(401);
    expect(mocks.getDebtById).not.toHaveBeenCalled();
  });

  it("recurso de otro usuario: una deuda ajena responde 404, nunca 403", async () => {
    mocks.getDebtById.mockResolvedValue(null);
    const response = await POST(postRequest(paymentBody()));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(mocks.commitDebtPayment).not.toHaveBeenCalled();
  });

  it("validacion: el tipo elegido no coincide con la direccion real de la deuda", async () => {
    mocks.getDebtById.mockResolvedValue(debtFixture({ direction: "they_owe_me" }));

    const response = await POST(postRequest(paymentBody({ type: "pago_deuda" })));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.commitDebtPayment).not.toHaveBeenCalled();
  });

  it("idempotencia: repetir la misma clave devuelve el pago original", async () => {
    mocks.getDebtById.mockResolvedValue(debtFixture());
    mocks.findDebtPaymentByIdempotencyKey.mockResolvedValueOnce(null);
    const committed = {
      movement: {
        id: "88888888-8888-4888-8888-888888888888",
        type: "pago_deuda",
        account_origin_id: null,
        account_destination_id: null,
      },
      debt: debtFixture({ current_balance: 70 }),
      payment: {
        id: "99999999-9999-4999-8999-999999999999",
        debt_id: "77777777-7777-4777-8777-777777777777",
        amount: 30,
        currency: "PEN",
        paid_at: "2026-07-14T19:20:00-05:00",
        source: "dashboard_manual",
        metadata: {
          note: null,
          installment_id: null,
          installment_number: null,
        },
      },
      installment_allocations: [],
      allocation_policy: "oldest_open_due_date_first_v1",
      idempotent: false,
    };
    mocks.commitDebtPayment.mockResolvedValue(committed);

    const first = await POST(postRequest(paymentBody()));
    expect(first.status).toBe(201);

    mocks.findDebtPaymentByIdempotencyKey.mockResolvedValueOnce({
      ...committed,
      idempotent: true,
    });
    const second = await POST(postRequest(paymentBody()));
    const secondPayload = await second.json();

    expect(second.status).toBe(200);
    expect(secondPayload.data.idempotent).toBe(true);
    expect(mocks.commitDebtPayment).toHaveBeenCalledTimes(1);
  });
});
