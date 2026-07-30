import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getRecurringRuleById: vi.fn(),
  getRecurringOccurrenceById: vi.fn(),
  getAccountById: vi.fn(),
  commitRecurringPayment: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
}));
vi.mock("@/data/repositories/recurring.repository", () => ({
  getRecurringRuleById: mocks.getRecurringRuleById,
  getRecurringOccurrenceById: mocks.getRecurringOccurrenceById,
  commitRecurringPayment: mocks.commitRecurringPayment,
}));
vi.mock("@/core/finance", () => ({
  buildCreateMovementCommitPayload: vi.fn(
    (command: { payload: { movement: Record<string, unknown> } }) => ({
      movement: {
        id: movementId,
        user_id: userId,
        status: "confirmed",
        idempotency_key: "recurring-payment-key-1",
        ...command.payload.movement,
      },
      auditLogs: [],
      accountDeltas: [],
      boxDeltas: [],
      outboxEvents: [],
    })
  ),
}));

const userId = "00000000-0000-4000-8000-000000000001";
const ruleId = "11111111-1111-4111-8111-111111111111";
const occurrenceId = "22222222-2222-4222-8222-222222222222";
const movementId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId });
  mocks.getRecurringRuleById.mockResolvedValue(rule());
  mocks.getRecurringOccurrenceById.mockResolvedValue(occurrence());
  mocks.getAccountById.mockResolvedValue(null);
  mocks.commitRecurringPayment.mockResolvedValue({
    movement: { id: movementId },
    recurring_rule: rule(),
    occurrence: occurrence({ status: "paid" }),
    idempotent: false,
  });
});

describe("POST recurring occurrence mark-paid", () => {
  it("camino feliz registra el pago por el Core especializado", async () => {
    const response = await POST(request(), context(ruleId, occurrenceId));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.idempotent).toBe(false);
    expect(mocks.commitRecurringPayment).toHaveBeenCalledOnce();
  });

  it("sin sesion devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(request(), context(ruleId, occurrenceId));

    expect(response.status).toBe(401);
    expect(mocks.getRecurringRuleById).not.toHaveBeenCalled();
  });

  it("una regla de otro usuario se oculta como 404", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(null);

    const response = await POST(request(), context(ruleId, occurrenceId));

    expect(response.status).toBe(404);
    expect(mocks.commitRecurringPayment).not.toHaveBeenCalled();
  });

  it("un monto invalido devuelve 400 sin escribir", async () => {
    const response = await POST(
      request({ amount: -1 }),
      context(ruleId, occurrenceId)
    );

    expect(response.status).toBe(400);
    expect(mocks.commitRecurringPayment).not.toHaveBeenCalled();
  });

  it("un retry secuencial de la misma llave llega al Core y vuelve 200", async () => {
    mocks.getRecurringOccurrenceById.mockResolvedValue(
      occurrence({ status: "paid" })
    );
    mocks.getRecurringRuleById.mockResolvedValue(rule({ status: "paused" }));
    mocks.commitRecurringPayment.mockResolvedValue({
      movement: { id: movementId },
      recurring_rule: rule({ status: "paused" }),
      occurrence: occurrence({ status: "paid" }),
      idempotent: true,
    });

    const response = await POST(request(), context(ruleId, occurrenceId));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.idempotent).toBe(true);
    expect(mocks.commitRecurringPayment).toHaveBeenCalledOnce();
  });

  it("rechaza paid_at futuro con ERR-REC-07", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T12:00:00.000-05:00"));

    const response = await POST(
      request({ paid_at: "2026-07-30T12:00:00.000-05:00" }),
      context(ruleId, occurrenceId)
    );

    expect(response.status).toBe(400);
    expect(mocks.commitRecurringPayment).not.toHaveBeenCalled();
  });
});

function request(body: Record<string, unknown> = {}) {
  return new Request(
    `http://localhost/api/v1/recurring/${ruleId}/occurrences/${occurrenceId}/mark-paid`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "recurring-payment-key-1",
      },
      body: JSON.stringify({ amount: 42.5, ...body }),
    }
  );
}

function context(id: string, occurrence_id: string) {
  return { params: Promise.resolve({ id, occurrence_id }) };
}

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: ruleId,
    user_id: userId,
    name: "Internet",
    currency: "PEN",
    status: "active",
    linked_debt_id: null,
    merchant_pattern: null,
    category_id: null,
    subcategory_id: null,
    expected_amount: 42.5,
    ...overrides,
  };
}

function occurrence(overrides: Record<string, unknown> = {}) {
  return {
    id: occurrenceId,
    user_id: userId,
    recurring_rule_id: ruleId,
    status: "expected",
    expected_amount: 42.5,
    expected_date: "2026-07-29",
    ...overrides,
  };
}
