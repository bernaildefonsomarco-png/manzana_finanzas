import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const DEBT_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getDebtById: vi.fn(),
  listDebtInstallmentsForDebt: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/debts.repository", () => ({
  getDebtById: mocks.getDebtById,
  listDebtInstallmentsForDebt: mocks.listDebtInstallmentsForDebt,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.getDebtById.mockResolvedValue({ id: DEBT_ID });
  mocks.listDebtInstallmentsForDebt.mockResolvedValue([{ id: "i1", number: 1 }]);
});

describe("GET /api/v1/debts/[id]/installments", () => {
  it("camino feliz: devuelve las cuotas propias", async () => {
    const body = await (await GET(request(), context())).json();
    expect(body.data.installments).toEqual([{ id: "i1", number: 1 }]);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(request(), context())).status).toBe(401);
  });

  it("deuda ajena: 404, nunca 403", async () => {
    mocks.getDebtById.mockResolvedValue(null);
    expect((await GET(request(), context())).status).toBe(404);
  });

  it("validación: id inválido devuelve 400", async () => {
    expect(
      (
        await GET(request(), {
          params: Promise.resolve({ id: "x" }),
        })
      ).status
    ).toBe(400);
  });

  it("idempotencia de lectura: repetir GET no muta cuotas", async () => {
    await GET(request(), context());
    await GET(request(), context());
    expect(mocks.listDebtInstallmentsForDebt).toHaveBeenCalledTimes(2);
  });
});

function request() {
  return new Request(`http://localhost/api/v1/debts/${DEBT_ID}/installments`);
}
function context() {
  return { params: Promise.resolve({ id: DEBT_ID }) };
}
