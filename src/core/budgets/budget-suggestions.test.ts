import { describe, expect, it } from "vitest";
import {
  buildBudgetSuggestion,
  medianMoney,
} from "./budget-suggestions";

describe("sugerencias de presupuesto (RUL-PRES-07, WEB-D221)", () => {
  it("360, 385 y 378 propone la mediana exacta S/378 con evidencia", () => {
    const suggestion = buildBudgetSuggestion({
      category_id: "alimentacion",
      period_kind: "mensual",
      as_of: "2026-08-01",
      periods: [
        { period_start: "2026-05-01", period_end: "2026-05-31", spent: 360 },
        { period_start: "2026-06-01", period_end: "2026-06-30", spent: 385 },
        { period_start: "2026-07-01", period_end: "2026-07-31", spent: 378 },
      ],
    });

    expect(suggestion?.proposed_amount).toBe(378);
    expect(suggestion?.evidence.map((period) => period.spent)).toEqual([
      360, 385, 378,
    ]);
    expect(suggestion?.id).toBe(
      "bs_alimentacion_mensual_2026-05-01_2026-07-31"
    );
  });

  it("con cantidad par promedia los dos centros y redondea al centimo", () => {
    expect(medianMoney([100, 100.01])).toBe(100.01);
    expect(medianMoney([80, 100, 120, 140])).toBe(110);
  });

  it("exige dos periodos completos con gasto y usa como maximo los seis recientes", () => {
    expect(
      buildBudgetSuggestion({
        category_id: "transporte",
        period_kind: "mensual",
        as_of: "2026-08-01",
        periods: [
          { period_start: "2026-07-01", period_end: "2026-07-31", spent: 50 },
        ],
      })
    ).toBeNull();

    const periods = Array.from({ length: 8 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return {
        period_start: `2026-${month}-01`,
        period_end: `2026-${month}-${month === "02" ? "28" : "30"}`,
        spent: (index + 1) * 10,
      };
    });
    const suggestion = buildBudgetSuggestion({
      category_id: "transporte",
      period_kind: "mensual",
      as_of: "2026-09-01",
      periods,
    });

    expect(suggestion?.evidence).toHaveLength(6);
    expect(suggestion?.evidence[0].period_start).toBe("2026-03-01");
    expect(suggestion?.evidence.at(-1)?.period_start).toBe("2026-08-01");
  });

  it("un periodo completo nuevo cambia la clave de la ventana", () => {
    const base = [
      { period_start: "2026-06-01", period_end: "2026-06-30", spent: 100 },
      { period_start: "2026-07-01", period_end: "2026-07-31", spent: 110 },
    ];
    const first = buildBudgetSuggestion({
      category_id: "otros",
      period_kind: "mensual",
      as_of: "2026-08-01",
      periods: base,
    });
    const next = buildBudgetSuggestion({
      category_id: "otros",
      period_kind: "mensual",
      as_of: "2026-09-01",
      periods: [
        ...base,
        { period_start: "2026-08-01", period_end: "2026-08-31", spent: 120 },
      ],
    });

    expect(next?.id).not.toBe(first?.id);
  });
});
