import { describe, expect, it } from "vitest";
import { selectTopBudgetSummaries } from "./budget-summary";

describe("resumen compacto de presupuestos (SCR-PRES-05/AC-PRES-14)", () => {
  it("devuelve como maximo tres: superados, cerca y luego resto por gasto", () => {
    const result = selectTopBudgetSummaries([
      { id: "holgado-alto", spent: 500, band: "holgado" as const },
      { id: "cerca", spent: 90, band: "cerca" as const },
      { id: "superado-bajo", spent: 110, band: "superado" as const },
      { id: "atencion", spent: 300, band: "atencion" as const },
      { id: "superado-alto", spent: 200, band: "superado" as const },
    ]);

    expect(result.map((budget) => budget.id)).toEqual([
      "superado-alto",
      "superado-bajo",
      "cerca",
    ]);
    expect(result).toHaveLength(3);
  });
});
