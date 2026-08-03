// `AC-SEM-02` (`20b` §2, §5.1, clase `corpus`): el modelo del dominio no
// contiene conocimiento del mundo (feriados, rubros comerciales,
// estacionalidad, puentes). Ese conocimiento lo aporta el modelo, nunca una
// tabla — `20b` §2 explica por qué codificarlo aquí es un error.
import { describe, expect, it } from "vitest";
import { ENTIDADES_SEMANTICAS, ENTIDAD_MOVIMIENTOS, obtenerEntidadSemantica } from "./domain";

const TERMINOS_DE_CONOCIMIENTO_DEL_MUNDO = [
  "feriado",
  "puente",
  "temporada",
  "estacional",
  "rubro",
  "navidad",
  "fiestas patrias",
];

function textoDeLaEntidad(nombreEntidad: string, spec: (typeof ENTIDADES_SEMANTICAS)[string]): string {
  return JSON.stringify({ nombreEntidad, ...spec }).toLowerCase();
}

describe("modelo del dominio: AC-SEM-02, ningun conocimiento del mundo", () => {
  it("ninguna entidad declarada menciona un termino de conocimiento del mundo", () => {
    for (const [nombre, spec] of Object.entries(ENTIDADES_SEMANTICAS)) {
      const texto = textoDeLaEntidad(nombre, spec);
      for (const termino of TERMINOS_DE_CONOCIMIENTO_DEL_MUNDO) {
        expect(texto, `"${nombre}" menciona "${termino}"`).not.toContain(termino);
      }
    }
  });

  it("obtenerEntidadSemantica devuelve null para una entidad que no existe", () => {
    expect(obtenerEntidadSemantica("criptomonedas")).toBeNull();
  });

  it("movimientos declara al menos las dimensiones de columna directa de 26 S14", () => {
    expect(Object.keys(ENTIDAD_MOVIMIENTOS.dimensionesCompilables)).toEqual(
      expect.arrayContaining([
        "tipo_movimiento",
        "estado_movimiento",
        "origen_movimiento",
        "comercio",
        "cuenta",
        "caja",
        "fecha",
      ]),
    );
  });
});
