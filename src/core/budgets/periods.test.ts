import { describe, expect, it } from "vitest";
import {
  budgetPeriodContaining,
  nextBudgetPeriod,
  previousBudgetPeriod,
} from "./periods";

describe("periodos de presupuesto en America/Lima (RUL-PRES-09)", () => {
  it("la semana corre de lunes a domingo", () => {
    expect(budgetPeriodContaining("2026-07-29", "semanal")).toEqual({
      start: "2026-07-27",
      end: "2026-08-02",
    });
  });

  it("la quincena corre del 1 al 15 y del 16 al ultimo dia", () => {
    expect(budgetPeriodContaining("2026-07-15", "quincenal")).toEqual({
      start: "2026-07-01",
      end: "2026-07-15",
    });
    expect(budgetPeriodContaining("2026-07-16", "quincenal")).toEqual({
      start: "2026-07-16",
      end: "2026-07-31",
    });
  });

  it("el periodo mensual respeta febrero bisiesto", () => {
    const february = budgetPeriodContaining("2028-02-10", "mensual");
    expect(february).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
    expect(nextBudgetPeriod(february, "mensual")).toEqual({
      start: "2028-03-01",
      end: "2028-03-31",
    });
    expect(previousBudgetPeriod(february, "mensual")).toEqual({
      start: "2028-01-01",
      end: "2028-01-31",
    });
  });
});
