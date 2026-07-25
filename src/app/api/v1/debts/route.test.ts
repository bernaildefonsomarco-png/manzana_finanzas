import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createDebt: vi.fn(),
  createServiceClient: vi.fn(),
  getApiAuth: vi.fn(),
  recordInitialOnboardingValue: vi.fn(),
  refreshDebtLifecycle: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/debts.repository", () => ({
  createDebt: mocks.createDebt,
  listDebts: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refreshDebtLifecycle.mockResolvedValue({
    lifecycle: {},
    nudges: null,
    timezone: "America/Lima",
  });
  mocks.recordInitialOnboardingValue.mockResolvedValue({ changed: true });
});

describe("debt create route", () => {
  it("refresca el ciclo durable despues de crear las cuotas", async () => {
    const serviceClient = {};
    const userId = "11111111-1111-4111-8111-111111111111";
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId });
    mocks.createServiceClient.mockReturnValue(serviceClient);
    mocks.createDebt.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Laptop",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/debts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          direction: "i_owe",
          kind: "installment_purchase",
          name: "Laptop",
          principal_amount: 900,
          currency: "PEN",
          next_payment_date: "2026-07-02",
          installment_count: 3,
          installment_amount: 300,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.refreshDebtLifecycle).toHaveBeenCalledWith(
      serviceClient,
      userId,
      { traceId: expect.any(String) }
    );
    expect(mocks.recordInitialOnboardingValue).toHaveBeenCalledWith(
      serviceClient,
      {
        userId,
        trigger: "debt_created",
        source: "dashboard_debts",
        traceId: expect.any(String),
      }
    );
  });

  it("no revierte una deuda creada si la proyeccion queda para el cron", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: {},
      userId: "11111111-1111-4111-8111-111111111111",
    });
    mocks.createServiceClient.mockReturnValue({});
    mocks.createDebt.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Laptop",
    });
    mocks.refreshDebtLifecycle.mockRejectedValue(new Error("temporary"));

    const response = await POST(
      new Request("http://localhost/api/v1/debts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          direction: "i_owe",
          kind: "personal",
          name: "Laptop",
          principal_amount: 900,
          currency: "PEN",
        }),
      })
    );

    expect(response.status).toBe(201);
  });
});
