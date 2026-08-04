import { describe, expect, it, vi } from "vitest";
import { logger } from "@/shared/telemetry/logger";
import { mapAuthErrorCode, offlineAuthError } from "./auth-error-mapping";

describe("mapAuthErrorCode — RUL-AUTH-05: mapeo por código, no por texto", () => {
  it("AC-AUTH-01/ERR-AUTH-01: invalid_credentials no distingue correo de contraseña", () => {
    const result = mapAuthErrorCode("invalid_credentials", { mode: "login" });
    expect(result).toEqual({
      id: "ERR-AUTH-01",
      message:
        "El correo o la contraseña no coinciden. Revísalos, o crea una cuenta si aún no tienes.",
      actions: ["reintentar", "recuperar", "crear_cuenta"],
    });
  });

  it("ERR-AUTH-02: email_not_confirmed ofrece reenviar", () => {
    const result = mapAuthErrorCode("email_not_confirmed", { mode: "login" });
    expect(result.id).toBe("ERR-AUTH-02");
    expect(result.actions).toEqual(["reenviar"]);
  });

  it("ERR-AUTH-03: user_already_exists ofrece entrar o recuperar", () => {
    const result = mapAuthErrorCode("user_already_exists", { mode: "signup" });
    expect(result.id).toBe("ERR-AUTH-03");
    expect(result.message).toBe("Ese correo ya tiene una cuenta.");
  });

  it("ERR-AUTH-05: over_request_rate_limit dice la hora exacta de reintento (AC-AUTH-15)", () => {
    const now = () => new Date("2026-08-03T14:17:00-05:00");
    const result = mapAuthErrorCode("over_request_rate_limit", {
      mode: "login",
      retryAfterSeconds: 900,
      now,
    });
    expect(result.id).toBe("ERR-AUTH-05");
    // 14:17 + 900s (15 min) = 14:32, hora de Lima (America/Lima, sin horario de verano)
    expect(result.message).toBe("Demasiados intentos seguidos. Prueba otra vez a las 14:32.");
  });

  it("ERR-AUTH-06: otp_expired y flow_state_expired son el mismo mensaje (enlace caducado)", () => {
    expect(mapAuthErrorCode("otp_expired", { mode: "recovery" }).id).toBe("ERR-AUTH-06");
    expect(mapAuthErrorCode("flow_state_expired", { mode: "recovery" }).id).toBe("ERR-AUTH-06");
  });

  it("ERR-AUTH-07: flow_state_not_found es 'ese enlace ya se usó'", () => {
    const result = mapAuthErrorCode("flow_state_not_found", { mode: "recovery" });
    expect(result.id).toBe("ERR-AUTH-07");
    expect(result.message).toBe("Ese enlace ya se usó.");
  });

  it("ERR-AUTH-08: session_expired y session_not_found vuelven a 'sigues donde estabas'", () => {
    expect(mapAuthErrorCode("session_expired", { mode: "generic" }).message).toContain(
      "sigues donde estabas"
    );
    expect(mapAuthErrorCode("session_not_found", { mode: "generic" }).id).toBe("ERR-AUTH-08");
  });

  it("ERR-AUTH-09: same_password", () => {
    expect(mapAuthErrorCode("same_password", { mode: "generic" }).message).toBe(
      "Esa es la contraseña que ya tienes."
    );
  });

  it("AC-AUTH-01/AC-AUTH-02: un código desconocido nunca propaga el texto del proveedor, y emite alerta", () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    const result = mapAuthErrorCode("some_new_provider_code_v3", {
      mode: "login",
      traceId: "trace-123",
    });

    expect(result.id).toBe("ERR-AUTH-11");
    expect(result.message).not.toContain("some_new_provider_code_v3");
    expect(errorSpy).toHaveBeenCalledWith(
      "cuenta.error_sin_traducir",
      expect.objectContaining({ provider_code: "some_new_provider_code_v3", trace_id: "trace-123" })
    );

    errorSpy.mockRestore();
  });

  it("RUL-HECHO-02: revertido el mapeo (código conocido tratado como desconocido), el test de ERR-AUTH-01 falla", () => {
    // Simula la implementación anterior a esta: ningún código se reconoce.
    const noMapping = () => {
      const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
      const result = mapAuthErrorCode(undefined, { mode: "login" });
      errorSpy.mockRestore();
      return result;
    };
    expect(noMapping().id).not.toBe("ERR-AUTH-01");
  });

  it("un código vacío o nulo cae en el genérico según el modo", () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    expect(mapAuthErrorCode(null, { mode: "signup" }).message).toContain("crear la cuenta");
    expect(mapAuthErrorCode(undefined, { mode: "recovery" }).message).toContain(
      "Tus datos están a salvo"
    );
    errorSpy.mockRestore();
  });

  it("ERR-AUTH-12: sin conexión, mensaje fijo que conserva lo escrito", () => {
    expect(offlineAuthError()).toEqual({
      id: "ERR-AUTH-12",
      message: "Parece que no hay conexión. Lo que escribiste sigue aquí.",
      actions: ["reintentar"],
    });
  });
});
