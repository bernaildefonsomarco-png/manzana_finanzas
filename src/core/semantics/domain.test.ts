// `AC-SEM-02` (`20b` §2, §5.1, clase `corpus`): el modelo del dominio no
// contiene conocimiento del mundo (feriados, rubros comerciales,
// estacionalidad, puentes). Ese conocimiento lo aporta el modelo, nunca una
// tabla — `20b` §2 explica por qué codificarlo aquí es un error.
import { describe, expect, it } from "vitest";
import { esDimensionConocida, esMedidaConocida } from "@/core/catalog";
import {
  ENTIDADES_SEMANTICAS,
  ENTIDAD_CAJAS,
  ENTIDAD_DEUDAS,
  ENTIDAD_MOVIMIENTOS,
  ENTIDAD_PRESUPUESTOS,
  ENTIDAD_RECURRENTES,
  obtenerEntidadSemantica,
} from "./domain";

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

  // `AC-CATALOGO-10`: el vocabulario no lo inventa este modulo. Una dimension o
  // una medida que no exista en `40` la rechazaria el compilador en tiempo de
  // ejecucion con `dimension_desconocida` / `medida_desconocida`, y el usuario
  // veria un fallo por un nombre que este fichero escribio mal. Se comprueba
  // aqui para que rompa el build, no el turno.
  it("toda dimension y toda medida declarada existe en el catalogo de `40`", () => {
    for (const [nombre, spec] of Object.entries(ENTIDADES_SEMANTICAS)) {
      for (const dimension of Object.keys(spec.dimensionesCompilables)) {
        expect(
          esDimensionConocida(dimension),
          `"${nombre}" declara la dimension "${dimension}", que no esta en el catalogo`,
        ).toBe(true);
      }
      for (const medida of Object.keys(spec.medidasCompilables)) {
        expect(
          esMedidaConocida(medida),
          `"${nombre}" declara la medida "${medida}", que no esta en el catalogo`,
        ).toBe(true);
      }
    }
  });

  it("las cinco entidades apuntan a tablas distintas y reales", () => {
    const tablas = Object.values(ENTIDADES_SEMANTICAS).map((spec) => spec.tabla);
    expect(tablas.sort()).toEqual([
      "boxes",
      "budgets",
      "debts",
      "movements",
      "recurring_rules",
    ]);
    expect(new Set(tablas).size).toBe(tablas.length);
  });

  // `AC-SEM-01`: el aislamiento por usuario no es una convencion de quien
  // escribe la consulta, es una columna declarada por entidad. Una entidad sin
  // `columnaUsuario` compilaria un plan que lee la tabla entera.
  it("toda entidad declara su columna de usuario y su columna de id", () => {
    for (const [nombre, spec] of Object.entries(ENTIDADES_SEMANTICAS)) {
      expect(spec.columnaUsuario, `"${nombre}" sin columna de usuario`).toBe(
        "user_id",
      );
      expect(spec.columnaId, `"${nombre}" sin columna de id`).toBe("id");
    }
  });

  it("cada entidad nueva declara las dimensiones que la hacen util", () => {
    expect(Object.keys(ENTIDAD_DEUDAS.dimensionesCompilables)).toEqual([
      "direccion_deuda",
      "tipo_deuda",
      "estado_deuda",
      "persona",
    ]);
    expect(Object.keys(ENTIDAD_PRESUPUESTOS.dimensionesCompilables)).toEqual([
      "categoria_presupuestada",
      "tipo_presupuesto",
      "periodo_presupuesto",
      "origen_presupuesto",
      "tiene_traspaso",
    ]);
    expect(Object.keys(ENTIDAD_CAJAS.dimensionesCompilables)).toEqual([
      "caja",
      "tipo_caja",
      "cuenta",
    ]);
    expect(Object.keys(ENTIDAD_RECURRENTES.dimensionesCompilables)).toEqual([
      "estado_recurrente",
      "frecuencia_recurrente",
      "variabilidad_monto",
      "origen_recurrente",
      "categoria",
      "subcategoria",
      "cuenta",
      "caja",
    ]);
  });

  // Las cuatro entidades nuevas dejan `fecha` fuera a proposito: ninguna tiene
  // una sola fecha que signifique lo mismo que `occurred_at` en un movimiento.
  // El compilador la rechaza con `dimension_no_compilable`, que dice la verdad;
  // mapearla a una columna cualquiera daria una respuesta segura y equivocada.
  it("ninguna entidad nueva declara `fecha`", () => {
    for (const spec of [
      ENTIDAD_DEUDAS,
      ENTIDAD_PRESUPUESTOS,
      ENTIDAD_CAJAS,
      ENTIDAD_RECURRENTES,
    ]) {
      expect(spec.dimensionesCompilables.fecha).toBeUndefined();
    }
    expect(ENTIDAD_MOVIMIENTOS.dimensionesCompilables.fecha).toBeDefined();
  });
});
