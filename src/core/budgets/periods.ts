import { addCalendarDays, parseIsoDate, toIsoDate } from "@/shared/dates/lima";
import type { BudgetPeriod, BudgetPeriodKind } from "./types";

export function budgetPeriodContaining(
  isoDate: string,
  kind: BudgetPeriodKind
): BudgetPeriod {
  const date = requireValidIsoDate(isoDate);

  if (kind === "mensual") {
    return {
      start: toIsoDate(date.year, date.month, 1),
      end: toIsoDate(
        date.year,
        date.month,
        daysInUtcMonth(date.year, date.month)
      ),
    };
  }

  if (kind === "quincenal") {
    const startsOn = date.day <= 15 ? 1 : 16;
    const endsOn =
      date.day <= 15 ? 15 : daysInUtcMonth(date.year, date.month);
    return {
      start: toIsoDate(date.year, date.month, startsOn),
      end: toIsoDate(date.year, date.month, endsOn),
    };
  }

  const weekday = new Date(
    Date.UTC(date.year, date.month, date.day)
  ).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const start = addCalendarDays(isoDate, -daysSinceMonday);
  return { start, end: addCalendarDays(start, 6) };
}

export function nextBudgetPeriod(
  period: BudgetPeriod,
  kind: BudgetPeriodKind
): BudgetPeriod {
  return budgetPeriodContaining(addCalendarDays(period.end, 1), kind);
}

export function previousBudgetPeriod(
  period: BudgetPeriod,
  kind: BudgetPeriodKind
): BudgetPeriod {
  return budgetPeriodContaining(addCalendarDays(period.start, -1), kind);
}

export function requireValidIsoDate(isoDate: string) {
  const parts = parseIsoDate(isoDate);
  if (!parts || toIsoDate(parts.year, parts.month, parts.day) !== isoDate) {
    throw new Error(`Fecha ISO invalida: ${isoDate}`);
  }
  const date = new Date(Date.UTC(parts.year, parts.month, parts.day));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month ||
    date.getUTCDate() !== parts.day
  ) {
    throw new Error(`Fecha ISO invalida: ${isoDate}`);
  }
  return parts;
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
