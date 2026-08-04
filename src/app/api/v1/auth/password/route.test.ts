import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));

import { PATCH } from "./route";

function client() {
  return {
    auth: { updateUser: mocks.updateUser, signOut: mocks.signOut },
    from: () => ({ insert: mocks.insert }),
  };
}

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.updateUser.mockReset().mockResolvedValue({ error: null });
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: client() });
});

function request(body: unknown) {
  return new Request("http://localhost/api/v1/auth/password", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/auth/password — RUL-AUTH-07", () => {
  it("camino feliz: cambia, cierra otras sesiones y registra clave_cambiada", async () => {
    const response = await PATCH(request({ new_password: "unacontrasenalarga" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ changed: true, other_sessions_closed: true });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", kind: "clave_cambiada" }),
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await PATCH(request({ new_password: "unacontrasenalarga" }));
    expect(response.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("recurso de otro usuario: no aplica aquí (la sesión es la única identidad), pero valida longitud mínima", async () => {
    const response = await PATCH(request({ new_password: "corta" }));
    expect(response.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("ERR-AUTH-09: same_password se mapea, no cierra sesiones ni registra evento", async () => {
    mocks.updateUser.mockResolvedValue({
      error: { code: "same_password", message: "New password should be different" },
    });
    const response = await PATCH(request({ new_password: "unacontrasenalarga" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toBe("Esa es la contraseña que ya tienes.");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("idempotencia: dos llamadas iguales seguidas ambas cierran otras sesiones (no hay estado a duplicar)", async () => {
    await PATCH(request({ new_password: "unacontrasenalarga" }));
    await PATCH(request({ new_password: "unacontrasenalarga" }));
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
  });
});
