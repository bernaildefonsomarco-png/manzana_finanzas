import { describe, expect, it } from "vitest";
import { decideSend, isWithinQuietHours } from "./send-policy";

describe("decideSend — RUL-MAIL-02: las cinco condiciones se comprueban al enviar", () => {
  it("AC-MAIL-02: un transaccional siempre se envía, sin importar horario o límite", () => {
    expect(
      decideSend({
        kind: "transaccional",
        typeStillActive: false,
        causeStillValid: false,
        addressSuppressed: false,
        withinQuietHours: true,
        dailyLimitReached: true,
      }),
    ).toEqual({ action: "send" });
  });

  it("WEB-D282: un transaccional a una dirección suprimida SÍ se descarta (RUL-MAIL-08 protege la reputación del dominio, no es una de las 'cinco reglas' de horario)", () => {
    expect(
      decideSend({
        kind: "transaccional",
        typeStillActive: true,
        causeStillValid: true,
        addressSuppressed: true,
        withinQuietHours: false,
        dailyLimitReached: false,
      }),
    ).toEqual({ action: "discard", reason: "direccion_suprimida" });
  });

  it("AC-MAIL-01: una notificación de un tipo desactivado se descarta", () => {
    expect(
      decideSend({
        kind: "notificacion",
        typeStillActive: false,
        causeStillValid: true,
        addressSuppressed: false,
        withinQuietHours: false,
        dailyLimitReached: false,
      }),
    ).toEqual({ action: "discard", reason: "tipo_desactivado" });
  });

  it("caso borde 1 de 46 §15: la causa se resuelve entre encolar y enviar → se descarta", () => {
    expect(
      decideSend({
        kind: "notificacion",
        typeStillActive: true,
        causeStillValid: false,
        addressSuppressed: false,
        withinQuietHours: false,
        dailyLimitReached: false,
      }),
    ).toEqual({ action: "discard", reason: "causa_resuelta" });
  });

  it("dirección suprimida se descarta antes de mirar horario o límite", () => {
    expect(
      decideSend({
        kind: "notificacion",
        typeStillActive: true,
        causeStillValid: true,
        addressSuppressed: true,
        withinQuietHours: true,
        dailyLimitReached: true,
      }),
    ).toEqual({ action: "discard", reason: "direccion_suprimida" });
  });

  it("en horario silencioso se difiere, no se descarta", () => {
    expect(
      decideSend({
        kind: "notificacion",
        typeStillActive: true,
        causeStillValid: true,
        addressSuppressed: false,
        withinQuietHours: true,
        dailyLimitReached: false,
      }),
    ).toEqual({ action: "defer", reason: "horario_silencioso" });
  });

  it("límite diario alcanzado se difiere", () => {
    expect(
      decideSend({
        kind: "notificacion",
        typeStillActive: true,
        causeStillValid: true,
        addressSuppressed: false,
        withinQuietHours: false,
        dailyLimitReached: true,
      }),
    ).toEqual({ action: "defer", reason: "limite_diario" });
  });

  it("las cinco condiciones en orden pasan: se envía", () => {
    expect(
      decideSend({
        kind: "notificacion",
        typeStillActive: true,
        causeStillValid: true,
        addressSuppressed: false,
        withinQuietHours: false,
        dailyLimitReached: false,
      }),
    ).toEqual({ action: "send" });
  });

  it("RUL-HECHO-02: si la comprobación de suprimidos se quitara, este caso pasaría a 'send' en vez de 'discard'", () => {
    const withSuppression = decideSend({
      kind: "notificacion",
      typeStillActive: true,
      causeStillValid: true,
      addressSuppressed: true,
      withinQuietHours: false,
      dailyLimitReached: false,
    });
    expect(withSuppression.action).toBe("discard");
  });
});

describe("isWithinQuietHours — RUL-MAIL-03: 22:00–08:00 en America/Lima", () => {
  it("dentro del rango que cruza medianoche", () => {
    expect(isWithinQuietHours(23)).toBe(true);
    expect(isWithinQuietHours(3)).toBe(true);
    expect(isWithinQuietHours(0)).toBe(true);
  });

  it("fuera del rango", () => {
    expect(isWithinQuietHours(8)).toBe(false);
    expect(isWithinQuietHours(14)).toBe(false);
    expect(isWithinQuietHours(21)).toBe(false);
  });

  it("los límites: 22 es silencioso, 8 ya no lo es", () => {
    expect(isWithinQuietHours(22)).toBe(true);
    expect(isWithinQuietHours(8)).toBe(false);
  });

  it("horario configurable que no cruza medianoche", () => {
    expect(isWithinQuietHours(10, 9, 17)).toBe(true);
    expect(isWithinQuietHours(18, 9, 17)).toBe(false);
  });
});
