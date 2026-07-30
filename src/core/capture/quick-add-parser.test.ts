// RUL-CAP-01/02 (29 S6): la tabla de patrones que las reglas deben
// resolver sin llamar al modelo, mas los casos borde de S19.
import { describe, expect, it } from "vitest";
import { parseQuickAddLine } from "./quick-add-parser";

const TODAY = "2026-07-29";
const context = { knownAccounts: [{ id: "acc-yape", name: "yape" }], todayIso: TODAY };

describe("parseQuickAddLine", () => {
  it("numero suelto: '40' es gasto de S/40.00 sin descripcion, marcado", () => {
    const result = parseQuickAddLine("40", context);
    expect(result.fields.amount).toEqual({ value: 40, provenance: "dicho" });
    expect(result.fields.type).toEqual({ value: "gasto", provenance: "supuesto" });
    expect(result.unresolved).toContain("description");
  });

  it("AC-CAP-02: 'taxi 15' se resuelve solo con reglas", () => {
    const result = parseQuickAddLine("taxi 15", context);
    expect(result.resolved_by).toBe("reglas");
    expect(result.fields.amount?.value).toBe(15);
    expect(result.fields.description?.value).toBe("taxi");
  });

  it("numero + texto: '15 taxi'", () => {
    const result = parseQuickAddLine("15 taxi", context);
    expect(result.fields.amount?.value).toBe(15);
    expect(result.fields.description?.value).toBe("taxi");
  });

  it("con moneda: 's/15 taxi'", () => {
    const result = parseQuickAddLine("s/15 taxi", context);
    expect(result.fields.amount?.value).toBe(15);
  });

  it("con decimales y coma: '15,50' se normaliza a 15.50", () => {
    const result = parseQuickAddLine("15,50 almuerzo", context);
    expect(result.fields.amount?.value).toBe(15.5);
  });

  it("con cuenta conocida: 'taxi 15 yape'", () => {
    const result = parseQuickAddLine("taxi 15 yape", context);
    expect(result.fields.account).toEqual({
      value: "acc-yape",
      provenance: "supuesto",
      reason: "cuenta mencionada: yape",
    });
    expect(result.fields.description?.value).toBe("taxi");
  });

  it("con fecha relativa: 'taxi 15 ayer' resuelve la fecha en America/Lima", () => {
    const result = parseQuickAddLine("taxi 15 ayer", context);
    expect(result.fields.occurred_at).toEqual({ value: "2026-07-28", provenance: "dicho" });
  });

  it("RUL-CAP-03: '+2000 sueldo' es ingreso de S/2000.00", () => {
    const result = parseQuickAddLine("+2000 sueldo", context);
    expect(result.fields.type).toEqual({ value: "ingreso", provenance: "dicho" });
    expect(result.fields.amount?.value).toBe(2000);
    expect(result.fields.description?.value).toBe("sueldo");
  });

  it("29 S19 caso 3: texto sin numero queda sin monto resuelto", () => {
    const result = parseQuickAddLine("almuerzo", context);
    expect(result.resolved_by).toBe("parcial");
    expect(result.unresolved).toContain("amount");
  });

  it("29 S19 caso 11: 'el lunes' resuelve al lunes pasado, nunca al proximo", () => {
    // 2026-07-29 es miercoles; el lunes pasado es 2026-07-27.
    const result = parseQuickAddLine("taxi 15 el lunes", context);
    expect(result.fields.occurred_at?.value).toBe("2026-07-27");
  });

  it("nombrar el dia de hoy resuelve a hace una semana, nunca a hoy mismo", () => {
    // 2026-07-29 es miercoles: "el miercoles" nunca debe ser hoy.
    const result = parseQuickAddLine("taxi 15 el miercoles", context);
    expect(result.fields.occurred_at?.value).toBe("2026-07-22");
  });

  it("sin fecha mencionada, usa hoy marcado como supuesto", () => {
    const result = parseQuickAddLine("taxi 15", context);
    expect(result.fields.occurred_at).toEqual({ value: TODAY, provenance: "supuesto" });
  });

  it("linea vacia no hace nada resoluble", () => {
    const result = parseQuickAddLine("   ", context);
    expect(result.resolved_by).toBe("parcial");
  });
});
