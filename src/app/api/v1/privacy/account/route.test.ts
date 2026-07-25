import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  disconnectGmail: vi.fn(),
  prepareUserAccountDeletion: vi.fn(),
  deleteUser: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/core/email/email-connection", async (original) => ({
  ...(await original()),
  disconnectGmail: mocks.disconnectGmail,
}));
vi.mock("@/data/repositories/privacy.repository", async (original) => ({
  ...(await original()),
  prepareUserAccountDeletion: mocks.prepareUserAccountDeletion,
}));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { DELETE } from "./route";

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.disconnectGmail.mockReset();
  mocks.prepareUserAccountDeletion.mockReset();
  mocks.deleteUser.mockReset();
  mocks.createServiceClient.mockReset();
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: {} });
  mocks.disconnectGmail.mockResolvedValue({ changed: true });
  mocks.prepareUserAccountDeletion.mockResolvedValue(undefined);
  mocks.deleteUser.mockResolvedValue({ data: {}, error: null });
  mocks.createServiceClient.mockReturnValue({
    auth: { admin: { deleteUser: mocks.deleteUser } },
  });
});

describe("privacy account deletion route", () => {
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
