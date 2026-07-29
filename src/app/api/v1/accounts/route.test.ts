// 24 §10: GET /api/v1/accounts filtra por include_archived (ACT-CUENTAS-04:
// hace falta poder listar cuentas archivadas para poder restaurarlas).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getActiveAccounts: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getActiveAccounts: mocks.getActiveAccounts,
  createAccount: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
  mocks.getActiveAccounts.mockResolvedValue([]);
});

describe("GET /api/v1/accounts", () => {
  it("sin include_archived: pide solo activas", async () => {
    await GET(new Request("http://localhost/api/v1/accounts"));

    expect(mocks.getActiveAccounts).toHaveBeenCalledWith({}, "u1", {
      includeArchived: undefined,
    });
  });

  it("include_archived=true: tambien trae archivadas", async () => {
    await GET(new Request("http://localhost/api/v1/accounts?include_archived=true"));

    expect(mocks.getActiveAccounts).toHaveBeenCalledWith({}, "u1", {
      includeArchived: true,
    });
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/accounts"));

    expect(response.status).toBe(401);
  });
});
