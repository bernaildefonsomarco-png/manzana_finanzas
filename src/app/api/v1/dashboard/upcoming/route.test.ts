import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listDebtInstallmentCommitments: vi.fn(),
  listRecurringDashboard: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/debts.repository", () => ({
  listDebtInstallmentCommitments: mocks.listDebtInstallmentCommitments,
}));

vi.mock("@/data/repositories/recurring.repository", () => ({
  listRecurringDashboard: mocks.listRecurringDashboard,
  sortRecurringRulesByNextExpectedDate: (rules: unknown[]) => rules,
}));

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.listDebtInstallmentCommitments.mockReset();
  mocks.listRecurringDashboard.mockReset();
});

describe("upcoming dashboard route", () => {
  it("rechaza la lectura sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/dashboard/upcoming")
    );

    expect(response.status).toBe(401);
    expect(mocks.listRecurringDashboard).not.toHaveBeenCalled();
    expect(mocks.listDebtInstallmentCommitments).not.toHaveBeenCalled();
  });

  it("combina recurrentes y cuotas de deuda sin escribir finanzas", async () => {
    const client = {};
    const userId = "22222222-2222-4222-8222-222222222222";
    mocks.getApiAuth.mockResolvedValue({ client, userId });
    mocks.listRecurringDashboard.mockResolvedValue({
      rules: [{ id: "recurring-1", name: "Internet" }],
      candidates: [],
    });
    mocks.listDebtInstallmentCommitments.mockResolvedValue([
      {
        id: "installment-1",
        installment_id: "installment-1",
        debt_id: "debt-1",
        title: "Cuota 1: Juan",
        amount: 100,
        currency: "PEN",
        due_at: "2026-06-30",
        kind: "debt",
        linked_box_id: null,
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/v1/dashboard/upcoming")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.rules[0].name).toBe("Internet");
    expect(payload.data.debt_installments[0].title).toBe("Cuota 1: Juan");
    expect(mocks.listRecurringDashboard).toHaveBeenCalledWith(client, userId);
    expect(mocks.listDebtInstallmentCommitments).toHaveBeenCalledWith(
      client,
      userId
    );
  });
});
