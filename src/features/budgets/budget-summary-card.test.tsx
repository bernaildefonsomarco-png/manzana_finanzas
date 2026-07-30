import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetSummaryCard } from "./budget-summary-card";
import type { BudgetView } from "./budgets-types";

describe("BudgetSummaryCard", () => {
  it("AC-PRES-14: prepara para Home un máximo de tres presupuestos", () => {
    render(
      <BudgetSummaryCard
        budgets={[
          budget("b1", "Alimentación"),
          budget("b2", "Transporte"),
          budget("b3", "Servicios"),
          budget("b4", "Ocio"),
        ]}
      />
    );
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
    expect(screen.queryByText("Ocio")).not.toBeInTheDocument();
  });
});

function budget(id: string, categoryName: string): BudgetView {
  return {
    id,
    category_id: "otros",
    category_name: categoryName,
    currency: "PEN",
    period_kind: "mensual",
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    base_amount: 100,
    rollover_amount: 0,
    amount: 100,
    kind: "presupuesto",
    rollover: false,
    auto_renew: true,
    alerted_thresholds: [],
    source: "manual",
    status: "activo",
    spent: 50,
    remaining: 50,
    pct: 0.5,
    percentage: 50,
    percentage_exact: 50,
    band: "holgado",
    movement_ids: [],
    created_at: "2026-07-01T05:00:00.000Z",
  };
}
