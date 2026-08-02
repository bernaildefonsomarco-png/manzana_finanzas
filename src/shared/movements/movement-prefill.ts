import { CATEGORY_IDS, type CategoryId } from "@/shared/types/domain";

const ALLOWED_KEYS = ["tipo", "monto", "categoria", "fecha", "origen"] as const;
const ALLOWED_KEY_SET = new Set<string>(ALLOWED_KEYS);
const CATEGORY_ID_SET = new Set<string>(CATEGORY_IDS);
const MAX_AMOUNT = 99_999_999_999.99;

export type MovementPrefillOrigin = "descubrimiento" | "proyeccion";

export type MovementPrefill = {
  type: "gasto";
  amount: string;
  categoryId: CategoryId;
  date: string;
  origin: MovementPrefillOrigin;
};

export type MovementPrefillParseResult =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "valid"; value: MovementPrefill };

export type MovementDateFields = { date: string; time: string };

/**
 * WEB-D238: el enlace de Descubrimientos y Proyeccion es un contrato visible,
 * atomico y estricto. Una clave ausente, repetida o desconocida invalida toda
 * la precarga; nunca se aplican solo los campos que alcanzaron a validar.
 */
export function parseMovementPrefill(
  params: URLSearchParams,
): MovementPrefillParseResult {
  if ([...params.keys()].length === 0) return { status: "empty" };

  const unknown = [...new Set([...params.keys()].filter((key) => !ALLOWED_KEY_SET.has(key)))];
  if (unknown.length > 0) {
    return invalid(`No pude usar la precarga porque incluye el parametro desconocido \"${unknown[0]}\".`);
  }

  for (const key of ALLOWED_KEYS) {
    const values = params.getAll(key);
    if (values.length === 0) {
      return invalid(`No pude usar la precarga porque falta el parametro \"${key}\".`);
    }
    if (values.length > 1) {
      return invalid(`No pude usar la precarga porque el parametro \"${key}\" esta repetido.`);
    }
  }

  const type = params.get("tipo");
  if (type !== "gasto") {
    return invalid('No pude usar la precarga porque "tipo" debe ser "gasto".');
  }

  const amount = normalizeAmount(params.get("monto") ?? "");
  if (!amount) {
    return invalid('No pude usar la precarga porque "monto" debe ser un importe PEN positivo con hasta dos decimales.');
  }

  const categoryId = params.get("categoria") ?? "";
  if (!CATEGORY_ID_SET.has(categoryId)) {
    return invalid('No pude usar la precarga porque "categoria" no es una de las doce categorias globales.');
  }

  const date = params.get("fecha") ?? "";
  if (!isValidIsoDate(date)) {
    return invalid('No pude usar la precarga porque "fecha" no es un dia valido en formato AAAA-MM-DD.');
  }

  const origin = params.get("origen");
  if (origin !== "descubrimiento" && origin !== "proyeccion") {
    return invalid('No pude usar la precarga porque "origen" no es valido.');
  }

  return {
    status: "valid",
    value: {
      type,
      amount,
      categoryId: categoryId as CategoryId,
      date,
      origin,
    },
  };
}

/** Construye el unico dialecto admitido por `/movimientos/nuevo`. */
export function buildMovementPrefillHref(input: {
  amount: string | number;
  categoryId: string;
  date: string;
  origin: MovementPrefillOrigin;
}): string | null {
  const amount = normalizeAmount(String(input.amount));
  if (!amount || !CATEGORY_ID_SET.has(input.categoryId) || !isValidIsoDate(input.date)) {
    return null;
  }

  const params = new URLSearchParams({
    tipo: "gasto",
    monto: amount,
    categoria: input.categoryId,
    fecha: input.date,
    origen: input.origin,
  });
  return `/movimientos/nuevo?${params.toString()}`;
}

/**
 * Una simulacion solo conoce el dia. Para hoy se conserva la hora Lima
 * visible del formulario; para un dia pasado (o futuro) no se inventa hora.
 */
export function movementDateFieldsFromPrefill(
  prefill: MovementPrefill | undefined,
  nowInLima: string,
): MovementDateFields {
  const [today, currentTime = ""] = nowInLima.split("T");
  if (!prefill) return { date: today, time: currentTime };
  return {
    date: prefill.date,
    time: prefill.date === today ? currentTime : "",
  };
}

/** Comparacion de dias Lima ya validados, sin depender de la zona del proceso. */
export function isMovementDateFuture(date: string, todayInLima: string): boolean {
  return date > todayInLima;
}

function normalizeAmount(raw: string): string | null {
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) return null;
  return value.toFixed(2);
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1970) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function invalid(message: string): MovementPrefillParseResult {
  return { status: "invalid", message };
}
