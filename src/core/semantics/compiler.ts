// Compilador de la consulta abierta (`20b` §5.3/§3.1, `W-16`). Único lugar
// del sistema donde vive el acceso a datos de esta capa: valida contra el
// modelo del dominio, inyecta `user_id` (el lenguaje no puede expresarlo,
// `AC-SEM-01`), acota filas y ejecuta contra Supabase (que parametriza sus
// consultas — misma garantía de seguridad que "SQL parametrizado", con el
// constructor que ya usa el resto del código en vez de texto SQL propio).

import type { SupabaseClient } from "@supabase/supabase-js";
import { esDimensionConocida, esMedidaConocida } from "@/core/catalog";
import {
  ENTIDADES_SEMANTICAS,
  obtenerEntidadSemantica,
  type SemanticEntitySpec,
} from "./domain";
import {
  dimensionesEnPredicado,
  type SemanticPredicate,
  type SemanticQuery,
} from "./query";

export const LIMITE_MAXIMO_FILAS_CONSULTA = 50_000;

export type SemanticCompileIssueCode =
  | "entidad_desconocida"
  | "dimension_desconocida"
  | "dimension_no_compilable"
  | "medida_desconocida"
  | "medida_no_compilable"
  | "predicado_no_compilable"
  | "orden_invalido";

export type SemanticCompileIssue = {
  code: SemanticCompileIssueCode;
  path: string;
  message: string;
};

export type CompiledSemanticPlan = {
  entidad: string;
  tabla: string;
  columnaUsuario: string;
  columnaId: string;
  userId: string;
  filtros: SemanticPredicate | null;
  agruparPor: string[];
  medir: string[];
  ordenar: { columna: string; direccion: "asc" | "desc" } | null;
  limite: number;
};

export type SemanticCompileResult =
  | { ok: true; plan: CompiledSemanticPlan }
  | { ok: false; issues: SemanticCompileIssue[] };

/**
 * `AC-SEM-01`: `userId` es un parámetro de esta función, nunca un campo de
 * `SemanticQuery` — no existe forma de que la consulta lo exprese o lo
 * altere.
 */
export function compileSemanticQuery(
  query: SemanticQuery,
  userId: string,
): SemanticCompileResult {
  const issues: SemanticCompileIssue[] = [];
  const entidad = obtenerEntidadSemantica(query.de);
  if (!entidad) {
    return {
      ok: false,
      issues: [
        {
          code: "entidad_desconocida",
          path: "de",
          message: `La entidad "${query.de}" no existe en el modelo del dominio (${Object.keys(ENTIDADES_SEMANTICAS).join(", ")}).`,
        },
      ],
    };
  }

  for (const nombre of query.agrupar_por) {
    validarDimension(nombre, entidad, "agrupar_por", issues);
  }
  for (const nombre of dimensionesEnPredicado(query.donde)) {
    validarDimension(nombre, entidad, "donde", issues);
  }
  if (
    query.donde &&
    predicadoUsaCombinadorNoSoportado(query.donde) &&
    issues.every((issue) => issue.path !== "donde")
  ) {
    issues.push({
      code: "predicado_no_compilable",
      path: "donde",
      message:
        "Este compilador aun solo traduce combinaciones \"y\" (AND); \"o\" y \"no\" no estan soportados todavia.",
    });
  }

  for (const nombre of query.medir) {
    if (!esMedidaConocida(nombre)) {
      issues.push({
        code: "medida_desconocida",
        path: "medir",
        message: `La medida "${nombre}" no existe en el vocabulario abierto de lectura.`,
      });
      continue;
    }
    if (!entidad.medidasCompilables[nombre]) {
      issues.push({
        code: "medida_no_compilable",
        path: "medir",
        message: `La medida "${nombre}" existe en el catalogo, pero el compilador de "${entidad.nombre}" aun no la traduce.`,
      });
    }
  }

  let ordenar: CompiledSemanticPlan["ordenar"] = null;
  if (query.ordenar) {
    const columnaDimension = entidad.dimensionesCompilables[query.ordenar.por];
    if (columnaDimension) {
      ordenar = { columna: columnaDimension.columna, direccion: query.ordenar.direccion };
    } else if (query.medir.includes(query.ordenar.por)) {
      // Ordenar por una medida solicitada no tiene columna propia: se
      // resuelve fuera del compilador (agregación), no aqui.
      ordenar = null;
    } else {
      issues.push({
        code: "orden_invalido",
        path: "ordenar",
        message: `No se puede ordenar por "${query.ordenar.por}": no es una dimension compilable ni una medida solicitada en "medir".`,
      });
    }
  }

  const limite = Math.min(
    query.limitar ?? LIMITE_MAXIMO_FILAS_CONSULTA,
    LIMITE_MAXIMO_FILAS_CONSULTA,
  );

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    plan: {
      entidad: entidad.nombre,
      tabla: entidad.tabla,
      columnaUsuario: entidad.columnaUsuario,
      columnaId: entidad.columnaId,
      userId,
      filtros: query.donde,
      agruparPor: query.agrupar_por,
      medir: query.medir,
      ordenar,
      limite,
    },
  };
}

function validarDimension(
  nombre: string,
  entidad: SemanticEntitySpec,
  path: string,
  issues: SemanticCompileIssue[],
): void {
  if (!esDimensionConocida(nombre)) {
    issues.push({
      code: "dimension_desconocida",
      path,
      message: `La dimension "${nombre}" no existe en el vocabulario abierto de lectura.`,
    });
    return;
  }
  if (!entidad.dimensionesCompilables[nombre]) {
    issues.push({
      code: "dimension_no_compilable",
      path,
      message: `La dimension "${nombre}" existe en el catalogo, pero el compilador de "${entidad.nombre}" aun no la traduce.`,
    });
  }
}

function predicadoUsaCombinadorNoSoportado(
  predicado: SemanticPredicate,
): boolean {
  if (predicado.kind === "comparacion") return false;
  if (predicado.kind === "o" || predicado.kind === "no") return true;
  return predicado.de.some((hijo) => predicadoUsaCombinadorNoSoportado(hijo));
}

export type SemanticExecutionResult =
  | { ok: true; filas: Array<Record<string, unknown>>; referencias: string[] }
  | { ok: false; error: string };

/**
 * Subconjunto encadenable del query builder de supabase-js que este módulo
 * necesita. El tipo exacto (`PostgrestFilterBuilder<...>`) depende del
 * esquema generado por tabla; esta capa opera sobre cualquier tabla del
 * dominio, así que se tipa estructuralmente en vez de acoplarse a una tabla.
 */
type SemanticQueryBuilder = {
  eq: (column: string, value: unknown) => SemanticQueryBuilder;
  neq: (column: string, value: unknown) => SemanticQueryBuilder;
  gt: (column: string, value: unknown) => SemanticQueryBuilder;
  gte: (column: string, value: unknown) => SemanticQueryBuilder;
  lt: (column: string, value: unknown) => SemanticQueryBuilder;
  lte: (column: string, value: unknown) => SemanticQueryBuilder;
  in: (column: string, values: readonly (string | number)[]) => SemanticQueryBuilder;
  ilike: (column: string, pattern: string) => SemanticQueryBuilder;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => SemanticQueryBuilder;
  limit: (count: number) => SemanticQueryBuilder;
  then: <T>(
    resolve: (value: { data: unknown[] | null; error: { message: string } | null }) => T,
  ) => Promise<T>;
};

/**
 * `20b` §5.3/§5.4: ejecuta el plan ya compilado y devuelve filas + sus
 * referencias — nunca solo el resultado. La única llamada a Supabase de
 * esta capa; `plan.userId` es lo unico que decide de quien son los datos.
 */
export async function executeSemanticQuery(
  client: SupabaseClient,
  plan: CompiledSemanticPlan,
): Promise<SemanticExecutionResult> {
  const entidad = obtenerEntidadSemantica(plan.entidad);
  if (!entidad) {
    return { ok: false, error: `Entidad "${plan.entidad}" sin definicion en el dominio.` };
  }

  let builder = client
    .from(plan.tabla)
    .select("*")
    .eq(plan.columnaUsuario, plan.userId) as unknown as SemanticQueryBuilder;

  if (plan.filtros) {
    builder = aplicarPredicadoAnd(builder, plan.filtros, entidad);
  }
  if (plan.ordenar) {
    builder = builder.order(plan.ordenar.columna, {
      ascending: plan.ordenar.direccion === "asc",
    });
  }
  builder = builder.limit(plan.limite);

  const { data, error } = await builder;
  if (error) {
    return { ok: false, error: error.message ?? String(error) };
  }
  const filas = (data ?? []) as Array<Record<string, unknown>>;
  const referencias = filas.map(
    (fila) => `${plan.entidad}:${String(fila[entidad.columnaId])}`,
  );
  return { ok: true, filas, referencias };
}

function aplicarPredicadoAnd(
  builder: SemanticQueryBuilder,
  predicado: SemanticPredicate,
  entidad: SemanticEntitySpec,
): SemanticQueryBuilder {
  if (predicado.kind !== "y" && predicado.kind !== "comparacion") {
    // El compilador ya rechazo "o"/"no" antes de producir un plan; esta
    // rama solo se alcanza si alguien construye un plan a mano.
    throw new Error(
      `aplicarPredicadoAnd recibio un combinador no soportado: "${predicado.kind}".`,
    );
  }
  const comparaciones =
    predicado.kind === "y" ? predicado.de : [predicado];
  let siguiente = builder;
  for (const comparacion of comparaciones) {
    if (comparacion.kind !== "comparacion") {
      throw new Error("Solo se soportan comparaciones dentro de \"y\".");
    }
    siguiente = aplicarComparacion(siguiente, comparacion, entidad);
  }
  return siguiente;
}

function aplicarComparacion(
  builder: SemanticQueryBuilder,
  comparacion: Extract<SemanticPredicate, { kind: "comparacion" }>,
  entidad: SemanticEntitySpec,
): SemanticQueryBuilder {
  const mapeo = entidad.dimensionesCompilables[comparacion.dimension];
  if (!mapeo) {
    throw new Error(
      `Dimension "${comparacion.dimension}" sin mapeo de columna al ejecutar.`,
    );
  }
  const { columna } = mapeo;
  const { comparador, valor } = comparacion;
  switch (comparador) {
    case "=":
      return builder.eq(columna, valor);
    case "!=":
      return builder.neq(columna, valor);
    case ">":
      return builder.gt(columna, valor);
    case ">=":
      return builder.gte(columna, valor);
    case "<":
      return builder.lt(columna, valor);
    case "<=":
      return builder.lte(columna, valor);
    case "en":
      return builder.in(columna, valor as string[] | number[]);
    case "contiene":
      return builder.ilike(columna, `%${String(valor)}%`);
    case "entre": {
      const rango = valor as { desde: string; hasta: string };
      return builder.gte(columna, rango.desde).lte(columna, rango.hasta);
    }
    default:
      throw new Error(`Comparador "${comparador}" sin traduccion.`);
  }
}
