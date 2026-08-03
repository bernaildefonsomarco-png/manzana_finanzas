import { describe, expect, it } from "vitest";
import { puedeGenerarHechoDePerfilAutomatico } from "./sensitive-topics";

describe("puedeGenerarHechoDePerfilAutomatico (20c S8, AC-PERF-10)", () => {
  it("no genera un hecho automatico desde una categoria sensible", () => {
    expect(
      puedeGenerarHechoDePerfilAutomatico({ categoriaOrigenEsSensible: true, capa: "vida" }),
    ).toBe(false);
  });

  it("permite generar un hecho desde una categoria no sensible", () => {
    expect(
      puedeGenerarHechoDePerfilAutomatico({ categoriaOrigenEsSensible: false, capa: "vida" }),
    ).toBe(true);
  });

  it("la restriccion aplica a las cuatro capas, no solo vinculo", () => {
    for (const capa of ["estilo", "vida", "vinculo", "hilo"] as const) {
      expect(
        puedeGenerarHechoDePerfilAutomatico({ categoriaOrigenEsSensible: true, capa }),
      ).toBe(false);
    }
  });
});
