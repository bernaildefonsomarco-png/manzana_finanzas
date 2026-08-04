import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  updateUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));

import { PATCH } from "./route";

function client() {
  return { auth: { updateUser: mocks.updateUser }, from: () => ({ insert: mocks.insert }) };
}

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.updateUser.mockReset().mockResolvedValue({ error: null });
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: client() });
});

function request(body: unknown) {
  return new Request("http://localhost/api/v1/auth/email", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/auth/email", () => {
  it("camino feliz: pide el cambio y registra correo_cambiado", async () => {
    const response = await PATCH(request({ new_email: "Nuevo@Correo.com" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ confirmation_sent: true });
    expect(mocks.updateUser).toHaveBeenCalledWith({ email: "nuevo@correo.com" });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", kind: "correo_cambiado" }),
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await PATCH(request({ new_email: "a@b.com" }));
    expect(response.status).toBe(401);
  });

  it("validación: correo mal formado se rechaza antes de llamar a Supabase", async () => {
    const response = await PATCH(request({ new_email: "no-es-correo" }));
    expect(response.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("RUL-AUTH-01 no aplica aquí (sesión ya identifica al usuario), pero un correo ya usado por otra cuenta se mapea por código", async () => {
    mocks.updateUser.mockResolvedValue({
      error: { code: "email_exists", message: "Email already registered" },
    });
    const response = await PATCH(request({ new_email: "otro@correo.com" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toBe("Ese correo ya tiene una cuenta.");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
