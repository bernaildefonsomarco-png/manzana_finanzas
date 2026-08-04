import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  disconnectGmail: vi.fn(),
  prepareUserAccountDeletion: vi.fn(),
  getAccountDeletionImpact: vi.fn(),
  deleteUser: vi.fn(),
  createServiceClient: vi.fn(),
  serviceInsert: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/core/email/email-connection", async (original) => ({
  ...(await original()),
  disconnectGmail: mocks.disconnectGmail,
}));
vi.mock("@/data/repositories/privacy.repository", async (original) => ({
  ...(await original()),
  prepareUserAccountDeletion: mocks.prepareUserAccountDeletion,
  getAccountDeletionImpact: mocks.getAccountDeletionImpact,
}));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { DELETE, GET } from "./route";

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.disconnectGmail.mockReset();
  mocks.prepareUserAccountDeletion.mockReset();
  mocks.getAccountDeletionImpact.mockReset();
  mocks.deleteUser.mockReset();
  mocks.createServiceClient.mockReset();
  mocks.serviceInsert.mockReset();
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: {} });
  mocks.disconnectGmail.mockResolvedValue({ changed: true });
  mocks.prepareUserAccountDeletion.mockResolvedValue(undefined);
  mocks.getAccountDeletionImpact.mockResolvedValue({
    movements: 1847,
    debts: 3,
    email_connections: 2,
    learned_things: 37,
    conversations: 5,
  });
  mocks.deleteUser.mockResolvedValue({ data: {}, error: null });
  mocks.serviceInsert.mockResolvedValue({ error: null });
  mocks.createServiceClient.mockReturnValue({
    auth: { admin: { deleteUser: mocks.deleteUser } },
    from: () => ({ insert: mocks.serviceInsert }),
  });
});

describe("GET /api/v1/privacy/account — SCR-AUTH-08: cifras reales", () => {
  it("camino feliz: devuelve el impacto bajo la sesión del usuario", async () => {
    const response = await GET(new Request("http://localhost/api/v1/privacy/account"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.impact).toEqual({
      movements: 1847,
      debts: 3,
      email_connections: 2,
      learned_things: 37,
      conversations: 5,
    });
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/privacy/account"));
    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/v1/privacy/account", () => {
  it("registra eliminacion_solicitada ANTES de borrar (RUL-AUTH-10)", async () => {
    const order: string[] = [];
    mocks.serviceInsert.mockImplementation(() => {
      order.push("insert_event");
      return Promise.resolve({ error: null });
    });
    mocks.deleteUser.mockImplementation(() => {
      order.push("delete_user");
      return Promise.resolve({ data: {}, error: null });
    });

    await DELETE(
      new Request("http://localhost/api/v1/privacy/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "ELIMINAR MI CUENTA" }),
      }),
    );

    expect(order).toEqual(["insert_event", "delete_user"]);
    expect(mocks.serviceInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", kind: "eliminacion_solicitada" }),
    );
  });

  it("desconecta, minimiza y elimina solo con confirmacion exacta", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/v1/privacy/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "ELIMINAR MI CUENTA" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.disconnectGmail).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
    expect(mocks.prepareUserAccountDeletion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "user-1" }),
    );
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("no ejecuta efectos con una confirmacion distinta", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/v1/privacy/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "eliminar" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.disconnectGmail).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rechaza eliminacion sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await DELETE(
      new Request("http://localhost/api/v1/privacy/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "ELIMINAR MI CUENTA" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.disconnectGmail).not.toHaveBeenCalled();
  });
});
