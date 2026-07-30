// RUL-CAP-01/02 (29 S6): parseo por reglas de una linea de registro rapido.
// Reglas primero, siempre — el modelo (RUL-CAP-01 capa 2) queda fuera de
// este corte (WEB-D202): sin el, una linea que las reglas no resuelven
// simplemente queda parcial y el formulario completo la recibe con el
// texto conservado (AC-CAP-06), que es exactamente el camino sin
// callejones sin salida que RUL-CAP-04/06 exigen.

export type FieldProvenance = "dicho" | "supuesto";

export type ParsedField = {
  value: string | number;
  provenance: FieldProvenance;
  reason?: string;
};

export type QuickAddParseResult = {
  resolved_by: "reglas" | "parcial";
  fields: Partial<Record<"amount" | "type" | "description" | "merchant" | "occurred_at" | "account", ParsedField>>;
  unresolved: string[];
};

export type QuickAddParseContext = {
  /** Cuentas del usuario, para reconocer "yape", "bcp", etc. en la linea. */
  knownAccounts: Array<{ id: string; name: string }>;
  /** "Hoy" en America/Lima, ya resuelto (RUL-CAP-07). */
  todayIso: string;
};

const CURRENCY_WORDS = ["soles", "sol"];
const RELATIVE_DATE_WORDS: Record<string, number> = {
  hoy: 0,
  ayer: 1,
  anteayer: 2,
};
const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "miércoles", "jueves", "viernes", "sabado", "sábado"];

/** RUL-CAP-01/02: intenta resolver una linea de registro rapido solo con reglas. */
export function parseQuickAddLine(
  rawLine: string,
  context: QuickAddParseContext,
): QuickAddParseResult {
  const line = rawLine.trim();
  const fields: QuickAddParseResult["fields"] = {};
  const unresolved: string[] = [];

  if (!line) {
    return { resolved_by: "parcial", fields: {}, unresolved: ["amount", "description"] };
  }

  // RUL-CAP-03: signo de ingreso.
  const isIncome = /^\s*\+/.test(line);
  fields.type = isIncome
    ? { value: "ingreso", provenance: "dicho" }
    : { value: "gasto", provenance: "supuesto" };

  let remaining = line.replace(/^\s*\+/, "").trim();

  // RUL-CAP-02: monto, con o sin "s/" y con coma o punto decimal.
  const amountMatch = /(?:s\/\.?\s*)?(\d+(?:[.,]\d{1,2})?)/i.exec(remaining);
  if (amountMatch) {
    const normalized = Number(amountMatch[1].replace(",", "."));
    if (Number.isFinite(normalized) && normalized > 0) {
      fields.amount = { value: roundMoney(normalized), provenance: "dicho" };
      remaining = (remaining.slice(0, amountMatch.index) + remaining.slice(amountMatch.index + amountMatch[0].length)).trim();
    }
  }
  if (!fields.amount) unresolved.push("amount");

  // Quita palabras de moneda sueltas ("15 soles").
  for (const word of CURRENCY_WORDS) {
    remaining = remaining.replace(new RegExp(`\\b${word}\\b`, "i"), "").trim();
  }

  // RUL-CAP-02: cuenta conocida.
  const matchedAccount = context.knownAccounts.find((account) =>
    new RegExp(`\\b${escapeRegExp(account.name)}\\b`, "i").test(remaining),
  );
  if (matchedAccount) {
    fields.account = {
      value: matchedAccount.id,
      provenance: "supuesto",
      reason: `cuenta mencionada: ${matchedAccount.name}`,
    };
    remaining = remaining.replace(new RegExp(`\\b${escapeRegExp(matchedAccount.name)}\\b`, "i"), "").trim();
  }

  // RUL-CAP-02/RUL-CAP-07: fecha relativa, resuelta en America/Lima.
  const dateResolution = resolveRelativeDate(remaining, context.todayIso);
  if (dateResolution) {
    fields.occurred_at = { value: dateResolution.iso, provenance: "dicho" };
    remaining = dateResolution.remaining;
  } else {
    fields.occurred_at = { value: context.todayIso, provenance: "supuesto" };
  }

  remaining = remaining.replace(/\s+/g, " ").trim();
  if (remaining) {
    fields.description = { value: remaining, provenance: "dicho" };
    fields.merchant = { value: remaining, provenance: "dicho" };
  } else {
    unresolved.push("description");
  }

  return {
    resolved_by: unresolved.length === 0 ? "reglas" : "parcial",
    fields,
    unresolved,
  };
}

function resolveRelativeDate(text: string, todayIso: string): { iso: string; remaining: string } | null {
  for (const [word, daysAgo] of Object.entries(RELATIVE_DATE_WORDS)) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    if (pattern.test(text)) {
      return { iso: subtractDaysIso(todayIso, daysAgo), remaining: text.replace(pattern, "").trim() };
    }
  }
  // "hace N dias"
  const hace = /\bhace\s+(\d+)\s+d[ií]as?\b/i.exec(text);
  if (hace) {
    return {
      iso: subtractDaysIso(todayIso, Number(hace[1])),
      remaining: (text.slice(0, hace.index) + text.slice(hace.index + hace[0].length)).trim(),
    };
  }
  // "el lunes" — el mas reciente PASADO, nunca futuro (29 S19 caso 11).
  for (const weekday of WEEKDAY_NAMES) {
    const pattern = new RegExp(`\\bel\\s+${weekday}\\b`, "i");
    if (pattern.test(text)) {
      return {
        iso: mostRecentPastWeekday(todayIso, weekday),
        remaining: text.replace(pattern, "").trim(),
      };
    }
  }
  return null;
}

function subtractDaysIso(todayIso: string, days: number): string {
  const [year, month, day] = todayIso.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day) - days * 86_400_000;
  const date = new Date(utc);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, "miércoles": 3, jueves: 4, viernes: 5, sabado: 6, "sábado": 6,
};

function mostRecentPastWeekday(todayIso: string, weekdayName: string): string {
  const [year, month, day] = todayIso.split("-").map(Number);
  const todayUtc = Date.UTC(year, month - 1, day);
  const todayWeekday = new Date(todayUtc).getUTCDay();
  const targetWeekday = WEEKDAY_INDEX[weekdayName.toLowerCase()];
  let diff = todayWeekday - targetWeekday;
  if (diff <= 0) diff += 7;
  const resultUtc = todayUtc - diff * 86_400_000;
  const date = new Date(resultUtc);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
