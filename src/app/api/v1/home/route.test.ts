import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getActiveAccounts: vi.fn(),
  getActiveBoxes: vi.fn(),
  listUpcomingCommitments: vi.fn(),
  listDebtInstallmentCommitments: vi.fn(),
  listPendingItems: vi.fn(),
  listBudgetsWithProgress: vi.fn(),
  getProjectionSnapshot: vi.fn(),
  getReportPeriod: vi.fn(),
  listDashboardInsights: vi.fn(),
  recordDashboardInsightsDisplayed: vi.fn(),
  listReminders: vi.fn(),
  getHomeHiddenBlocks: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/accounts.repository", () => ({
  getActiveAccounts: mocks.getActiveAccounts,
  getActiveBoxes: mocks.getActiveBoxes,
}));
vi.mock("@/data/repositories/recurring.repository", () => ({ listUpcomingCommitments: mocks.listUpcomingCommitments }));
vi.mock("@/data/repositories/debts.repository", () => ({ listDebtInstallmentCommitments: mocks.listDebtInstallmentCommitments }));
vi.mock("@/data/repositories/pending.repository", () => ({ listPendingItems: mocks.listPendingItems }));
vi.mock("@/data/repositories/budgets.repository", () => ({ listBudgetsWithProgress: mocks.listBudgetsWithProgress }));
vi.mock("@/data/repositories/projections.repository", () => ({ getProjectionSnapshot: mocks.getProjectionSnapshot }));
vi.mock("@/data/repositories/reports.repository", () => ({ getReportPeriod: mocks.getReportPeriod }));
vi.mock("@/data/repositories/insights.repository", () => ({
  listDashboardInsights: mocks.listDashboardInsights,
  recordDashboardInsightsDisplayed: mocks.recordDashboardInsightsDisplayed,
}));
vi.mock("@/data/repositories/reminders.repository", () => ({ listReminders: mocks.listReminders }));
vi.mock("@/data/repositories/home.repository", () => ({ getHomeHiddenBlocks: mocks.getHomeHiddenBlocks }));
vi.mock("@/data/supabase/server", () => ({ createServiceClient: mocks.createServiceClient }));

import { GET } from "./route";

const auth = { userId: "user-1", client: { rls: true } };

function setHappyDefaults() {
  mocks.getApiAuth.mockResolvedValue(auth);
  mocks.getActiveAccounts.mockResolvedValue([]);
  mocks.getActiveBoxes.mockResolvedValue([]);
  mocks.listUpcomingCommitments.mockResolvedValue([]);
  mocks.listDebtInstallmentCommitments.mockResolvedValue([]);
  mocks.listPendingItems.mockResolvedValue([]);
  mocks.listBudgetsWithProgress.mockResolvedValue([]);
  mocks.getProjectionSnapshot.mockResolvedValue({
    projection: { sufficient_data: false, free_money_cents: 0, projection_cents: null },
    situation: {},
    has_pen_accounts: false,
    breakdown: { currency: "PEN", lines: [] },
  });
  mocks.getReportPeriod.mockResolvedValue({
    gastoTotal: 0,
    ingresoTotal: 0,
    gastoMovementCount: 0,
    ingresoMovementCount: 0,
    byCategory: [],
    exclusions: [],
    countedMovementIds: [],
  });
  mocks.listDashboardInsights.mockResolvedValue([]);
  mocks.recordDashboardInsightsDisplayed.mockResolvedValue(undefined);
  mocks.listReminders.mockResolvedValue([]);
  mocks.getHomeHiddenBlocks.mockResolvedValue([]);
  mocks.createServiceClient.mockReturnValue({ service: true });
  auth.client = { from: vi.fn(() => movementsChain(0)) } as unknown as typeof auth.client;
}

// `countConfirmedMovements` termina en `.is()` y `listRecentMovements`
// termina en `.limit()`: la cadena simulada debe resolverse (thenable) en
// cualquiera de los dos puntos, no solo al final de una ruta fija.
function movementsChain(count: number) {
  const result = { data: [], error: null, count };
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (onfulfilled?: (value: typeof result) => unknown, onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}

describe("GET /home — cinco casos (WEB-D230: colección sin recurso identificable)", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    setHappyDefaults();
  });

  it("estado vacío: 0 movimientos confirmados -> state 'vacio'", async () => {
    const res = await GET(new Request("http://localhost/api/v1/home"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.state).toBe("vacio");
    expect(body.data.blocks).toEqual([]);
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/v1/home"));
    expect(res.status).toBe(401);
  });

  it("AC-HOME-12: la respuesta no es cacheable (private, no-store)", async () => {
    const res = await GET(new Request("http://localhost/api/v1/home"));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("WEB-D230: solo usa el userId del cliente autenticado, nunca uno del query", async () => {
    await GET(new Request("http://localhost/api/v1/home?user_id=otro"));
    expect(mocks.getActiveAccounts).toHaveBeenCalledWith(auth.client, "user-1");
    expect(mocks.listReminders).toHaveBeenCalledWith(auth.client, "user-1", { estado: "abiertos" });
  });

  it("idempotente: dos llamadas seguidas devuelven la misma composición sin error", async () => {
    const first = await GET(new Request("http://localhost/api/v1/home"));
    const second = await GET(new Request("http://localhost/api/v1/home"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json()).data).toEqual((await second.json()).data);
  });

  it("RUL-HOME-09: si una fuente falla (presupuestos), el resto de la composición sigue en 200", async () => {
    mocks.listBudgetsWithProgress.mockRejectedValue(new Error("boom"));
    // Con movimientos confirmados para salir de estado vacío.
    auth.client = { from: vi.fn(() => movementsChain(5)) } as unknown as typeof auth.client;

    const res = await GET(new Request("http://localhost/api/v1/home"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.state).toBe("temprano");
    const month = body.data.blocks.find((block: { kind: string }) => block.kind === "month");
    expect(month?.status).toBe("error");
    expect(month?.retryable).toBe(true);
  });

  it("registra el hallazgo mostrado solo cuando hay uno (evita una escritura vacía)", async () => {
    mocks.listDashboardInsights.mockResolvedValue([{ id: "insight-1" }]);
    await GET(new Request("http://localhost/api/v1/home"));
    expect(mocks.recordDashboardInsightsDisplayed).toHaveBeenCalledWith(
      { service: true },
      "user-1",
      ["insight-1"],
      expect.objectContaining({ traceId: expect.any(String) }),
    );
  });
});
