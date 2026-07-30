import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as pause } from "./pause/route";
import { POST as resume } from "./resume/route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getRecurringRuleById: vi.fn(),
  updateRecurringRule: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/recurring.repository", () => ({
  getRecurringRuleById: mocks.getRecurringRuleById,
  updateRecurringRule: mocks.updateRecurringRule,
}));

const id = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.getRecurringRuleById.mockResolvedValue(recurringRule("active"));
  mocks.updateRecurringRule.mockResolvedValue(recurringRule("paused"));
});

describe.each([
  ["pause", pause, "active", "paused"],
  ["resume", resume, "paused", "active"],
] as const)("POST recurring status action: %s", (_name, action, from, to) => {
  it("camino feliz cambia solo el estado de la regla propia", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(recurringRule(from));
    mocks.updateRecurringRule.mockResolvedValue(recurringRule(to));

    const response = await action(request(), context(id));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.idempotent).toBe(false);
    expect(mocks.updateRecurringRule).toHaveBeenCalledWith(
      {},
      "user-1",
      id,
      expect.objectContaining({ status: to })
    );
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await action(request(), context(id));

    expect(response.status).toBe(401);
    expect(mocks.getRecurringRuleById).not.toHaveBeenCalled();
  });

  it("recurso de otro usuario se oculta como 404", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(null);

    const response = await action(request(), context(id));

    expect(response.status).toBe(404);
    expect(mocks.updateRecurringRule).not.toHaveBeenCalled();
  });

  it("id inválido devuelve VALIDATION_ERROR", async () => {
    const response = await action(request(), context("no-es-uuid"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
  });

  it("repetir el estado objetivo es idempotente y no vuelve a escribir", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(recurringRule(to));

    const response = await action(request(), context(id));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.idempotent).toBe(true);
    expect(mocks.updateRecurringRule).not.toHaveBeenCalled();
  });
});

function request() {
  return new Request(`http://localhost/api/v1/recurring/${id}`, {
    method: "POST",
  });
}

function context(value: string) {
  return { params: Promise.resolve({ id: value }) };
}

function recurringRule(status: "active" | "paused") {
  return {
    id,
    user_id: "user-1",
    status,
    metadata: {},
    occurrences: [],
  };
}
