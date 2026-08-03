import { describe, expect, it } from "vitest";
import {
  comprobarConteoNoSuperaFilas,
  comprobarFechaEnRangoDeEntrada,
  comprobarPorcentajeEnRango,
  comprobarSumaParcialNoSuperaTotal,
  LIMITE_FILAS_CALCULO_AISLADO,
  LIMITE_TIEMPO_MS_CALCULO_AISLADO,
  runIsolatedCalculation,
} from "./sandbox";

describe("runIsolatedCalculation: limites (20b S6.2, 23 S5b.2)", () => {
  it("rechaza sin ejecutar cuando las filas superan el tope de volumen (AC-SEM-12)", () => {
    const filas = new Array(LIMITE_FILAS_CALCULO_AISLADO + 1).fill(0);
    let ejecuto = false;
    const result = runIsolatedCalculation({
      filas,
      referencias: [],
      calcular: () => {
        ejecuto = true;
        return 0;
      },
      explicacion: "no deberia correr",
    });
    expect(ejecuto).toBe(false);
    expect(result).toMatchObject({ emitido: false, razon: "limite_de_filas" });
  });

  it(
    "rechaza sin resultado parcial cuando el calculo excede el tope de tiempo (AC-SEM-13)",
    () => {
      const result = runIsolatedCalculation({
        filas: [1],
        referencias: ["ref:1"],
        calcular: () => {
          const fin = Date.now() + LIMITE_TIEMPO_MS_CALCULO_AISLADO + 100;
          while (Date.now() < fin) {
            // busy-loop deliberado: prueba el tope real, no uno simulado
          }
          return 42;
        },
        explicacion: "calculo deliberadamente lento",
      });
      expect(result).toMatchObject({ emitido: false, razon: "limite_de_tiempo" });
    },
    LIMITE_TIEMPO_MS_CALCULO_AISLADO + 2_000,
  );

  it("captura un error del calculo sin propagar la excepcion", () => {
    const result = runIsolatedCalculation({
      filas: [1, 2, 3],
      referencias: [],
      calcular: () => {
        throw new Error("division por cero");
      },
      explicacion: "calculo que falla",
    });
    expect(result).toMatchObject({ emitido: false, razon: "error_de_calculo", mensaje: "division por cero" });
  });
});

describe("runIsolatedCalculation: comprobaciones de sanidad (20b S6.3, AC-SEM-07)", () => {
  it("no emite un resultado NaN", () => {
    const result = runIsolatedCalculation({
      filas: [1, 2],
      referencias: [],
      calcular: () => Number.NaN,
      explicacion: "produce NaN",
    });
    expect(result).toMatchObject({ emitido: false, razon: "fallo_de_sanidad" });
  });

  it("no emite un resultado infinito", () => {
    const result = runIsolatedCalculation({
      filas: [1, 2],
      referencias: [],
      calcular: () => Number.POSITIVE_INFINITY,
      explicacion: "produce infinito",
    });
    expect(result).toMatchObject({ emitido: false, razon: "fallo_de_sanidad" });
  });

  it("no emite cuando la comprobacion de sanidad especifica falla", () => {
    const result = runIsolatedCalculation({
      filas: [{ monto: 10 }, { monto: 20 }],
      referencias: [],
      calcular: () => 999,
      explicacion: "suma parcial imposible",
      comprobarSanidad: (resultado) => comprobarSumaParcialNoSuperaTotal(resultado, 30),
    });
    expect(result).toMatchObject({ emitido: false, razon: "fallo_de_sanidad" });
  });

  it("emite el resultado cuando pasa todas las comprobaciones", () => {
    const result = runIsolatedCalculation({
      filas: [{ monto: 10 }, { monto: 20 }],
      referencias: ["movimientos:a", "movimientos:b"],
      calcular: (filas) => filas.reduce((acc, f) => acc + f.monto, 0),
      explicacion: "sume los montos de las dos filas",
      supuestos: ["ninguno"],
      comprobarSanidad: (resultado) => comprobarSumaParcialNoSuperaTotal(resultado, 30),
    });
    expect(result).toMatchObject({
      emitido: true,
      resultado: 30,
      referencias: ["movimientos:a", "movimientos:b"],
      explicacion: "sume los montos de las dos filas",
      supuestos: ["ninguno"],
    });
  });
});

describe("comprobaciones de sanidad compositivas (20b S6.3)", () => {
  it("comprobarSumaParcialNoSuperaTotal", () => {
    expect(comprobarSumaParcialNoSuperaTotal(10, 20)).toBeNull();
    expect(comprobarSumaParcialNoSuperaTotal(25, 20)).toMatchObject({ code: "suma_excede_total" });
  });

  it("comprobarConteoNoSuperaFilas", () => {
    expect(comprobarConteoNoSuperaFilas(3, 5)).toBeNull();
    expect(comprobarConteoNoSuperaFilas(6, 5)).toMatchObject({ code: "conteo_excede_filas" });
  });

  it("comprobarPorcentajeEnRango", () => {
    expect(comprobarPorcentajeEnRango(50)).toBeNull();
    expect(comprobarPorcentajeEnRango(-1)).toMatchObject({ code: "porcentaje_fuera_de_rango" });
    expect(comprobarPorcentajeEnRango(101)).toMatchObject({ code: "porcentaje_fuera_de_rango" });
  });

  it("comprobarFechaEnRangoDeEntrada", () => {
    expect(comprobarFechaEnRangoDeEntrada("2026-07-15", "2026-07-01", "2026-07-31")).toBeNull();
    expect(
      comprobarFechaEnRangoDeEntrada("2026-08-01", "2026-07-01", "2026-07-31"),
    ).toMatchObject({ code: "fecha_fuera_de_rango" });
  });
});
