// Paginacion por cursor (`14` §5, `AC-API-01`, `AC-API-02`). Sustituye el
// `limit` suelto: el cliente nunca ve ni construye el cursor, solo lo
// reenvia. `total` no se calcula salvo que se pida explicitamente
// (`include_total`), porque contar la tabla entera en cada pagina es caro.

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

export function clampLimit(rawLimit: number | null | undefined): number {
  if (rawLimit === null || rawLimit === undefined) return DEFAULT_PAGE_LIMIT;
  if (!Number.isFinite(rawLimit) || rawLimit < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.floor(rawLimit), MAX_PAGE_LIMIT);
}

export type Cursor = { o: string; i: string };

export function encodeCursor(orderValue: string, id: string): string {
  return Buffer.from(JSON.stringify({ o: orderValue, i: id }), "utf8").toString(
    "base64url"
  );
}

/** `null` significa "sin cursor" (primera pagina). `"invalid"` significa que el
 * cliente envio un cursor que no se puede decodificar: eso es un
 * `VALIDATION_ERROR`, no una primera pagina silenciosa. */
export function decodeCursor(raw: string | null | undefined): Cursor | null | "invalid" {
  if (!raw) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      decoded &&
      typeof decoded === "object" &&
      typeof (decoded as Record<string, unknown>).o === "string" &&
      typeof (decoded as Record<string, unknown>).i === "string"
    ) {
      return decoded as Cursor;
    }
    return "invalid";
  } catch {
    return "invalid";
  }
}

/**
 * Construye el filtro `.or(...)` de PostgREST para "la siguiente fila tras el
 * cursor", dado un orden estable `column desc, id desc` (o `asc`).
 * `column` y el desempate por `id` deben coincidir exactamente con el
 * `.order(...)` real de la consulta (`14` §5: "orden estable obligatorio").
 */
export function buildCursorOrFilter(
  column: string,
  cursor: Cursor,
  direction: "asc" | "desc" = "desc"
): string {
  const op = direction === "desc" ? "lt" : "gt";
  return `${column}.${op}.${cursor.o},and(${column}.eq.${cursor.o},id.${op}.${cursor.i})`;
}

export type PageMeta = {
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
  total?: number;
};

/**
 * Recorta el resultado de una consulta pedida con `limit + 1` filas al
 * `limit` real, y deriva `next_cursor`/`has_more` de la fila sobrante.
 */
export function paginate<T extends { id: string }>(
  overFetchedRows: T[],
  limit: number,
  getOrderValue: (row: T) => string
): { data: T[]; page: PageMeta } {
  const hasMore = overFetchedRows.length > limit;
  const data = hasMore ? overFetchedRows.slice(0, limit) : overFetchedRows;
  const last = data[data.length - 1];

  return {
    data,
    page: {
      next_cursor: hasMore && last ? encodeCursor(getOrderValue(last), last.id) : null,
      has_more: hasMore,
      limit,
    },
  };
}

// Version compuesta: para ordenes de mas de una columna (p.ej. `movements`,
// que ordena `created_at desc, occurred_at desc` antes del desempate por
// `id` — `sortMovementsByRegistrationRecency`). El caso de una sola columna
// arriba es el caso particular de este con un solo elemento en `o`.

export type CompositeCursor = { o: string[]; i: string };

export function encodeCompositeCursor(orderValues: string[], id: string): string {
  return Buffer.from(JSON.stringify({ o: orderValues, i: id }), "utf8").toString(
    "base64url"
  );
}

export function decodeCompositeCursor(
  raw: string | null | undefined
): CompositeCursor | null | "invalid" {
  if (!raw) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const candidate = decoded as Record<string, unknown>;
    if (
      decoded &&
      typeof decoded === "object" &&
      Array.isArray(candidate.o) &&
      candidate.o.every((value) => typeof value === "string") &&
      typeof candidate.i === "string"
    ) {
      return decoded as CompositeCursor;
    }
    return "invalid";
  } catch {
    return "invalid";
  }
}

/** Igual que `buildCursorOrFilter`, pero para N columnas de orden antes del
 * desempate por `id`: `col1.lt.v1,and(col1.eq.v1,col2.lt.v2),and(col1.eq.v1,col2.eq.v2,id.lt.i)`. */
export function buildCompositeCursorOrFilter(
  columns: string[],
  cursor: CompositeCursor,
  direction: "asc" | "desc" = "desc"
): string {
  const op = direction === "desc" ? "lt" : "gt";
  const terms: string[] = [];

  for (let level = 0; level < columns.length; level++) {
    const equalityParts = columns
      .slice(0, level)
      .map((column, index) => `${column}.eq.${cursor.o[index]}`);
    const comparisonPart = `${columns[level]}.${op}.${cursor.o[level]}`;
    const parts = [...equalityParts, comparisonPart];
    terms.push(parts.length === 1 ? parts[0] : `and(${parts.join(",")})`);
  }

  const tiebreakEquality = columns.map(
    (column, index) => `${column}.eq.${cursor.o[index]}`
  );
  terms.push(`and(${[...tiebreakEquality, `id.${op}.${cursor.i}`].join(",")})`);

  return terms.join(",");
}

/**
 * Paginacion en memoria para catalogos pequenos y acotados por usuario
 * (cuentas, cajas, categorias, subcategorias, etiquetas): ya se trae la
 * tabla entera (docenas de filas como mucho), asi que en vez de construir
 * un filtro `.or(...)` de cursor contra SQL, se ubica la posicion del
 * cursor dentro del array ya ordenado y se recorta ahi. El formato del
 * cursor sigue siendo el mismo opaco de `encodeCursor`/`decodeCursor`
 * (`o` se rellena con el propio `id`, no se usa para comparar).
 */
export function paginateInMemory<T extends { id: string }>(
  sortedRows: T[],
  limit: number,
  cursor: Cursor | null
): { data: T[]; page: PageMeta } {
  const startIndex = cursor
    ? sortedRows.findIndex((row) => row.id === cursor.i) + 1
    : 0;
  const window = sortedRows.slice(startIndex, startIndex + limit + 1);
  const hasMore = window.length > limit;
  const data = hasMore ? window.slice(0, limit) : window;
  const last = data[data.length - 1];

  return {
    data,
    page: {
      next_cursor: hasMore && last ? encodeCursor(last.id, last.id) : null,
      has_more: hasMore,
      limit,
    },
  };
}

export function paginateComposite<T extends { id: string }>(
  overFetchedRows: T[],
  limit: number,
  getOrderValues: (row: T) => string[]
): { data: T[]; page: PageMeta } {
  const hasMore = overFetchedRows.length > limit;
  const data = hasMore ? overFetchedRows.slice(0, limit) : overFetchedRows;
  const last = data[data.length - 1];

  return {
    data,
    page: {
      next_cursor:
        hasMore && last ? encodeCompositeCursor(getOrderValues(last), last.id) : null,
      has_more: hasMore,
      limit,
    },
  };
}
