import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const DEBT_ID = "11111111-1111-4111-8111-111111111111";
const INSTALLMENT_ID = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getApiAuth: vi.fn(),
  getDebtById: vi.fn(),
  getDebtInstallmentById: vi.fn(),
  skipDebtInstallment: vi.fn(),
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
    getDebtInstallmentById: mocks.getDebtInstallmentById,
    skipDebtInstallment: mocks.skipDebtInstallment,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.getDebtById.mockResolvedValue({ id: DEBT_ID });
  mocks.getDebtInstallmentById.mockResolvedValue({
    id: INSTALLMENT_ID,
    debt_id: DEBT_ID,
    status: "pending",
  });
  mocks.createServiceClient.mockReturnValue({});
  mocks.skipDebtInstallment.mockResolvedValue({
    installment: { id: INSTALLMENT_ID, status: "skipped" },
    idempotent: false,
  });
});

describe("POST /debts/[id]/installments/[iid]/skip", () => {
  it("camino feliz: deja la cuota en skipped con motivo explícito", async () => {
    const body = await (await POST(request(), context())).json();
    expect(body.data.installment.status).toBe("skipped");
    expect(mocks.skipDebtInstallment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: "Cuota incluida en otro acuerdo" })
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(request(), context())).status).toBe(401);
  });

  it("deuda o cuota ajena: 404, nunca 403", async () => {
    mocks.getDebtById.mockResolvedValue(null);
    expect((await POST(request(), context())).status).toBe(404);
  });

  it("validación: exige un motivo", async () => {
    expect((await POST(request({ reason: "" }), context())).status).toBe(400);
  });

  it("idempotencia: retry se marca como replay", async () => {
    mocks.skipDebtInstallment.mockResolvedValue({
      installment: { id: INSTALLMENT_ID, status: "skipped" },
      idempotent: true,
    });
    const body = await (await POST(request(), context())).json();
    expect(body.meta.idempotent_replay).toBe(true);
  });
});

function request(body: Record<string, unknown> = {}) {
  return new Request(
    `http://localhost/api/v1/debts/${DEBT_ID}/installments/${INSTALLMENT_ID}/skip`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "skip-installment-123",
      },
      body: JSON.stringify({
        reason: "Cuota incluida en otro acuerdo",
        ...body,
      }),
    }
  );
}

function context() {
  return { params: Promise.resolve({ id: DEBT_ID, iid: INSTALLMENT_ID }) };
}
