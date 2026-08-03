import { describe, expect, it } from "vitest";
import {
  dimensionesEnPredicado,
  SemanticQuerySchema,
  type SemanticQuery,
} from "./query";

describe("SemanticQuerySchema (20b S5.2)", () => {
  it("acepta una consulta minima: de + medir", () => {
    const parsed = SemanticQuerySchema.parse({
      de: "movimientos",
      medir: ["suma"],
    });
    expect(parsed.donde).toBeNull();
    expect(parsed.agrupar_por).toEqual([]);
    expect(parsed.limitar).toBeNull();
  });

  it("acepta un predicado y/o/no anidado", () => {
    const parsed = SemanticQuerySchema.parse({
      de: "movimientos",
      donde: {
        kind: "y",
        de: [
          { kind: "comparacion", dimension: "tipo_movimiento", comparador: "=", valor: "gasto" },
          {
            kind: "o",
            de: [
              { kind: "comparacion", dimension: "comercio", comparador: "contiene", valor: "rappi" },
              { kind: "no", de: { kind: "comparacion", dimension: "estado_movimiento", comparador: "=", valor: "eliminado" } },
            ],
          },
        ],
      },
      medir: ["suma"],
    });
    expect(parsed.donde?.kind).toBe("y");
  });

  it("acepta un rango de fechas arbitrario en el predicado (20b S5.2: sin dimension es_feriado)", () => {
    const parsed = SemanticQuerySchema.parse({
      de: "movimientos",
      donde: {
        kind: "comparacion",
        dimension: "fecha",
        comparador: "entre",
        valor: { desde: "2026-07-26", hasta: "2026-07-30" },
      },
      medir: ["suma"],
    });
    expect(parsed.donde).toMatchObject({ comparador: "entre" });
  });

  it("acepta a_partir_de para conjuntos derivados (comercios con conteo=1, luego su suma)", () => {
    const subconsulta: SemanticQuery = {
      de: "movimientos",
      donde: null,
      agrupar_por: ["comercio"],
      medir: ["conteo"],
      ordenar: null,
      limitar: null,
      comparar_con: null,
      a_partir_de: null,
    };
    const parsed = SemanticQuerySchema.parse({
      de: "movimientos",
      medir: ["suma"],
      a_partir_de: subconsulta,
    });
    expect(parsed.a_partir_de?.agrupar_por).toEqual(["comercio"]);
  });

  it("rechaza una consulta sin ninguna medida", () => {
    expect(() =>
      SemanticQuerySchema.parse({ de: "movimientos", medir: [] }),
    ).toThrow();
  });

  it("no tiene forma de expresar user_id (AC-SEM-01): el esquema lo rechaza como campo desconocido", () => {
    const conCampoExtra = {
      de: "movimientos",
      medir: ["suma"],
      user_id: "00000000-0000-4000-8000-000000000001",
    };
    const parsed = SemanticQuerySchema.parse(conCampoExtra);
    expect(parsed).not.toHaveProperty("user_id");
  });
});

describe("dimensionesEnPredicado", () => {
  it("devuelve vacio para un predicado nulo", () => {
    expect(dimensionesEnPredicado(null)).toEqual([]);
  });

  it("extrae la dimension de una comparacion simple", () => {
    expect(
      dimensionesEnPredicado({
        kind: "comparacion",
        dimension: "comercio",
        comparador: "=",
        valor: "rappi",
      }),
    ).toEqual(["comercio"]);
  });

  it("recorre y/o/no y devuelve todas las dimensiones nombradas", () => {
    const predicado = {
      kind: "y" as const,
      de: [
        { kind: "comparacion" as const, dimension: "tipo_movimiento", comparador: "=" as const, valor: "gasto" },
        {
          kind: "no" as const,
          de: { kind: "comparacion" as const, dimension: "estado_movimiento", comparador: "=" as const, valor: "eliminado" },
        },
      ],
    };
    expect(dimensionesEnPredicado(predicado)).toEqual([
      "tipo_movimiento",
      "estado_movimiento",
    ]);
  });
});
