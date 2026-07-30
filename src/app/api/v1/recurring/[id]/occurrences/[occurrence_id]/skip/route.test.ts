import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getRecurringRuleById: vi.fn(),
  getRecurringOccurrenceById: vi.fn(),
  skipRecurringOccurrence: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  assertSystemActionAllowed: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/core/risk/system-action-gate", () => ({
  assertSystemActionAllowed: mocks.assertSystemActionAllowed,
}));
vi.mock("@/data/repositories/recurring.repository", () => ({
  getRecurringRuleById: mocks.getRecurringRuleById,
  getRecurringOccurrenceById: mocks.getRecurringOccurrenceById,
  skipRecurringOccurrence: mocks.skipRecurringOccurrence,
}));

const id = "11111111-1111-4111-8111-111111111111";
const occurrenceId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.getRecurringRuleById.mockResolvedValue({ id });
  mocks.getRecurringOccurrenceById.mockResolvedValue(occurrence("expected"));
  mocks.skipRecurringOccurrence.mockResolvedValue({
    occurrence: occurrence("skipped"),
    recurring_rule: { id, next_expected_date: "2026-09-10" },
    idempotent: false,
  });
});

describe("POST recurring occurrence skip", () => {
  it("camino feliz omite una ocurrencia sin registrar movimiento", async () => {
    const response = await POST(request(), context(id, occurrenceId));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.idempotent).toBe(false);
    expect(mocks.skipRecurringOccurrence).toHaveBeenCalledOnce();
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(request(), context(id, occurrenceId));

    expect(response.status).toBe(401);
    expect(mocks.getRecurringRuleById).not.toHaveBeenCalled();
  });

  it("ocurrencia ajena o de otra regla se oculta como 404", async () => {
    mocks.getRecurringOccurrenceById.mockResolvedValue({
      ...occurrence("expected"),
      recurring_rule_id: "33333333-3333-4333-8333-333333333333",
    });

    const response = await POST(request(), context(id, occurrenceId));

    expect(response.status).toBe(404);
    expect(mocks.skipRecurringOccurrence).not.toHaveBeenCalled();
  });

  it("id inválido devuelve VALIDATION_ERROR", async () => {
    const response = await POST(
      request(),
      context(id, "ocurrencia-invalida")
    );

    expect(response.status).toBe(400);
    expect(mocks.skipRecurringOccurrence).not.toHaveBeenCalled();
  });

  it("repetir skip delega al Core y vuelve idempotente sin otro efecto", async () => {
    mocks.getRecurringOccurrenceById.mockResolvedValue(occurrence("skipped"));
    mocks.skipRecurringOccurrence.mockResolvedValue({
      occurrence: occurrence("skipped"),
      recurring_rule: { id, next_expected_date: "2026-09-10" },
      idempotent: true,
    });

    const response = await POST(request(), context(id, occurrenceId));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.idempotent).toBe(true);
    expect(mocks.skipRecurringOccurrence).toHaveBeenCalledOnce();
  });
});

function request() {
  return new Request(
    `http://localhost/api/v1/recurring/${id}/occurrences/${occurrenceId}/skip`,
    { method: "POST" }
  );
}

function context(ruleId: string, itemId: string) {
  return {
    params: Promise.resolve({ id: ruleId, occurrence_id: itemId }),
  };
}

function occurrence(status: "expected" | "skipped") {
  return {
    id: occurrenceId,
    recurring_rule_id: id,
    status,
    metadata: {},
  };
}
