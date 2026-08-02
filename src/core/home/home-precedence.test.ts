import { describe, expect, it } from "vitest";
import { nextActionLevel, selectNextAction } from "./home-precedence";

describe("home-precedence: RUL-HOME-03", () => {
  it("mapea cada tipo de recordatorio de 1-4 a los niveles de 39 §6", () => {
    expect(nextActionLevel("correo_desconectado")).toBe(1);
    expect(nextActionLevel("pago_vencido")).toBe(2);
    expect(nextActionLevel("cuota_vencida")).toBe(2);
    expect(nextActionLevel("pago_proximo")).toBe(3);
    expect(nextActionLevel("cuota_proxima")).toBe(3);
    expect(nextActionLevel("pendientes_acumulados")).toBe(4);
    expect(nextActionLevel("confirmar_hecho")).toBe(4);
  });

  it("WEB-D250: descarga_lista y sin_registrar no participan (no son 'lo siguiente')", () => {
    expect(nextActionLevel("descarga_lista")).toBeNull();
    expect(nextActionLevel("sin_registrar")).toBeNull();
  });

  it("presupuesto_umbral (nivel 5) tampoco participa: solo 1-4 se destacan", () => {
    expect(nextActionLevel("presupuesto_umbral")).toBeNull();
  });

  it("39 §19 caso 6: cuota vencida y correo desconectado a la vez -> gana el correo (nivel 1)", () => {
    const winner = selectNextAction([
      { id: "cuota", kind: "cuota_vencida" },
      { id: "correo", kind: "correo_desconectado" },
    ]);
    expect(winner?.id).toBe("correo");
  });

  it("a igual nivel, gana el primero de la lista de entrada (ya ordenada por 37)", () => {
    const winner = selectNextAction([
      { id: "cuota-1", kind: "cuota_vencida" },
      { id: "pago-1", kind: "pago_vencido" },
    ]);
    expect(winner?.id).toBe("cuota-1");
  });

  it("sin candidatos de nivel 1-4, no hay ganador", () => {
    expect(selectNextAction([{ id: "x", kind: "sin_registrar" }])).toBeNull();
    expect(selectNextAction([])).toBeNull();
  });

  it("un pendiente acumulado (nivel 4) pierde frente a una cuota próxima (nivel 3)", () => {
    const winner = selectNextAction([
      { id: "pend", kind: "pendientes_acumulados" },
      { id: "cuota", kind: "cuota_proxima" },
    ]);
    expect(winner?.id).toBe("cuota");
  });
});
