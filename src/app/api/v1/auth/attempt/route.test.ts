import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { POST } from "./route";

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.createServiceClient.mockReset().mockReturnValue({ rpc: mocks.rpc });
});

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/auth/attempt", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/auth/attempt — RUL-AUTH-06: límite de intentos de autenticación", () => {
  it("camino feliz: permitido, incrementa por correo y por IP para sign_in", async () => {
    mocks.rpc.mockResolvedValue({ data: { allowed: true, retry_after_seconds: 0 }, error: null });

    const response = await POST(
      request(
        { kind: "sign_in", email: "Marco@Ejemplo.com" },
        { "x-forwarded-for": "189.28.14.7" },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ allowed: true, retry_after_seconds: 0 });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "check_and_increment_rate_limit",
      expect.objectContaining({ p_key: "auth_sign_in:email:marco@ejemplo.com" }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "check_and_increment_rate_limit",
      expect.objectContaining({ p_key: "auth_sign_in:ip:189.28.14.7" }),
    );
  });

  it("password_reset solo limita por correo, nunca por IP (RUL-AUTH-01: no es oráculo de existencia)", async () => {
    mocks.rpc.mockResolvedValue({ data: { allowed: true, retry_after_seconds: 0 }, error: null });

    await POST(request({ kind: "password_reset", email: "a@b.com" }));

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "check_and_increment_rate_limit",
      expect.objectContaining({
        p_key: "auth_password_reset:email:a@b.com",
        p_window_seconds: 3600,
        p_max_count: 3,
      }),
    );
  });

  it("AC-AUTH-15: al alcanzar el límite, dice cuánto falta (retry_after_seconds), y no bloquea la cuenta", async () => {
    mocks.rpc.mockResolvedValue({
      data: { allowed: false, retry_after_seconds: 612 },
      error: null,
    });

    const response = await POST(request({ kind: "sign_in", email: "a@b.com" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ allowed: false, retry_after_seconds: 612 });
    expect(response.headers.get("Retry-After")).toBe("612");
  });

  it("validación: correo inválido no llega a incrementar el contador", async () => {
    const response = await POST(request({ kind: "sign_in", email: "no-es-correo" }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("un fallo del RPC no bloquea al usuario (protección contra abuso, no gate de seguridad)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "rpc down" } });

    const response = await POST(request({ kind: "resend_verification", email: "a@b.com" }));
    const body = await response.json();

    expect(body.data.allowed).toBe(true);
  });

  it("RUL-HECHO-02: si la clave de email y de IP fueran la misma, este aserto de dos llamadas fallaría", async () => {
    mocks.rpc.mockResolvedValue({ data: { allowed: true, retry_after_seconds: 0 }, error: null });
    await POST(request({ kind: "sign_up", email: "a@b.com" }, { "x-forwarded-for": "1.2.3.4" }));
    const keys = mocks.rpc.mock.calls.map((call) => call[1].p_key);
    expect(new Set(keys).size).toBe(2);
  });
});
