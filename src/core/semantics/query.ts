// Lenguaje de consulta abierta (`20b` §5.2, `W-16`). Declarativo: el modelo
// compone esto, nunca SQL. `user_id` no es un campo de este lenguaje — no
// hay forma de expresarlo aquí (`AC-SEM-01`, `20b` §5.3).

import { z } from "zod";

export const SEMANTIC_COMPARATORS = [
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "entre",
  "en",
  "contiene",
] as const;
export type SemanticComparator = (typeof SEMANTIC_COMPARATORS)[number];

const SemanticRangeValueSchema = z.object({
  desde: z.string().trim().min(1),
  hasta: z.string().trim().min(1),
});
export type SemanticRangeValue = z.infer<typeof SemanticRangeValueSchema>;

const SemanticPredicateValueSchema = z.union([
  z.string().trim().min(1).max(200),
  z.number(),
  z.boolean(),
  z.array(z.string().trim().min(1).max(200)).min(1).max(50),
  z.array(z.number()).min(1).max(50),
  SemanticRangeValueSchema,
]);
export type SemanticPredicateValue = z.infer<typeof SemanticPredicateValueSchema>;

export const SemanticComparisonSchema = z.object({
  kind: z.literal("comparacion"),
  dimension: z.string().trim().min(1).max(80),
  comparador: z.enum(SEMANTIC_COMPARATORS),
  valor: SemanticPredicateValueSchema,
});
export type SemanticComparison = z.infer<typeof SemanticComparisonSchema>;

export type SemanticPredicate =
  | SemanticComparison
  | { kind: "y"; de: SemanticPredicate[] }
  | { kind: "o"; de: SemanticPredicate[] }
  | { kind: "no"; de: SemanticPredicate };

export const SemanticPredicateSchema: z.ZodType<SemanticPredicate> = z.lazy(
  () =>
    z.union([
      SemanticComparisonSchema,
      z.object({
        kind: z.literal("y"),
        de: z.array(SemanticPredicateSchema).min(1).max(12),
      }),
      z.object({
        kind: z.literal("o"),
        de: z.array(SemanticPredicateSchema).min(1).max(12),
      }),
      z.object({ kind: z.literal("no"), de: SemanticPredicateSchema }),
    ]),
);

export const SemanticOrderSchema = z.object({
  por: z.string().trim().min(1).max(80),
  direccion: z.enum(["asc", "desc"]),
});
export type SemanticOrder = z.infer<typeof SemanticOrderSchema>;

export type SemanticQuery = {
  de: string;
  donde: SemanticPredicate | null;
  agrupar_por: string[];
  medir: string[];
  ordenar: SemanticOrder | null;
  limitar: number | null;
  comparar_con: SemanticQuery | null;
  a_partir_de: SemanticQuery | null;
};

export const SemanticQuerySchema: z.ZodType<SemanticQuery> = z.lazy(() =>
  z.object({
    de: z.string().trim().min(1).max(80),
    donde: SemanticPredicateSchema.nullable().default(null),
    agrupar_por: z.array(z.string().trim().min(1).max(80)).max(6).default([]),
    medir: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
    ordenar: SemanticOrderSchema.nullable().default(null),
    limitar: z.number().int().positive().max(50_000).nullable().default(null),
    comparar_con: SemanticQuerySchema.nullable().default(null),
    a_partir_de: SemanticQuerySchema.nullable().default(null),
  }),
);

/** Recorre el árbol `y`/`o`/`no` y devuelve cada dimensión nombrada en una comparación. */
export function dimensionesEnPredicado(
  predicado: SemanticPredicate | null,
): string[] {
  if (!predicado) return [];
  if (predicado.kind === "comparacion") return [predicado.dimension];
  if (predicado.kind === "no") return dimensionesEnPredicado(predicado.de);
  return predicado.de.flatMap((hijo) => dimensionesEnPredicado(hijo));
}
