import { describe, expect, it } from "vitest";
import { determinarGradoDeDegradacion } from "./grade";

const todoBien = {
  modeloNoDisponible: false,
  modeloTardando: false,
  coreRechazaEscrituras: false,
};

describe("determinarGradoDeDegradacion (23 S7)", () => {
  it("normal cuando todo esta bien", () => {
    expect(determinarGradoDeDegradacion(todoBien)).toMatchObject({
      grado: "normal",
      puedeProponerAcciones: true,
    });
  });

  it("lento cuando el modelo tarda mas de lo previsto", () => {
    const resultado = determinarGradoDeDegradacion({
      ...todoBien,
      modeloTardando: true,
    });
    expect(resultado).toMatchObject({
      grado: "lento",
      puedeProponerAcciones: true,
      debeOfrecerViaManualConcreta: false,
    });
  });

  it("solo_lectura cuando el Core rechaza escrituras", () => {
    const resultado = determinarGradoDeDegradacion({
      ...todoBien,
      coreRechazaEscrituras: true,
    });
    expect(resultado).toMatchObject({
      grado: "solo_lectura",
      puedeProponerAcciones: false,
    });
  });

  it("sin_modelo cuando el modelo no esta disponible, con via manual concreta (AC-RT-07)", () => {
    const resultado = determinarGradoDeDegradacion({
      ...todoBien,
      modeloNoDisponible: true,
    });
    expect(resultado).toMatchObject({
      grado: "sin_modelo",
      puedeProponerAcciones: false,
      debeOfrecerViaManualConcreta: true,
    });
  });

  it("sin_modelo tiene prioridad sobre solo_lectura si ambos ocurren a la vez", () => {
    const resultado = determinarGradoDeDegradacion({
      modeloNoDisponible: true,
      modeloTardando: false,
      coreRechazaEscrituras: true,
    });
    expect(resultado.grado).toBe("sin_modelo");
  });

  it("solo_lectura tiene prioridad sobre lento si ambos ocurren a la vez", () => {
    const resultado = determinarGradoDeDegradacion({
      modeloNoDisponible: false,
      modeloTardando: true,
      coreRechazaEscrituras: true,
    });
    expect(resultado.grado).toBe("solo_lectura");
  });

  it("ningun grado permite inventar una respuesta", () => {
    for (const signal of [
      todoBien,
      { ...todoBien, modeloTardando: true },
      { ...todoBien, coreRechazaEscrituras: true },
      { ...todoBien, modeloNoDisponible: true },
    ]) {
      expect(determinarGradoDeDegradacion(signal).puedeInventarRespuesta).toBe(
        false,
      );
    }
  });
});
