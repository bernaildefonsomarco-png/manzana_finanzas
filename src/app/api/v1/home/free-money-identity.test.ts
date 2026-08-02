import { beforeEach, describe, expect, it, vi } from "vitest";

// `AC-HOME-01`/`RUL-HOME-02`: el dinero libre del Inicio y el de Mi Dinero
// deben ser el mismo número siempre, porque salen de la misma llamada
// (`calculateMoneyLayersForCurrency`, extraída en este corte de
// `/api/v1/money` a `core/finance/money-layers.ts`). Esta prueba llama a
// los dos endpoints con los mismos datos de cuentas/cajas/compromisos y
// compara la cifra, en vez de confiar en la lectura del código.

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

import { GET as GET_HOME } from "./route";
import { GET as GET_MONEY } from "../money/route";

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

const accounts = [
  { id: "acc-1", user_id: "user-1", currency: "PEN", current_balance: 1140, initial_balance: 1140 },
];
const boxes = [{ id: "box-1", account_id: "acc-1", user_id: "user-1", currency: "PEN", current_balance: 500 }];

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue({
    userId: "user-1",
    client: { from: vi.fn(() => movementsChain(30)) },
  });
  mocks.getActiveAccounts.mockResolvedValue(accounts);
  mocks.getActiveBoxes.mockResolvedValue(boxes);
  mocks.listUpcomingCommitments.mockResolvedValue([]);
  mocks.listDebtInstallmentCommitments.mockResolvedValue([]);
  mocks.listPendingItems.mockResolvedValue([]);
  mocks.listBudgetsWithProgress.mockResolvedValue([]);
  mocks.getProjectionSnapshot.mockResolvedValue({
    projection: { sufficient_data: false, free_money_cents: 0, projection_cents: null },
    situation: {},
    has_pen_accounts: true,
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
  mocks.listReminders.mockResolvedValue([]);
  mocks.getHomeHiddenBlocks.mockResolvedValue([]);
  mocks.createServiceClient.mockReturnValue({ service: true });
});

describe("AC-HOME-01: el dinero libre del Inicio es idéntico al de Mi Dinero", () => {
  it("con las mismas cuentas/cajas/compromisos, GET /home y GET /money devuelven el mismo dinero libre", async () => {
    const moneyRes = await GET_MONEY(new Request("http://localhost/api/v1/money"));
    const moneyBody = await moneyRes.json();

    const homeRes = await GET_HOME(new Request("http://localhost/api/v1/home"));
    const homeBody = await homeRes.json();

    const freeMoneyBlock = homeBody.data.blocks.find((block: { kind: string }) => block.kind === "free_money");

    expect(moneyBody.data.operational_free_money).toBe(640);
    expect(freeMoneyBlock.data.free_balance).toBe(640);
    expect(freeMoneyBlock.data.free_balance).toBe(moneyBody.data.operational_free_money);
    expect(freeMoneyBlock.data.total_balance).toBe(moneyBody.data.total_balance);
    expect(freeMoneyBlock.data.separated_balance).toBe(moneyBody.data.separated_in_boxes);
  });
});
