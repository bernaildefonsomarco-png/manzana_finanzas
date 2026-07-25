import type {
  CategoryId,
  Movement,
  MovementSource,
  MovementStatus,
  MovementType,
} from "@/shared/types/domain";

export type MovementViewItem = {
  id: string;
  title: string;
  description: string;
  categoryLabel: string;
  type: MovementType;
  typeLabel: string;
  amount: number;
  occurredAt: string;
  timeLabel: string;
  accountLabel: string;
  sourceLabel: string;
  status: MovementStatus;
  requiresReview: boolean;
};

export const categoryLabels: Record<CategoryId, string> = {
  alimentacion: "Alimentación",
  transporte: "Transporte",
  vivienda_hogar: "Vivienda / Hogar",
  servicios_suscripciones: "Servicios / Suscripciones",
  salud: "Salud",
  educacion: "Educación",
  ocio_salidas: "Ocio / Salidas",
  compras_personales: "Compras personales",
  familia_apoyo: "Familia / Apoyo",
  deudas: "Deudas",
  trabajo_productividad: "Trabajo / Productividad",
  otros: "Otros",
};

export const movementTypeLabels: Record<MovementType, string> = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  transferencia: "Transferencia",
  asignacion_interna: "Asignación interna",
  deuda_adquirida: "Deuda adquirida",
  pago_deuda: "Pago deuda",
  prestamo_dado: "Préstamo dado",
  prestamo_recibido: "Préstamo recibido",
  devolucion_recibida: "Devolución recibida",
  pago_recurrente: "Pago recurrente",
  ajuste: "Ajuste",
};

const sourceLabels: Record<MovementSource, string> = {
  whatsapp: "WhatsApp",
  dashboard_manual: "Dashboard",
  email_confirmed: "Email confirmado",
  recurring_confirmed: "Recurrente confirmado",
  backfill_confirmed: "Reconstrucción",
  system_adjustment: "Ajuste de sistema",
};

export function toMovementViewItem(movement: Movement): MovementViewItem {
  const title =
    cleanText(movement.merchant) ??
    cleanText(movement.description) ??
    movementTypeLabels[movement.type];

  return {
    id: movement.id,
    title,
    description: formatMovementDate(movement.occurred_at),
    categoryLabel: movement.category_id
      ? categoryLabels[movement.category_id]
      : "Sin categoría",
    type: movement.type,
    typeLabel: movementTypeLabels[movement.type],
    amount: Number(movement.amount),
    occurredAt: movement.occurred_at,
    timeLabel: formatMovementTime(movement.occurred_at),
    accountLabel: getAccountLabel(movement),
    sourceLabel: sourceLabels[movement.source],
    status: movement.status,
    requiresReview: movement.requires_review,
  };
}

export function movementMatchesSearchQuery(
  movement: MovementViewItem,
  query: string
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !SEARCH_STOP_WORDS.has(token));

  if (tokens.length === 0) return true;

  const contentTokens = tokens.filter(
    (token) => !GENERIC_MOVEMENT_SEARCH_TOKENS.has(token)
  );
  const activeTokens = contentTokens.length > 0 ? contentTokens : tokens;
  const haystack = normalizeSearchText(
    [
      movement.title,
      movement.description,
      movement.categoryLabel,
      movement.typeLabel,
      movement.accountLabel,
      movement.sourceLabel,
      movement.timeLabel,
      movement.status,
    ].join(" ")
  );

  return activeTokens.some((token) => textIncludesToken(haystack, token));
}

export function isIncomeType(type: MovementType): boolean {
  return (
    type === "ingreso" ||
    type === "prestamo_recibido" ||
    type === "devolucion_recibida"
  );
}

export function isTransferType(type: MovementType): boolean {
  return type === "transferencia" || type === "asignacion_interna";
}

const SEARCH_STOP_WORDS = new Set([
  "a",
  "al",
  "algo",
  "cada",
  "con",
  "cual",
  "cuando",
  "de",
  "del",
  "dime",
  "donde",
  "el",
  "en",
  "esa",
  "ese",
  "eso",
  "esta",
  "este",
  "estos",
  "hice",
  "la",
  "las",
  "le",
  "lo",
  "los",
  "me",
  "mi",
  "mis",
  "para",
  "por",
  "que",
  "se",
  "sobre",
  "su",
  "sus",
  "tu",
  "tus",
  "un",
  "una",
  "y",
]);

const GENERIC_MOVEMENT_SEARCH_TOKENS = new Set([
  "gaste",
  "gastes",
  "gasto",
  "gastos",
  "ingreso",
  "ingresos",
  "movimiento",
  "movimientos",
  "pago",
  "pagos",
  "registre",
  "registro",
  "registros",
  "transaccion",
  "transacciones",
]);

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textIncludesToken(text: string, token: string): boolean {
  if (text.includes(token)) return true;
  if (token.endsWith("s") && token.length > 3) {
    return text.includes(token.slice(0, -1));
  }
  return false;
}

export function getMovementGroupLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Por revisar";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / 86_400_000
  );

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(date);
}

export function formatMovementDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Fecha por revisar";

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMovementTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getAccountLabel(movement: Movement): string {
  const origin = movement.account_origin_id;
  const destination = movement.account_destination_id;

  if (origin && destination) return "Cuenta origen -> destino";
  if (origin) return "Cuenta vinculada";
  if (destination) return "Cuenta vinculada";

  return "Sin cuenta";
}

function cleanText(value: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}
