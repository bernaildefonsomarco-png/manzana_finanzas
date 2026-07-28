import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  daysInMonth,
  firstWeekdayOfMonth,
  formatRelativeLimaDate,
  limaLocalInputToUtcIso,
  parseIsoDate,
  toIsoDate,
  utcIsoToLimaParts,
} from "./lima";

describe("date-lima (módulo único de fecha, AC-PAT-09)", () => {
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

  describe("caso difícil de WEB-D165 / AC-PAT-10: 23:30 hora de Lima", () => {
    it("un movimiento registrado a las 23:30 del 14 de julio en Lima se guarda como timestamptz UTC del 15", () => {
      const utcIso = limaLocalInputToUtcIso("2026-07-14T23:30");
      // Lima es UTC-5: 23:30 del 14 en Lima = 04:30 del 15 en UTC.
      expect(utcIso).toBe("2026-07-15T04:30:00.000Z");
    });

    it("al mostrarlo de vuelta en Lima, sigue siendo el 14 de julio, no el 15", () => {
      const utcIso = limaLocalInputToUtcIso("2026-07-14T23:30");
      const displayed = utcIsoToLimaParts(utcIso);
      expect(displayed).toEqual({ year: 2026, month: 6, day: 14, hour: 23, minute: 30 });
    });

    it("un movimiento cerca de medianoche que sí cruza a UTC de otro día no cambia su fecha de Lima", () => {
      // 00:05 del 1 de enero en Lima = 05:05 UTC del mismo 1 de enero.
      const utcIso = limaLocalInputToUtcIso("2026-01-01T00:05");
      expect(utcIsoToLimaParts(utcIso).day).toBe(1);
    });
  });

  describe("aritmética de fin de mes sin arrastre (pagos recurrentes)", () => {
    it("31 de enero + 1 mes cae en 28 de febrero en año no bisiesto, no en 3 de marzo", () => {
      expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    });

    it("31 de enero + 1 mes cae en 29 de febrero en año bisiesto", () => {
      expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    });

    it("30 de noviembre + 3 meses (cuota trimestral) cae en 28/29 de febrero, no se arrastra", () => {
      expect(addMonthsClamped("2025-11-30", 3)).toBe("2026-02-28");
    });
  });

  describe("formatRelativeLimaDate (16 §6 / 18 §9.2)", () => {
    const hoy = { year: 2026, month: 6, day: 14 };

    it("hoy y ayer son relativos", () => {
      expect(formatRelativeLimaDate("2026-07-14", hoy)).toBe("hoy");
      expect(formatRelativeLimaDate("2026-07-13", hoy)).toBe("ayer");
    });

    it("hasta 7 días es 'hace N días'", () => {
      expect(formatRelativeLimaDate("2026-07-08", hoy)).toBe("hace 6 días");
    });

    it("mismo año usa 'D MMM'", () => {
      expect(formatRelativeLimaDate("2026-06-01", hoy)).toBe("1 jun");
    });

    it("otro año usa 'D MMM YYYY'", () => {
      expect(formatRelativeLimaDate("2025-07-14", hoy)).toBe("14 jul 2025");
    });
  });
});
