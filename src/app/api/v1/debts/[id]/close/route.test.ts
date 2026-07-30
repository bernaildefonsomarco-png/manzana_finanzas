import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const DEBT_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  closeDebt: vi.fn(),
  createServiceClient: vi.fn(),
  getApiAuth: vi.fn(),
  getDebtById: vi.fn(),
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
    closeDebt: mocks.closeDebt,
    getDebtById: mocks.getDebtById,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.getDebtById.mockResolvedValue({
    id: DEBT_ID,
    status: "active",
    current_balance: 80,
    metadata: {},
  });
  mocks.createServiceClient.mockReturnValue({});
  mocks.closeDebt.mockResolvedValue({
    debt: {
      id: DEBT_ID,
      status: "cancelled",
      current_balance: 0,
      metadata: { forgiven_balance: 80 },
    },
    idempotent: false,
  });
});

describe("POST /api/v1/debts/[id]/close", () => {
  it("camino feliz: condona explícitamente y conserva el saldo perdonado", async () => {
    const response = await POST(request("forgiven"), context());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.debt).toMatchObject({
      status: "cancelled",
      current_balance: 0,
      metadata: { forgiven_balance: 80 },
    });
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(request("forgiven"), context())).status).toBe(401);
  });

  it("deuda de otro usuario: 404, nunca 403", async () => {
    mocks.getDebtById.mockResolvedValue(null);
    expect((await POST(request("forgiven"), context())).status).toBe(404);
  });

  it("validación: exige paid o forgiven", async () => {
    expect((await POST(request("silencioso"), context())).status).toBe(400);
    expect(mocks.closeDebt).not.toHaveBeenCalled();
  });

  it("idempotencia: retry se marca como replay", async () => {
    mocks.closeDebt.mockResolvedValue({
      debt: { id: DEBT_ID, status: "cancelled", current_balance: 0 },
      idempotent: true,
    });
    const body = await (await POST(request("forgiven"), context())).json();
    expect(body.meta.idempotent_replay).toBe(true);
  });
});

function request(reason: string) {
  return new Request(`http://localhost/api/v1/debts/${DEBT_ID}/close`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "close-debt-123",
    },
    body: JSON.stringify({ reason }),
  });
}

function context() {
  return { params: Promise.resolve({ id: DEBT_ID }) };
}
