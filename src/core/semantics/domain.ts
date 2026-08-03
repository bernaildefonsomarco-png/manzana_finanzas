// Modelo del dominio para la consulta abierta (`20b` §5.1, `W-16`). El
// vocabulario (qué dimensiones/medidas existen y quién las declara) ya vive
// en `src/core/catalog` (`40`, `W-16` fase 1) — este módulo solo declara,
// por entidad, cuáles de esas dimensiones/medidas ya sabe compilar el
// compilador a una consulta real. Una dimensión puede existir en el
// catálogo y no estar aquí todavía: el compilador la rechaza con
// `dimension_no_compilable`, no la ignora en silencio (`WEB-D257`).

export type SemanticColumnType =
  | "texto"
  | "enum"
  | "referencia"
  | "fecha"
  | "numero"
  | "booleano";

export type SemanticColumnMapping = {
  columna: string;
  tipo: SemanticColumnType;
};

export type SemanticMeasureMapping = {
  /** `null` para medidas que no leen una columna (p. ej. `conteo`). */
  columna: string | null;
};

export type SemanticEntitySpec = {
  nombre: string;
  tabla: string;
  columnaUsuario: string;
  columnaId: string;
  /** Dimensiones del catálogo (`40`) que este compilador ya sabe traducir. */
  dimensionesCompilables: Record<string, SemanticColumnMapping>;
  /** Medidas del catálogo (`40`) que este compilador ya sabe traducir. */
  medidasCompilables: Record<string, SemanticMeasureMapping>;
};

// `26` §4/§14: movimientos, la entidad que usan casi todos los ejemplos de
// `20b` §8. Las columnas reales vienen de `src/data/supabase/types.ts`.
// Fuera de alcance en esta fase (existen en el catálogo, no aquí todavía):
// las dimensiones de calendario derivado (`dia_semana`, `quincena`,
// `franja_horaria`, `semana_del_mes`), las que exigen agregar todo el
// historial (`frecuencia_comercio`, `es_primera_vez`,
// `dias_desde_anterior_igual`, `desviacion_de_su_promedio`), y
// `afecta_saldo`/`tiene_adjunto`/`tiene_nota`; y de las medidas, `mediana`,
// `percentil`, `conteo_comercios_distintos` y `proporcion_del_total`
// (`WEB-D257`).
export const ENTIDAD_MOVIMIENTOS: SemanticEntitySpec = {
  nombre: "movimientos",
  tabla: "movements",
  columnaUsuario: "user_id",
  columnaId: "id",
  dimensionesCompilables: {
    tipo_movimiento: { columna: "type", tipo: "enum" },
    estado_movimiento: { columna: "status", tipo: "enum" },
    origen_movimiento: { columna: "source", tipo: "enum" },
    comercio: { columna: "merchant", tipo: "texto" },
    cuenta: { columna: "account_origin_id", tipo: "referencia" },
    caja: { columna: "box_origin_id", tipo: "referencia" },
    fecha: { columna: "occurred_at", tipo: "fecha" },
  },
  medidasCompilables: {
    suma: { columna: "amount" },
    conteo: { columna: null },
    promedio: { columna: "amount" },
    maximo: { columna: "amount" },
    minimo: { columna: "amount" },
  },
};

export const ENTIDADES_SEMANTICAS: Record<string, SemanticEntitySpec> = {
  movimientos: ENTIDAD_MOVIMIENTOS,
};

export function obtenerEntidadSemantica(
  nombre: string,
): SemanticEntitySpec | null {
  return ENTIDADES_SEMANTICAS[nombre] ?? null;
}
