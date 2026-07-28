import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  firstWeekdayOfMonth,
  parseIsoDate,
  toIsoDate,
} from "./date-lima";

describe("date-lima", () => {
  it("toIsoDate rellena mes y dia con cero a la izquierda", () => {
    expect(toIsoDate(2026, 0, 5)).toBe("2026-01-05");
  });

  it("parseIsoDate valida el formato YYYY-MM-DD y descompone mes 0-indexado", () => {
    expect(parseIsoDate("2026-07-14")).toEqual({ year: 2026, month: 6, day: 14 });
    expect(parseIsoDate("14/07/2026")).toBeNull();
    expect(parseIsoDate("no es fecha")).toBeNull();
    expect(parseIsoDate("20260714")).toBeNull();
  });

  it("daysInMonth cuenta febrero bisiesto correctamente", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2025, 1)).toBe(28);
  });

  it("firstWeekdayOfMonth coincide con Date#getDay()", () => {
    expect(firstWeekdayOfMonth(2026, 6)).toBe(new Date(2026, 6, 1).getDay());
  });
});
