import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listRecurringDashboard: vi.fn(),
  listUpcomingCommitments: vi.fn(),
  listDebtInstallmentCommitments: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/recurring.repository", () => ({
  listRecurringDashboard: mocks.listRecurringDashboard,
  listUpcomingCommitments: mocks.listUpcomingCommitments,
  sortRecurringRulesByNextExpectedDate: (rules: unknown[]) => rules,
}));
vi.mock("@/data/repositories/debts.repository", () => ({
  listDebtInstallmentCommitments: mocks.listDebtInstallmentCommitments,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.listRecurringDashboard.mockResolvedValue({
    rules: [
      { id: "rule-1", linked_debt_id: null },
      { id: "rule-debt", linked_debt_id: "debt-1" },
    ],
    candidates: [{ id: "candidate-1" }],
  });
  mocks.listUpcomingCommitments.mockResolvedValue([
    {
      id: "occurrence-1",
      kind: "recurring",
      due_at: "2026-07-10",
      recurring_rule_id: "rule-1",
      occurrence_id: "occurrence-1",
      linked_debt_id: null,
    },
  ]);
  mocks.listDebtInstallmentCommitments.mockResolvedValue([
    {
      id: "installment-1",
      kind: "debt",
      due_at: "2026-07-11",
      debt_id: "debt-1",
      installment_id: "installment-1",
    },
  ]);
});

describe("GET /api/v1/upcoming", () => {
  it("camino feliz unifica y ordena compromisos sin doble conteo", async () => {
    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.commitments.map((item: { id: string }) => item.id)).toEqual([
      "occurrence-1",
      "installment-1",
    ]);
    expect(payload.data.recurring_rules).toHaveLength(1);
    expect(payload.data.horizon_days).toBe(30);
    expect(payload.data.timezone).toBe("America/Lima");
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.listRecurringDashboard).not.toHaveBeenCalled();
  });

  it("colección propia vacía responde 200; no hay id ajeno que revelar", async () => {
    mocks.listRecurringDashboard.mockResolvedValue({
      rules: [],
      candidates: [],
    });
    mocks.listUpcomingCommitments.mockResolvedValue([]);
    mocks.listDebtInstallmentCommitments.mockResolvedValue([]);

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.commitments).toEqual([]);
  });

  it("validación rechaza filtros no documentados", async () => {
    const response = await GET(request("?horizon_days=90"));

    expect(response.status).toBe(400);
    expect(mocks.listRecurringDashboard).not.toHaveBeenCalled();
  });

  it("idempotencia de GET y número fijo de consultas, sin N+1", async () => {
    const first = await GET(request());
    const second = await GET(request());
    const firstPayload = await first.json();
    const secondPayload = await second.json();

    expect(firstPayload.data).toEqual(secondPayload.data);
    expect(mocks.listRecurringDashboard).toHaveBeenCalledTimes(2);
    expect(mocks.listUpcomingCommitments).toHaveBeenCalledTimes(2);
    expect(mocks.listDebtInstallmentCommitments).toHaveBeenCalledTimes(2);
  });
});

function request(query = "") {
  return new Request(`http://localhost/api/v1/upcoming${query}`);
}
