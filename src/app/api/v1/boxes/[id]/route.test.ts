// 24 §10: GET /api/v1/boxes/[id] trae el detalle de una caja con progreso.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getAccountById: vi.fn(),
  getBoxById: vi.fn(),
  softDeleteBox: vi.fn(),
  updateBoxMeta: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
  getBoxById: mocks.getBoxById,
  softDeleteBox: mocks.softDeleteBox,
  updateBoxMeta: mocks.updateBoxMeta,
}));

const BOX_ID = "22222222-2222-4222-8222-222222222222";
const ctx = { params: Promise.resolve({ id: BOX_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/boxes/[id]", () => {
  it("camino feliz: trae la caja y su cuenta", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getBoxById.mockResolvedValue({ id: BOX_ID, account_id: "a1", name: "Emergencia" });
    mocks.getAccountById.mockResolvedValue({ id: "a1", name: "BCP" });

    const response = await GET(new Request(`http://localhost/api/v1/boxes/${BOX_ID}`), ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.box.id).toBe(BOX_ID);
    expect(body.data.account.name).toBe("BCP");
  });

  it("sin sesion: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request(`http://localhost/api/v1/boxes/${BOX_ID}`), ctx);

    expect(response.status).toBe(401);
  });

  it("caja de otro usuario: 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });
    mocks.getBoxById.mockResolvedValue(null);

    const response = await GET(new Request(`http://localhost/api/v1/boxes/${BOX_ID}`), ctx);

    expect(response.status).toBe(404);
  });

  it("validacion: id invalido", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "u1" });

    const response = await GET(new Request("http://localhost/api/v1/boxes/x"), {
      params: Promise.resolve({ id: "no-es-uuid" }),
    });

    expect(response.status).toBe(400);
  });
});
