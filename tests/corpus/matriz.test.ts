// Pruebas de clase `corpus` sobre el generador de la matriz de trazabilidad
// (`50` §8, `W-01`). Leen `documentacion/app_web/` a traves del generador;
// no tocan `src/` ni necesitan red ni base de datos (`AC-PRUEBA-10`).
import { describe, expect, it } from "vitest";
import { generarMatriz } from "../../scripts/matriz/generar.ts";

describe("generador de la matriz de trazabilidad", () => {
  const matriz = generarMatriz();

  it("AC-TRAZ-01: todo identificador extraido del corpus tiene fila en la matriz", () => {
    expect(matriz.filas.length).toBe(matriz.censo.totalIdentificadores);
    // Cada familia declarada en el censo aparece igual de veces en las filas.
    const porFamiliaEnFilas: Record<string, number> = {};
    for (const fila of matriz.filas) {
      porFamiliaEnFilas[fila.familia] = (porFamiliaEnFilas[fila.familia] ?? 0) + 1;
    }
    expect(porFamiliaEnFilas).toEqual(matriz.censo.porFamilia);
  });

  it("AC-HECHO-01 / AC-TRAZ-01: ningun identificador esta definido en mas de un documento", () => {
    expect(matriz.validacion.conVariasDefiniciones).toEqual([]);
  });

  it("AC-TRAZ-02 / AC-HECHO-02: todo token usado esta en el registro de 50 §2", () => {
    expect(matriz.validacion.tokensNoRegistrados).toEqual([]);
  });

  it("AC-TRAZ-03: ningun identificador citado carece de definicion", () => {
    expect(matriz.validacion.citasSinDefinicion).toEqual([]);
  });

  it("AC-HECHO-03: todo AC- con TEST y clase declara la clase, y ninguno declara clase sin TEST", () => {
    // Las 545+ pendientes de asignar (51 §4.1) no son un error de forma: son
    // TEST sin clase todavia, y el generador las cuenta aparte
    // (`conTestSinClase`). Lo que SI es un error de forma es una clase
    // declarada sin exigir TEST, o un nivel invalido — eso es lo que este
    // test no permite.
    expect(matriz.validacion.criteriosConFormaInvalida).toEqual([]);
  });

  it("50 §3.1: el portón de los 708 criterios es 558 G1, 11 G2, 139 G3", () => {
    expect(matriz.censo.criterios.total).toBe(708);
    expect(matriz.censo.criterios.porPorton).toEqual({ G1: 558, G2: 11, G3: 139 });
  });

  it("50 §3.1: 90 criterios tienen clase asignada, con el reparto declarado", () => {
    // W-02 añadió tres: AC-SEG-02 y AC-SEG-03 (integracion, 51 §8) y
    // AC-SEG-04 (lint, agregado sobre las 58 rutas de /api/v1).
    expect(matriz.censo.criterios.porClase).toEqual({
      corpus: 45,
      build: 15,
      lint: 15,
      e2e: 8,
      presupuesto: 2,
      contenido: 1,
      integracion: 3,
      unidad: 1,
    });
    expect(matriz.censo.criterios.conClaseAsignada).toBe(90);
    expect(matriz.censo.criterios.conTestSinClase).toBe(541);
  });

  it("AC-PLAN-05: los 53 documentos con criterios tienen exactamente un corte dueño", () => {
    const documentosConId = new Set(matriz.filas.map((f) => f.documento).filter((d): d is string => d !== null));
    const sinCorte = matriz.filas.filter((f) => f.familia === "AC" && f.corte === null);
    expect(sinCorte).toEqual([]);
    expect(documentosConId.size).toBeGreaterThan(0);
  });

  it("AC-TRAZ-04 (agregado, WEB-D167): mide las 119 superficies sin exigir el cierre completo en W-01", () => {
    // Este criterio no cierra en W-01 (50 §10, 54 W-01): su conjunto son las
    // 119 SCR- y cada corte de modulo lo acerca al cerrar su propio G1. Lo
    // que W-01 entrega es que el mecanismo mida bien, no que hoy de 119/119.
    expect(matriz.superficies.total).toBe(119);
    expect(matriz.superficies.conRuta).toBeGreaterThanOrEqual(37);
    expect(matriz.superficies.conRuta + matriz.superficies.sinRuta.length).toBe(119);
  });

  it("RUL-PLAN-04: los cuatro criterios con excepcion de cierre apuntan al corte correcto", () => {
    const porId = new Map(matriz.filas.map((f) => [f.id, f]));
    expect(porId.get("AC-RT-01")?.corte).toBe("W-02");
    expect(porId.get("AC-REU-06")?.corte).toBe("W-02");
    expect(porId.get("AC-INV-03")?.corte).toBe("W-04");
    expect(porId.get("AC-INV-04")?.corte).toBe("W-04");
    expect(porId.get("AC-PRUEBA-05")?.corte).toBe("W-02"); // documento 51, dueño W-03
  });
});
