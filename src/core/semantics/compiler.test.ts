import { describe, expect, it, vi } from "vitest";
import {
  compileSemanticQuery,
  executeSemanticQuery,
  LIMITE_MAXIMO_FILAS_CONSULTA,
} from "./compiler";
import type { SemanticQuery } from "./query";

const userId = "00000000-0000-4000-8000-000000000001";

function baseQuery(overrides: Partial<SemanticQuery> = {}): SemanticQuery {
  return {
    de: "movimientos",
    donde: null,
    agrupar_por: [],
    medir: ["suma"],
    ordenar: null,
    limitar: null,
    comparar_con: null,
    a_partir_de: null,
    ...overrides,
  };
}

describe("compileSemanticQuery: validacion contra el modelo del dominio (20b S5.3)", () => {
  it("rechaza una entidad que no existe", () => {
    const result = compileSemanticQuery(baseQuery({ de: "criptomonedas" }), userId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]).toMatchObject({ code: "entidad_desconocida" });
    }
  });

  it("rechaza una dimension inventada en donde", () => {
    const result = compileSemanticQuery(
      baseQuery({
        donde: { kind: "comparacion", dimension: "signo_zodiacal", comparador: "=", valor: "leo" },
      }),
      userId,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.code)).toContain("dimension_desconocida");
    }
  });

  it("rechaza una dimension real del catalogo que este compilador aun no traduce", () => {
    const result = compileSemanticQuery(
      baseQuery({ agrupar_por: ["dia_semana"] }),
      userId,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]).toMatchObject({ code: "dimension_no_compilable" });
    }
  });

  it("rechaza una medida real del catalogo que este compilador aun no traduce", () => {
    const result = compileSemanticQuery(baseQuery({ medir: ["mediana"] }), userId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]).toMatchObject({ code: "medida_no_compilable" });
    }
  });

  it("rechaza una medida inventada", () => {
    const result = compileSemanticQuery(baseQuery({ medir: ["suma_magica"] }), userId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]).toMatchObject({ code: "medida_desconocida" });
    }
  });

  it("rechaza un predicado \"o\" (aun no soportado)", () => {
    const result = compileSemanticQuery(
      baseQuery({
        donde: {
          kind: "o",
          de: [
            { kind: "comparacion", dimension: "tipo_movimiento", comparador: "=", valor: "gasto" },
            { kind: "comparacion", dimension: "tipo_movimiento", comparador: "=", valor: "ingreso" },
          ],
        },
      }),
      userId,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.code)).toContain("predicado_no_compilable");
    }
  });

  it("acepta una consulta con predicado \"y\" sobre dimensiones compilables", () => {
    const result = compileSemanticQuery(
      baseQuery({
        donde: {
          kind: "y",
          de: [
            { kind: "comparacion", dimension: "tipo_movimiento", comparador: "=", valor: "gasto" },
            { kind: "comparacion", dimension: "comercio", comparador: "contiene", valor: "rappi" },
          ],
        },
        agrupar_por: ["tipo_movimiento"],
        medir: ["suma", "conteo"],
      }),
      userId,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.tabla).toBe("movements");
      expect(result.plan.userId).toBe(userId);
    }
  });

  it("acota el limite pedido al tope maximo (AC-SEM-12: nunca mas de lo que el sandbox admite)", () => {
    const result = compileSemanticQuery(
      baseQuery({ limitar: LIMITE_MAXIMO_FILAS_CONSULTA + 10_000 }),
      userId,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.limite).toBe(LIMITE_MAXIMO_FILAS_CONSULTA);
    }
  });
});

describe("compileSemanticQuery: AC-SEM-01, el lenguaje no puede expresar user_id", () => {
  it("el plan compilado usa el userId del parametro, sin importar lo que traiga la consulta", () => {
    const query = baseQuery();
    // `SemanticQuery` no tiene un campo `user_id` en su tipo: no hay forma
    // de que este test lo pase dentro de `query` ni de que el compilador lo
    // lea de ahi. La unica fuente es el segundo parametro de la funcion.
    const result = compileSemanticQuery(query, userId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.userId).toBe(userId);
    }
  });
});

/** Mock encadenable minimo del query builder de supabase-js (mismo patron
 * que `src/app/api/v1/movements/route.test.ts`). */
function fakeSupabaseClient(rows: unknown[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "neq", "gt", "gte", "lt", "lte", "in", "ilike", "order"];
  for (const method of chainMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.limit = vi.fn((n: number) => {
    calls.push({ method: "limit", args: [n] });
    return builder;
  });
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: rows, error: null });

  return {
    client: { from: vi.fn(() => builder) },
    calls,
  };
}

describe("executeSemanticQuery: ejecucion real contra el cliente (20b S5.3/S5.4)", () => {
  it("inyecta el user_id como filtro real, con evidencia por construccion", async () => {
    const { client, calls } = fakeSupabaseClient([
      { id: "m1", amount: 20 },
      { id: "m2", amount: 8 },
    ]);
    const compiled = compileSemanticQuery(baseQuery(), userId);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const result = await executeSemanticQuery(
      client as unknown as Parameters<typeof executeSemanticQuery>[0],
      compiled.plan,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filas).toHaveLength(2);
      expect(result.referencias).toEqual(["movimientos:m1", "movimientos:m2"]);
    }
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "user_id" && c.args[1] === userId)).toBe(true);
  });

  it("traduce el predicado y a filtros encadenados reales", async () => {
    const { client, calls } = fakeSupabaseClient([]);
    const compiled = compileSemanticQuery(
      baseQuery({
        donde: {
          kind: "y",
          de: [
            { kind: "comparacion", dimension: "tipo_movimiento", comparador: "=", valor: "gasto" },
            { kind: "comparacion", dimension: "comercio", comparador: "contiene", valor: "rappi" },
          ],
        },
      }),
      userId,
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    await executeSemanticQuery(
      client as unknown as Parameters<typeof executeSemanticQuery>[0],
      compiled.plan,
    );

    expect(calls).toContainEqual({ method: "eq", args: ["type", "gasto"] });
    expect(calls).toContainEqual({ method: "ilike", args: ["merchant", "%rappi%"] });
  });

  it("aplica el limite compilado en la ejecucion", async () => {
    const { client, calls } = fakeSupabaseClient([]);
    const compiled = compileSemanticQuery(baseQuery({ limitar: 25 }), userId);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    await executeSemanticQuery(
      client as unknown as Parameters<typeof executeSemanticQuery>[0],
      compiled.plan,
    );

    expect(calls).toContainEqual({ method: "limit", args: [25] });
  });
});
