import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshDebtLifecycle } from "./debt-lifecycle-service";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  refreshDebtInstallmentLifecycle: vi.fn(),
  evaluateDashboardNudges: vi.fn(),
}));

vi.mock("@/data/repositories/profiles.repository", () => ({
  getProfile: mocks.getProfile,
}));

vi.mock("@/data/repositories/debts.repository", () => ({
  refreshDebtInstallmentLifecycle: mocks.refreshDebtInstallmentLifecycle,
}));

vi.mock("@/data/repositories/nudges.repository", () => ({
  evaluateDashboardNudges: mocks.evaluateDashboardNudges,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProfile.mockResolvedValue({ timezone: "America/Lima" });
  mocks.refreshDebtInstallmentLifecycle.mockResolvedValue({
    as_of_date: "2026-07-01",
    due_soon_days: 3,
    installments_scanned: 2,
    installments_updated: 1,
    debts_scanned: 1,
    debts_updated: 1,
    events_created: 2,
    transitions: [],
  });
  mocks.evaluateDashboardNudges.mockResolvedValue({
    generated: 1,
    inserted: 1,
    updated: 0,
    skipped: 0,
    expired: 0,
    candidates: [],
  });
});

describe("refreshDebtLifecycle", () => {
  it("usa la fecha local y sincroniza avisos despues del RPC Core", async () => {
    const result = await refreshDebtLifecycle(
      {} as never,
      "11111111-1111-4111-8111-111111111111",
      {
        now: new Date("2026-07-02T02:00:00.000Z"),
        traceId: "22222222-2222-4222-8222-222222222222",
      }
    );

    expect(mocks.refreshDebtInstallmentLifecycle).toHaveBeenCalledWith(
      {},
      {
        userId: "11111111-1111-4111-8111-111111111111",
        asOfDate: "2026-07-01",
        dueSoonDays: 3,
        traceId: "22222222-2222-4222-8222-222222222222",
      }
    );
    expect(mocks.evaluateDashboardNudges).toHaveBeenCalledAfter(
      mocks.refreshDebtInstallmentLifecycle
    );
    expect(result.timezone).toBe("America/Lima");
  });

  it("puede ejecutar solo la proyeccion durable", async () => {
    await refreshDebtLifecycle(
      {} as never,
      "11111111-1111-4111-8111-111111111111",
      {
        asOfDate: "2026-07-01",
        evaluateNudges: false,
      }
    );

    expect(mocks.evaluateDashboardNudges).not.toHaveBeenCalled();
  });
});
