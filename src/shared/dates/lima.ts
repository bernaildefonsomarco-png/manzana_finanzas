// Único módulo de utilidades de fecha para toda la aplicación (`17` §6,
// `AC-PAT-09`): antes había cuatro helpers duplicados entre pantallas
// (`todayInputDate`, `toPaymentIso`, `formatMovementDate`,
// `toLocalDateTimeInput`). `America/Lima` es UTC-5 todo el año, sin horario
// de verano (`18` §9.2) — por eso la conversión de zona no necesita una
// base de datos de zonas horarias (Luxon/date-fns-tz): un offset fijo de
// -05:00 basta y es lo que este módulo usa.
import { addMonths, differenceInCalendarDays } from "date-fns";

const LIMA_TZ = "America/Lima";
const LIMA_OFFSET_MINUTES = 5 * 60;

export type LimaDateParts = { year: number; month: number; day: number };

/** "Hoy" en `America/Lima`, no en la zona del navegador ni del servidor. */
export function todayInLima(): LimaDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

export function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseIsoDate(value: string): LimaDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** `0` = domingo, igual que `Date#getDay()`, para alinear la cuadrícula. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const WEEKDAY_LABELS_ES = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * Caso difícil de `WEB-D165`/`AC-PAT-10`: una hora local de Lima (por
 * ejemplo `23:30` del 14 de julio) se guarda siempre como `timestamptz` en
 * UTC (`17` §6). Como Lima es UTC-5 fijo, sumar 5 horas basta — sin tabla de
 * zonas horarias — y produce el mismo instante que interpretar la cadena
 * como si fuera Lima.
 */
export function limaLocalInputToUtcIso(localDateTime: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime);
  if (!match) throw new Error(`Fecha/hora local inválida: ${localDateTime}`);
  const [, y, mo, d, h, mi] = match;
  const utcMs =
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) +
    LIMA_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}

/** El inverso: un instante UTC, mostrado como fecha/hora de Lima. */
export function utcIsoToLimaParts(
  utcIso: string
): LimaDateParts & { hour: number; minute: number } {
  const date = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month") - 1,
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

/**
 * Suma meses con el mismo criterio de fin de mes que `date-fns` (recorta al
 * último día del mes destino: 31 de enero + 1 mes = 28 o 29 de febrero,
 * nunca 3 de marzo). Necesario para el vencimiento de pagos recurrentes
 * mensuales (`26`, `31`) sin reintroducir el arrastre que produce
 * `Date#setMonth` a mano.
 */
export function addMonthsClamped(iso: string, months: number): string {
  const parts = parseIsoDate(iso);
  if (!parts) throw new Error(`Fecha ISO inválida: ${iso}`);
  // `date-fns` opera con los getters/setters *locales* de `Date`
  // (`getMonth`/`setMonth`), no los UTC. Construir con `Date.UTC` y leer de
  // vuelta con `getUTC*` mezcla dos calendarios distintos en cuanto la zona
  // del proceso no es UTC — descubierto con este mismo caso (`31 de enero`
  // se convertía en `1 de marzo` en vez de `28 de febrero` bajo `TZ=America/
  // Lima`). Esta función solo hace aritmética de calendario (año/mes/día),
  // nunca un instante real, así que usar el constructor y los getters
  // locales de punta a punta es correcto sin importar la zona del proceso.
  const base = new Date(parts.year, parts.month, parts.day);
  const result = addMonths(base, months);
  return toIsoDate(result.getFullYear(), result.getMonth(), result.getDate());
}

/** Formatos de `16` §6 / `18` §9.2. `reference` existe para pruebas deterministas. */
export function formatRelativeLimaDate(iso: string, reference: LimaDateParts = todayInLima()): string {
  const parts = parseIsoDate(iso);
  if (!parts) throw new Error(`Fecha ISO inválida: ${iso}`);
  const target = new Date(Date.UTC(parts.year, parts.month, parts.day));
  const today = new Date(Date.UTC(reference.year, reference.month, reference.day));
  const diff = differenceInCalendarDays(today, target);

  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff > 1 && diff <= 7) return `hace ${diff} días`;

  const day = String(parts.day);
  const month = MONTH_NAMES_ES[parts.month].slice(0, 3);
  if (parts.year === reference.year) return `${day} ${month}`;
  return `${day} ${month} ${parts.year}`;
}
