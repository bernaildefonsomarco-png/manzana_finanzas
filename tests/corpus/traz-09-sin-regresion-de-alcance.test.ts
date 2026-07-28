// `AC-TRAZ-09` (`50` §8.1, §10): ninguna funcionalidad marcada `FUERA` en
// `07` §3 tiene fila con `componente` no vacío en la matriz. Falla el
// build, no solo la suite (`51` §7).
//
// Hoy es vacuamente cierto por diseño: `RUL-TRAZ-09` prohíbe que el
// generador adivine la columna `componente` — nadie la ha poblado todavía
// porque ningún corte de módulo ha empezado a construir pantallas (`50`
// §8.1: "cruza la matriz de 07 §3 contra las filas con componente no
// vacío"). El gate real empieza a tener algo que morder en cuanto `W-08`
// escriba el primer componente; hasta entonces, que hoy pase no es una
// promesa vacía, es la precondición que `RUL-TRAZ-09` exige.
import { describe, expect, it } from "vitest";
import { generarMatriz } from "../../scripts/matriz/generar.ts";

describe("AC-TRAZ-09: nada marcado FUERA en 07 §3 tiene componente implementado", () => {
  it("ninguna fila de la matriz tiene componente asignado todavía", () => {
    const matriz = generarMatriz();
    const conComponente = matriz.filas.filter((f) => f.componente !== null);
    expect(conComponente).toEqual([]);
  });
});
