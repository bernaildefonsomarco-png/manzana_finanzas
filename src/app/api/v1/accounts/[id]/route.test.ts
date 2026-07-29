// ACT-CUENTAS-03/05 (RUL-CUENTAS-13, 24 §5.1): PATCH cambia la cuenta por
// defecto sin dejar dos activas a la vez; DELETE archiva en cascada sin
// exigir cajas vacias ni saldo cero.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getAccountById: vi.fn(),
  getActiveBoxes: vi.fn(),
  getFreeBalanceForAccount: vi.fn(),
  updateAccountMeta: vi.fn(),
  setDefaultAccount: vi.fn(),
  archiveBoxesForAccount: vi.fn(),
  softDeleteAccount: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
  getActiveBoxes: mocks.getActiveBoxes,
  getFreeBalanceForAccount: mocks.getFreeBalanceForAccount,
  updateAccountMeta: mocks.updateAccountMeta,
  setDefaultAccount: mocks.setDefaultAccount,
  archiveBoxesForAccount: mocks.archiveBoxesForAccount,
  softDeleteAccount: mocks.softDeleteAccount,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

function account(overrides: Partial<Record<string, unknown>>) {
  return {
    id: ACCOUNT_ID,
    user_id: "u1",
    name: "BCP",
    institution: null,
    type: "banco",
    currency: "PEN",
    initial_balance: 0,
    current_balance: 100,
    is_default: false,
    color: null,
    icon: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    metadata: {},
    ...overrides,
  };
}

function patchRequest(body: unknown) {
  return new Request(`http://localhost/api/v1/accounts/${ACCOUNT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(body: unknown = {}) {
  return new Request(`http://localhost/api/v1/accounts/${ACCOUNT_ID}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: ACCOUNT_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServiceClient.mockReturnValue({});
});

describe("GET /api/v1/accounts/[id]", () => {
  it("24 §10: camino feliz trae la cuenta, su libre calculado y sus cajas", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById.mockResolvedValue(account({}));
    mocks.getActiveBoxes.mockResolvedValue([{ id: "b1" }]);
    mocks.getFreeBalanceForAccount.mockResolvedValue(50);

    const response = await GET(new Request(`http://localhost/api/v1/accounts/${ACCOUNT_ID}`), ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.free_balance).toBe(50);
    expect(body.data.boxes).toHaveLength(1);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request(`http://localhost/api/v1/accounts/${ACCOUNT_ID}`), ctx);

    expect(response.status).toBe(401);
  });

  it("cuenta de otro usuario: 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById.mockResolvedValue(null);

    const response = await GET(new Request(`http://localhost/api/v1/accounts/${ACCOUNT_ID}`), ctx);

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/accounts/[id]", () => {
  it("ACT-CUENTAS-05: is_default:true marca esta cuenta como la nueva por defecto", async () => {
    mocks.getAccountById.mockResolvedValue(account({}));
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.setDefaultAccount.mockResolvedValue(account({ is_default: true }));

    const response = await PATCH(patchRequest({ is_default: true }), ctx);

    expect(response.status).toBe(200);
    expect(mocks.setDefaultAccount).toHaveBeenCalledWith({}, "u1", ACCOUNT_ID);
    const body = await response.json();
    expect(body.data.account.is_default).toBe(true);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: "Nuevo" }), ctx);

    expect(response.status).toBe(401);
  });

  it("cuenta de otro usuario: 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: "Nuevo" }), ctx);

    expect(response.status).toBe(404);
  });

  it("validacion: is_default:false se rechaza (no existe desmarcar sin reemplazo)", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById.mockResolvedValue(account({}));

    const response = await PATCH(patchRequest({ is_default: false }), ctx);

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/v1/accounts/[id]", () => {
  it("24 §5.1: archiva la cuenta y en cascada sus cajas, sin exigir saldo cero", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById.mockResolvedValue(account({ current_balance: 340 }));
    mocks.archiveBoxesForAccount.mockResolvedValue([
      { id: "b1" },
      { id: "b2" },
    ]);
    mocks.softDeleteAccount.mockResolvedValue(undefined);

    const response = await DELETE(deleteRequest(), ctx);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.archived_box_count).toBe(2);
    expect(body.data.released_balance).toBe(340);
    expect(mocks.softDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), ctx);

    expect(response.status).toBe(401);
  });

  it("cuenta de otro usuario: 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getAccountById.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), ctx);

    expect(response.status).toBe(404);
  });
});
