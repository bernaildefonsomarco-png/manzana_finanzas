import type {
  RecurringFrequency,
  RecurringOccurrence,
  RecurringOccurrenceStatus,
  RecurringRule,
} from "@/shared/types/domain";
import {
  addCalendarDays,
  isoDateInLima,
  parseIsoDate,
  toIsoDate,
} from "@/shared/dates/lima";

export { addCalendarDays, isoDateInLima };

export const RECURRING_OCCURRENCE_HORIZON_DAYS = 60;

const OPEN_OCCURRENCE_STATUSES: RecurringOccurrenceStatus[] = [
  "expected",
  "due_soon",
  "pending_confirmation",
  "overdue",
];

export type RecurringOccurrenceDraft = {
  user_id: string;
  recurring_rule_id: string;
  expected_date: string;
  expected_amount: number | null;
  status: RecurringOccurrenceStatus;
  metadata: {
    created_from: "recurring_occurrence_horizon_job";
    horizon_days: number;
  };
};

export type RecurringOccurrenceStatusUpdate = {
  id: string;
  status: "pending_confirmation" | "overdue";
};

export type RecurringOccurrenceHorizonPlan = {
  inserts: RecurringOccurrenceDraft[];
  status_updates: RecurringOccurrenceStatusUpdate[];
};

export type RecurringDuePresentation = {
  state: "upcoming" | "pending_confirmation" | "overdue";
  label: "Próximo" | "Pago pendiente" | "Vencido";
  days_late: number;
};

/**
 * Planea el horizonte diario sin escribir. El índice único
 * `(recurring_rule_id, expected_date)` es la última barrera de concurrencia;
 * eliminar las fechas existentes aquí hace que una segunda corrida sea un
 * no-op aun antes del upsert.
 */
export function planRecurringOccurrenceHorizon(params: {
  rules: RecurringRule[];
  occurrences: RecurringOccurrence[];
  asOfDate: string;
  horizonDays?: number;
}): RecurringOccurrenceHorizonPlan {
  const horizonDays =
    params.horizonDays ?? RECURRING_OCCURRENCE_HORIZON_DAYS;
  const existingKeys = new Set(
    params.occurrences.map(
      (occurrence) =>
        `${occurrence.recurring_rule_id}:${occurrence.expected_date}`
    )
  );
  const inserts: RecurringOccurrenceDraft[] = [];

  for (const rule of params.rules) {
    if (
      rule.status !== "active" ||
      rule.deleted_at ||
      !rule.next_expected_date
    ) {
      continue;
    }

    for (const expectedDate of buildHorizonDates(
      rule.next_expected_date,
      rule.frequency,
      rule.day_of_month,
      params.asOfDate,
      horizonDays
    )) {
      const key = `${rule.id}:${expectedDate}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      inserts.push({
        user_id: rule.user_id,
        recurring_rule_id: rule.id,
        expected_date: expectedDate,
        expected_amount: rule.expected_amount,
        status: recurringOccurrenceStatusForDate(
          expectedDate,
          params.asOfDate
        ),
        metadata: {
          created_from: "recurring_occurrence_horizon_job",
          horizon_days: horizonDays,
        },
      });
    }
  }

  const status_updates = params.occurrences
    .filter((occurrence) =>
      OPEN_OCCURRENCE_STATUSES.includes(occurrence.status)
    )
    .map((occurrence) => {
      const status = recurringOccurrenceStatusForDate(
        occurrence.expected_date,
        params.asOfDate
      );
      return status === "pending_confirmation" || status === "overdue"
        ? { id: occurrence.id, status }
        : null;
    })
    .filter(
      (
        update
      ): update is RecurringOccurrenceStatusUpdate => update !== null
    )
    .filter((update) => {
      const occurrence = params.occurrences.find(
        (candidate) => candidate.id === update.id
      );
      return occurrence?.status !== update.status;
    });

  return { inserts, status_updates };
}

/**
 * RUL-REC-10: en la fecha esperada y durante los dos días siguientes el
 * lenguaje es prudente; recién desde el tercer día se considera vencido.
 */
export function recurringDuePresentation(
  expectedDate: string,
  asOfDate: string
): RecurringDuePresentation {
  const daysLate = differenceInCalendarDays(asOfDate, expectedDate);
  if (daysLate < 0) {
    return { state: "upcoming", label: "Próximo", days_late: 0 };
  }
  if (daysLate <= 2) {
    return {
      state: "pending_confirmation",
      label: "Pago pendiente",
      days_late: daysLate,
    };
  }
  return { state: "overdue", label: "Vencido", days_late: daysLate };
}

export function recurringOccurrenceStatusForDate(
  expectedDate: string,
  asOfDate: string
): RecurringOccurrenceStatus {
  const state = recurringDuePresentation(expectedDate, asOfDate).state;
  return state === "upcoming" ? "expected" : state;
}

function buildHorizonDates(
  nextExpectedDate: string,
  frequency: RecurringFrequency,
  dayOfMonth: number | null,
  asOfDate: string,
  horizonDays: number
): string[] {
  const horizonDate = addCalendarDays(asOfDate, horizonDays);
  const dates: string[] = [];
  let cursor = nextExpectedDate;

  // Se conserva una sola fecha ya vencida como compromiso abierto y se
  // avanza hasta el horizonte. Así no se inventa un historial retroactivo
  // completo cuando una regla antigua vuelve a activarse.
  if (cursor < asOfDate) {
    dates.push(cursor);
    while (cursor < asOfDate) {
      cursor = nextRecurringDate(cursor, frequency, dayOfMonth);
    }
  }

  while (cursor <= horizonDate) {
    dates.push(cursor);
    cursor = nextRecurringDate(cursor, frequency, dayOfMonth);
  }

  return [...new Set(dates)];
}

function nextRecurringDate(
  baseDate: string,
  frequency: RecurringFrequency,
  dayOfMonth: number | null
): string {
  if (frequency === "weekly") return addCalendarDays(baseDate, 7);
  if (frequency === "biweekly") return addCalendarDays(baseDate, 14);
  if (frequency === "yearly") return addCalendarYears(baseDate, 1);
  return addCalendarMonths(baseDate, 1, dayOfMonth);
}

function addCalendarMonths(
  isoDate: string,
  months: number,
  preferredDay: number | null
): string {
  const parts = requireIsoDate(isoDate);
  const first = new Date(Date.UTC(parts.year, parts.month + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const day = Math.min(
    Math.max(preferredDay ?? parts.day, 1),
    lastDay
  );
  return toIsoDate(first.getUTCFullYear(), first.getUTCMonth(), day);
}

function addCalendarYears(isoDate: string, years: number): string {
  const parts = requireIsoDate(isoDate);
  const lastDay = new Date(
    Date.UTC(parts.year + years, parts.month + 1, 0)
  ).getUTCDate();
  return toIsoDate(
    parts.year + years,
    parts.month,
    Math.min(parts.day, lastDay)
  );
}

function differenceInCalendarDays(left: string, right: string): number {
  const leftParts = requireIsoDate(left);
  const rightParts = requireIsoDate(right);
  return Math.round(
    (Date.UTC(leftParts.year, leftParts.month, leftParts.day) -
      Date.UTC(rightParts.year, rightParts.month, rightParts.day)) /
      86_400_000
  );
}

function requireIsoDate(value: string) {
  const parts = parseIsoDate(value);
  if (!parts) throw new Error(`Fecha ISO inválida: ${value}`);
  return parts;
}
