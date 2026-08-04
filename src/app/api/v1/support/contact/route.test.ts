import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createEmailSender: vi.fn(),
  send: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/adapters/email/outbound-sender", () => ({ createEmailSender: mocks.createEmailSender }));

import { POST } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/support/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "contact-key-123", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.createEmailSender.mockReset();
  mocks.send.mockReset();
  mocks.getUser.mockReset();
  mocks.createEmailSender.mockReturnValue({ send: mocks.send });
  mocks.getUser.mockResolvedValue({ data: { user: { email: "marco@ejemplo.com" } } });
  mocks.getApiAuth.mockResolvedValue({
    userId: "user-1",
    client: { auth: { getUser: mocks.getUser } },
  });
  mocks.send.mockResolvedValue({ ok: true, providerMessageId: "local-1" });
});

describe("POST /api/v1/support/contact — AC-AYUDA-08: nunca datos financieros", () => {
  it("camino feliz: envía con el contexto y Reply-To al correo del usuario", async () => {
    const response = await POST(
      request({
        message: "No puedo conectar mi correo.",
        context: { route: "/configuracion/correo", app_version: "1.0.0", user_agent: "vitest" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ sent: true });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { "Reply-To": "marco@ejemplo.com" } }),
    );
    expect(mocks.send.mock.calls[0][0].text).toContain("No puedo conectar mi correo.");
    expect(mocks.send.mock.calls[0][0].text).toContain("/configuracion/correo");
  });

  it("el esquema no acepta campos financieros (monto, descripcion) — se rechazan como desconocidos", async () => {
    const response = await POST(
      request({
        message: "x",
        context: { route: "/x" },
        monto: 500,
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await POST(request({ message: "x", context: {} }));
    expect(response.status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("validación: mensaje vacío se rechaza", async () => {
    const response = await POST(request({ message: "", context: {} }));
    expect(response.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("AC-API-05: exige Idempotency-Key real", async () => {
    const response = await POST(
      request({ message: "x", context: {} }, { "idempotency-key": "" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("un fallo del proveedor se reporta como error, no como éxito silencioso", async () => {
    mocks.send.mockResolvedValue({ ok: false, error: "smtp_down" });
    const response = await POST(request({ message: "x", context: {} }));
    expect(response.status).toBe(500);
  });
});
