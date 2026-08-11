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

// `31` §4/§14: deudas. Las columnas reales vienen de `debts` en
// `src/data/supabase/types.ts`.
//
// Fuera de alcance a proposito (existen en el catalogo, no aqui):
//
//  - `fecha`. Una deuda tiene cuatro fechas distintas y ninguna es "la" fecha:
//    `opened_at`, `due_date`, `next_payment_date` y `closed_at`. Mapear la
//    dimension generica a una de ellas convertiria "deudas de este mes" en una
//    respuesta segura y equivocada. El compilador la rechaza con
//    `dimension_no_compilable`, que es exactamente lo que hay que decir.
//  - `tiene_calendario`, `deuda_cubierta_por_caja`, `dias_hasta_proxima_cuota`
//    y `progreso_pago`: todas se derivan de otra tabla o de aritmetica sobre
//    filas, no de una columna de `debts`.
//  - `estado_cuota`: es de `debt_installments`, otra entidad.
//
// `saldo_total_debido` y `saldo_total_a_favor` leen la **misma** columna y las
// separa `direccion_deuda`, no el nombre de la medida: el motor no agrega, solo
// declara que columna lee cada una. Quien mida "lo que te deben" sin filtrar
// por direccion esta preguntando mal, y `saldo_total_a_favor` ademas exige
// advertencia obligatoria (`40` §6.3, `medidaExigeAdvertencia`).
export const ENTIDAD_DEUDAS: SemanticEntitySpec = {
  nombre: "deudas",
  tabla: "debts",
  columnaUsuario: "user_id",
  columnaId: "id",
  dimensionesCompilables: {
    direccion_deuda: { columna: "direction", tipo: "enum" },
    tipo_deuda: { columna: "kind", tipo: "enum" },
    estado_deuda: { columna: "status", tipo: "enum" },
    persona: { columna: "related_person_id", tipo: "referencia" },
  },
  medidasCompilables: {
    conteo: { columna: null },
    saldo_total_debido: { columna: "current_balance" },
    saldo_total_a_favor: { columna: "current_balance" },
    suma: { columna: "current_balance" },
    promedio: { columna: "current_balance" },
    maximo: { columna: "current_balance" },
    minimo: { columna: "current_balance" },
  },
};

// `32` §4/§14: presupuestos y limites. Columnas reales de `budgets`.
//
// Fuera de alcance a proposito:
//
//  - `fecha`. Un presupuesto no tiene fecha: tiene un periodo
//    (`period_start`..`period_end`). Lo que si se puede pedir es su
//    `periodo_presupuesto`.
//  - `tramo_avance`, `gastado_en_presupuesto`, `restante`, `porcentaje_avance`
//    y `desviacion_vs_periodo_anterior`: todas necesitan cruzar movimientos
//    contra el periodo del presupuesto. Eso es un calculo, no una columna.
//  - `estado_meta` y `meta_respaldada` son de metas (`goals`), no de aqui.
export const ENTIDAD_PRESUPUESTOS: SemanticEntitySpec = {
  nombre: "presupuestos",
  tabla: "budgets",
  columnaUsuario: "user_id",
  columnaId: "id",
  dimensionesCompilables: {
    categoria_presupuestada: { columna: "category_id", tipo: "referencia" },
    tipo_presupuesto: { columna: "kind", tipo: "enum" },
    periodo_presupuesto: { columna: "period_kind", tipo: "enum" },
    origen_presupuesto: { columna: "source", tipo: "enum" },
    tiene_traspaso: { columna: "rollover", tipo: "booleano" },
  },
  medidasCompilables: {
    conteo: { columna: null },
    total_presupuestado: { columna: "amount" },
    suma: { columna: "amount" },
    promedio: { columna: "amount" },
    maximo: { columna: "amount" },
    minimo: { columna: "amount" },
  },
};

// `24` §4/§14: cajas — dinero realmente separado dentro de una cuenta.
// Columnas reales de `boxes`.
//
// Fuera de alcance a proposito: `caja_tiene_meta`, `caja_vinculada_a_deuda` y
// `movimiento_cubierto_por_caja` son "si/no" derivados de que una columna sea
// nula o no, y el lenguaje de consulta no tiene "es nulo": una comparacion
// `= true` contra `linked_debt_id` no filtraria nada. `progreso_caja` es una
// division entre dos columnas, o sea un calculo.
export const ENTIDAD_CAJAS: SemanticEntitySpec = {
  nombre: "cajas",
  tabla: "boxes",
  columnaUsuario: "user_id",
  columnaId: "id",
  dimensionesCompilables: {
    caja: { columna: "id", tipo: "referencia" },
    tipo_caja: { columna: "type", tipo: "enum" },
    cuenta: { columna: "account_id", tipo: "referencia" },
  },
  medidasCompilables: {
    conteo: { columna: null },
    separado_total: { columna: "current_balance" },
    suma: { columna: "current_balance" },
    promedio: { columna: "current_balance" },
    maximo: { columna: "current_balance" },
    minimo: { columna: "current_balance" },
  },
};

// `30` §4/§14: pagos recurrentes. Columnas reales de `recurring_rules`.
//
// Fuera de alcance a proposito:
//
//  - `fecha`: mismo problema que en deudas — `created_at` y
//    `next_expected_date` no significan lo mismo y elegir por el modelo seria
//    responder otra pregunta. `dias_hasta_vencimiento` es ademas aritmetica
//    sobre la fecha de hoy, no una columna.
//  - `estado_ocurrencia` es de `recurring_occurrences`, otra tabla.
//  - `compromiso_cubierto_por_caja` y `recurrente_vinculado_a_deuda` son
//    "si/no" derivados de columnas nulables, igual que en cajas.
//  - `total_no_cubierto` necesita cruzar la regla con el saldo de su caja.
//  - `comercio`: `merchant_pattern` es un patron de deteccion, no el nombre del
//    comercio. Mapearlo haria que "recurrentes de Netflix" dependiera de como
//    se escribio una regex.
export const ENTIDAD_RECURRENTES: SemanticEntitySpec = {
  nombre: "recurrentes",
  tabla: "recurring_rules",
  columnaUsuario: "user_id",
  columnaId: "id",
  dimensionesCompilables: {
    estado_recurrente: { columna: "status", tipo: "enum" },
    frecuencia_recurrente: { columna: "frequency", tipo: "enum" },
    variabilidad_monto: { columna: "amount_variability", tipo: "enum" },
    origen_recurrente: { columna: "source", tipo: "enum" },
    categoria: { columna: "category_id", tipo: "referencia" },
    subcategoria: { columna: "subcategory_id", tipo: "referencia" },
    cuenta: { columna: "default_account_id", tipo: "referencia" },
    caja: { columna: "linked_box_id", tipo: "referencia" },
  },
  medidasCompilables: {
    conteo: { columna: null },
    total_comprometido: { columna: "expected_amount" },
    suma: { columna: "expected_amount" },
    promedio: { columna: "expected_amount" },
    maximo: { columna: "expected_amount" },
    minimo: { columna: "expected_amount" },
  },
};

export const ENTIDADES_SEMANTICAS: Record<string, SemanticEntitySpec> = {
  movimientos: ENTIDAD_MOVIMIENTOS,
  deudas: ENTIDAD_DEUDAS,
  presupuestos: ENTIDAD_PRESUPUESTOS,
  cajas: ENTIDAD_CAJAS,
  recurrentes: ENTIDAD_RECURRENTES,
};

export function obtenerEntidadSemantica(
  nombre: string,
): SemanticEntitySpec | null {
  return ENTIDADES_SEMANTICAS[nombre] ?? null;
}
