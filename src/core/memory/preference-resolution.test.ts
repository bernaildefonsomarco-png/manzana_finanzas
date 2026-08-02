import { describe, expect, it } from "vitest";
import { resolveEffectivePreference } from "./preference-resolution";

describe("RUL-MEM-14", () => {
  it("mantiene la vista mensual declarada aunque se observe la semanal 15 veces", () => {
    expect(resolveEffectivePreference({
      declared: { present: true, value: "mensual" },
      observed: { value: "semanal", count: 15 },
      fallback: "mensual",
    })).toEqual({
      value: "mensual",
      source: "declared",
      observed_value: "semanal",
      observed_count: 15,
    });
  });

  it("usa la observación solo cuando no existe un ajuste declarado", () => {
    expect(resolveEffectivePreference({
      declared: { present: false },
      observed: { value: "tabla", count: 4 },
      fallback: "grafico",
    }).value).toBe("tabla");
  });
});
