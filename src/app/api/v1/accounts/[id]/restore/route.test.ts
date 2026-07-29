// ACT-CUENTAS-04 (24 §5.1): restaurar una cuenta archivada reactiva tambien
// sus cajas.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  restoreAccount: vi.fn(),
  restoreBoxesForAccount: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  restoreAccount: mocks.restoreAccount,
  restoreBoxesForAccount: mocks.restoreBoxesForAccount,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: ACCOUNT_ID }) };

function postRequest() {
  return new Request(`http://localhost/api/v1/accounts/${ACCOUNT_ID}/restore`, {
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServiceClient.mockReturnValue({});
});

describe("POST /api/v1/accounts/[id]/restore", () => {
  it("camino feliz: reactiva la cuenta y sus cajas archivadas", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.restoreAccount.mockResolvedValue({ id: ACCOUNT_ID, deleted_at: null });
    mocks.restoreBoxesForAccount.mockResolvedValue([{ id: "b1" }]);

    const response = await POST(postRequest(), ctx);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.restored_box_count).toBe(1);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await POST(postRequest(), ctx);

    expect(response.status).toBe(401);
  });

  it("cuenta inexistente o ya activa: 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.restoreAccount.mockResolvedValue(null);

    const response = await POST(postRequest(), ctx);

    expect(response.status).toBe(404);
  });

  it("validacion: id invalido", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });

    const response = await POST(postRequest(), {
      params: Promise.resolve({ id: "no-es-uuid" }),
    });

    expect(response.status).toBe(400);
  });
});
