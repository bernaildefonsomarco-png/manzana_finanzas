import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getDebtDetailById: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/debts.repository", () => ({
  getDebtDetailById: mocks.getDebtDetailById,
}));

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.getDebtDetailById.mockReset();
});

describe("debt detail route", () => {
  it("rechaza detalle sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/debts/11111111-1111-4111-8111-111111111111"),
      routeContext()
    );

    expect(response.status).toBe(401);
    expect(mocks.getDebtDetailById).not.toHaveBeenCalled();
  });

  it("devuelve deuda con pagos del usuario autenticado", async () => {
    const client = {};
    mocks.getApiAuth.mockResolvedValue({
      client,
      userId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.getDebtDetailById.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Prestamo con Luis",
      payments: [],
    });

    const response = await GET(
      new Request("http://localhost/api/v1/debts/11111111-1111-4111-8111-111111111111"),
      routeContext()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.debt.name).toBe("Prestamo con Luis");
    expect(mocks.getDebtDetailById).toHaveBeenCalledWith(
      client,
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("responde 404 cuando la deuda no existe para el usuario", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: {},
      userId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.getDebtDetailById.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/debts/11111111-1111-4111-8111-111111111111"),
      routeContext()
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("NOT_FOUND");
  });
});

function routeContext() {
  return {
    params: Promise.resolve({
      id: "11111111-1111-4111-8111-111111111111",
    }),
  };
}
