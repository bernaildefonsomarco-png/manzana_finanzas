import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const DEBT_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getApiAuth: vi.fn(),
  getDebtById: vi.fn(),
  reopenDebt: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/debts.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/data/repositories/debts.repository")>();
  return {
    ...actual,
    getDebtById: mocks.getDebtById,
    reopenDebt: mocks.reopenDebt,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.getDebtById.mockResolvedValue({
    id: DEBT_ID,
    status: "cancelled",
    current_balance: 0,
    metadata: { forgiven_balance: 80 },
  });
  mocks.createServiceClient.mockReturnValue({});
  mocks.reopenDebt.mockResolvedValue({
    debt: { id: DEBT_ID, status: "active", current_balance: 80 },
    idempotent: false,
  });
});

describe("POST /api/v1/debts/[id]/reopen", () => {
  it("camino feliz: reabre condonada restaurando el saldo", async () => {
    const response = await POST(request(), context());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.debt).toMatchObject({ status: "active", current_balance: 80 });
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(request(), context())).status).toBe(401);
  });

  it("deuda de otro usuario: 404, nunca 403", async () => {
    mocks.getDebtById.mockResolvedValue(null);
    expect((await POST(request(), context())).status).toBe(404);
  });

  it("validación: id inválido devuelve 400", async () => {
    expect(
      (
        await POST(request(), {
          params: Promise.resolve({ id: "no-uuid" }),
        })
      ).status
    ).toBe(400);
  });

  it("idempotencia: retry se marca como replay", async () => {
    mocks.reopenDebt.mockResolvedValue({
      debt: { id: DEBT_ID, status: "active", current_balance: 80 },
      idempotent: true,
    });
    const body = await (await POST(request(), context())).json();
    expect(body.meta.idempotent_replay).toBe(true);
  });
});

function request() {
  return new Request(`http://localhost/api/v1/debts/${DEBT_ID}/reopen`, {
    method: "POST",
    headers: { "idempotency-key": "reopen-debt-123" },
  });
}

function context() {
  return { params: Promise.resolve({ id: DEBT_ID }) };
}
