import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";

const DEBT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getApiAuth: vi.fn(),
  getDebtById: vi.fn(),
  getDebtDetailById: vi.fn(),
  updateDebtBasics: vi.fn(),
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
    getDebtDetailById: mocks.getDebtDetailById,
    updateDebtBasics: mocks.updateDebtBasics,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.createServiceClient.mockReturnValue({});
  mocks.getDebtById.mockResolvedValue(debt());
  mocks.getDebtDetailById.mockResolvedValue({ ...debt(), payments: [] });
  mocks.updateDebtBasics.mockImplementation(
    async (_client, _userId, _debtId, patch) => ({ ...debt(), ...patch })
  );
});

describe("GET /api/v1/debts/[id]", () => {
  it("camino feliz: devuelve detalle y pagos propios", async () => {
    const response = await GET(request(), context());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.debt.name).toBe("Préstamo con Luis");
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(request(), context())).status).toBe(401);
  });

  it("deuda de otro usuario: 404, nunca 403", async () => {
    mocks.getDebtDetailById.mockResolvedValue(null);
    expect((await GET(request(), context())).status).toBe(404);
  });

  it("validación: id inválido devuelve 400", async () => {
    expect(
      (await GET(request(), { params: Promise.resolve({ id: "x" }) })).status
    ).toBe(400);
  });

  it("idempotencia de lectura: dos GET no escriben", async () => {
    await GET(request(), context());
    await GET(request(), context());
    expect(mocks.getDebtDetailById).toHaveBeenCalledTimes(2);
    expect(mocks.updateDebtBasics).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/debts/[id]", () => {
  it("camino feliz: edita solo datos no monetarios", async () => {
    const response = await PATCH(patchRequest({ name: "Laptop familiar" }), context());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.debt.name).toBe("Laptop familiar");
    expect(mocks.updateDebtBasics).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      DEBT_ID,
      { name: "Laptop familiar" }
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect(
      (await PATCH(patchRequest({ name: "Laptop familiar" }), context())).status
    ).toBe(401);
  });

  it("deuda de otro usuario: 404, nunca 403", async () => {
    mocks.getDebtById.mockResolvedValue(null);
    expect(
      (await PATCH(patchRequest({ name: "Laptop familiar" }), context())).status
    ).toBe(404);
  });

  it("validación: no permite tocar current_balance", async () => {
    const response = await PATCH(patchRequest({ current_balance: 1 }), context());
    expect(response.status).toBe(400);
    expect(mocks.updateDebtBasics).not.toHaveBeenCalled();
  });

  it("idempotencia natural: repetir el mismo PATCH conserva el mismo valor", async () => {
    await PATCH(patchRequest({ name: "Laptop familiar" }), context());
    const response = await PATCH(
      patchRequest({ name: "Laptop familiar" }),
      context()
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.debt.name).toBe("Laptop familiar");
    expect(mocks.updateDebtBasics).toHaveBeenCalledTimes(2);
  });
});

function request() {
  return new Request(`http://localhost/api/v1/debts/${DEBT_ID}`);
}

function patchRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/v1/debts/${DEBT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context() {
  return { params: Promise.resolve({ id: DEBT_ID }) };
}

function debt() {
  return {
    id: DEBT_ID,
    user_id: USER_ID,
    name: "Préstamo con Luis",
    status: "active",
    current_balance: 100,
    metadata: {},
  };
}
