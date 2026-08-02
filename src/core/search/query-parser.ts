// 38 §6, RUL-BUS-04: los filtros se parsean con reglas, no con el modelo.
// RUL-BUS-03: cuando la consulta no se reduce a filtros y texto, se pasa
// el testigo al asistente en vez de intentar buscar.

export type ParsedAmountFilter =
  | { kind: "exact"; amount: number }
  | { kind: "gt"; amount: number }
  | { kind: "lt"; amount: number };

export type ParsedDateRangeFilter = { from: string; to: string; label: string };

export type ParsedQuery = {
  freeText: string;
  amount: ParsedAmountFilter | null;
  dateRange: ParsedDateRangeFilter | null;
  isQuestion: boolean;
};

const QUESTION_WORDS = [
  "cuanto",
  "cuánto",
  "cuantos",
  "cuántos",
  "cuanta",
  "cuánta",
  "cuantas",
  "cuántas",
  "por que",
  "por qué",
  "cual",
  "cuál",
  "cuales",
  "cuáles",
  "como",
  "cómo",
  "cuando",
  "cuándo",
];

const CALCULATION_VERBS = [
  "compara",
  "comparame",
  "compárame",
  "compárame",
  "suma",
  "sumame",
  "súmame",
  "promedio",
  "promedia",
  "total",
];

const MONTH_NAMES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** RUL-BUS-03: detección determinista de preguntas, sin modelo. */
export function isQuestionLikeQuery(rawQuery: string): boolean {
  const normalized = stripAccents(rawQuery.trim().toLowerCase());
  if (rawQuery.includes("?")) return true;
  if (QUESTION_WORDS.some((word) => normalized.startsWith(stripAccents(word)))) return true;
  const words = normalized.split(/\s+/);
  if (CALCULATION_VERBS.some((verb) => words.includes(stripAccents(verb)))) return true;
  return false;
}

function extractAmount(text: string): { filter: ParsedAmountFilter | null; rest: string } {
  const comparison = text.match(/(^|\s)([<>])\s*s?\/?\s*(\d+(?:[.,]\d{1,2})?)/i);
  if (comparison) {
    const amount = Number(comparison[3]!.replace(",", "."));
    const filter: ParsedAmountFilter = { kind: comparison[2] === ">" ? "gt" : "lt", amount };
    return { filter, rest: text.replace(comparison[0], " ") };
  }
  const exact = text.match(/(^|\s)s\/\s?(\d+(?:[.,]\d{1,2})?)(\s|$)/i) ?? text.match(/(^|\s)(\d+[.,]\d{2})(\s|$)/);
  if (exact) {
    const raw = exact[2] ?? exact[0];
    const amount = Number(raw.replace(",", "."));
    if (!Number.isNaN(amount)) {
      return { filter: { kind: "exact", amount }, rest: text.replace(exact[0], " ") };
    }
  }
  return { filter: null, rest: text };
}

function extractDateRange(
  text: string,
  now: Date,
  timezone: string,
): { filter: ParsedDateRangeFilter | null; rest: string } {
  const normalized = stripAccents(text.toLowerCase());

  for (const [name, month] of Object.entries(MONTH_NAMES)) {
    const withYear = new RegExp(`\\b${name}\\s+(\\d{4})\\b`);
    const yearMatch = normalized.match(withYear);
    const year = yearMatch ? Number(yearMatch[1]) : normalized.includes(name) ? currentYear(now, timezone) : null;
    if (year !== null && normalized.includes(name)) {
      const from = isoDate(year, month, 1);
      const to = isoDate(year, month, daysInMonth(year, month));
      const pattern = yearMatch ? new RegExp(`${name}\\s+\\d{4}`, "i") : new RegExp(name, "i");
      return {
        filter: { from, to, label: `${capitalize(name)} ${year}` },
        rest: text.replace(pattern, " "),
      };
    }
  }

  if (/\bhoy\b/.test(normalized)) {
    const today = localIsoDate(now, timezone);
    return { filter: { from: today, to: today, label: "Hoy" }, rest: text.replace(/\bhoy\b/i, " ") };
  }
  if (/\bayer\b/.test(normalized)) {
    const yesterday = localIsoDate(new Date(now.getTime() - 86_400_000), timezone);
    return { filter: { from: yesterday, to: yesterday, label: "Ayer" }, rest: text.replace(/\bayer\b/i, " ") };
  }
  if (/\best[ae]\s+semana\b/.test(normalized)) {
    const { from, to } = currentWeekRange(now, timezone);
    return { filter: { from, to, label: "Esta semana" }, rest: text.replace(/\best[ae]\s+semana\b/i, " ") };
  }
  if (/\best[ae]\s+mes\b/.test(normalized)) {
    const today = localIsoDate(now, timezone);
    const [y, m] = today.split("-").map(Number) as [number, number];
    return {
      filter: { from: isoDate(y, m, 1), to: isoDate(y, m, daysInMonth(y, m)), label: "Este mes" },
      rest: text.replace(/\best[ae]\s+mes\b/i, " "),
    };
  }

  const explicitRange = text.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
  if (explicitRange) {
    const year = currentYear(now, timezone);
    const [, d1, m1, d2, m2] = explicitRange.map(Number) as unknown as [number, number, number, number, number];
    return {
      filter: {
        from: isoDate(year, m1, d1),
        to: isoDate(year, m2, d2),
        label: `${explicitRange[1]}/${explicitRange[2]} al ${explicitRange[3]}/${explicitRange[4]}`,
      },
      rest: text.replace(explicitRange[0], " "),
    };
  }

  return { filter: null, rest: text };
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function currentYear(now: Date, timezone: string): number {
  return Number(localIsoDate(now, timezone).slice(0, 4));
}

function localIsoDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function currentWeekRange(now: Date, timezone: string): { from: string; to: string } {
  const today = localIsoDate(now, timezone);
  const date = new Date(`${today}T12:00:00Z`);
  const dow = date.getUTCDay(); // 0=domingo
  const isoDow = dow === 0 ? 7 : dow; // lunes=1 ... domingo=7
  const monday = new Date(date.getTime() - (isoDow - 1) * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

const MAX_QUERY_LENGTH = 200;
const MAX_RANGE_DAYS = 366;

// Caracteres de control (U+0000–U+001F y U+007F). Se construye con
// String.fromCharCode en vez de un literal de regex para no depender de
// bytes de control incrustados en el propio código fuente.
const CONTROL_CHARS_PATTERN = new RegExp(
  `[${Array.from({ length: 33 }, (_, i) => String.fromCharCode(i <= 31 ? i : 127)).join("")}]`,
  "g",
);

export function parseSearchQuery(
  rawQuery: string,
  options: { now?: Date; timezone?: string } = {},
): ParsedQuery {
  const now = options.now ?? new Date();
  const timezone = options.timezone ?? "America/Lima";

  // Los caracteres de control se eliminan antes de parsear (§7).
  const sanitized = rawQuery.replace(CONTROL_CHARS_PATTERN, "").slice(0, MAX_QUERY_LENGTH);
  const trimmed = sanitized.trim();

  if (trimmed.length === 0) {
    return { freeText: "", amount: null, dateRange: null, isQuestion: false };
  }

  if (isQuestionLikeQuery(trimmed)) {
    return { freeText: trimmed, amount: null, dateRange: null, isQuestion: true };
  }

  const { filter: amount, rest: afterAmount } = extractAmount(trimmed);
  const { filter: dateRange, rest: afterDate } = extractDateRange(afterAmount, now, timezone);
  const freeText = afterDate.replace(/\s+/g, " ").trim();

  return { freeText, amount, dateRange, isQuestion: false };
}

export function validateDateRange(from: string, to: string): { valid: true } | { valid: false; error: "invalid_order" | "range_too_long" } {
  if (to < from) return { valid: false, error: "invalid_order" };
  const days = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
  if (days > MAX_RANGE_DAYS) return { valid: false, error: "range_too_long" };
  return { valid: true };
}
