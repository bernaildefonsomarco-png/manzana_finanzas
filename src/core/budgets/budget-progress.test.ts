import { describe, expect, it } from "vitest";
import { MOVEMENT_TYPES, type MovementType } from "@/shared/types/domain";
import {
  budgetKindBlocksSpending,
  calculateBudgetFreeMoneyEffect,
  calculateBudgetProgress,
  movementCountsForBudget,
  resolveBudgetProgressBand,
} from "./budget-progress";
import type { BudgetMovement } from "./types";

function movement(
  type: MovementType,
  overrides: Partial<BudgetMovement> = {}
): BudgetMovement {
  return {
    id: `${type}-${overrides.category_id ?? "sin-categoria"}`,
    type,
    status: "confirmed",
    amount: 10,
    currency: "PEN",
    category_id: "alimentacion",
    deleted_at: null,
    ...overrides,
  };
}

describe("nucleo de avance de presupuestos", () => {
  it("RUL-PRES-01: presupuestar S/400 tiene efecto cero sobre dinero libre", () => {
    expect(calculateBudgetFreeMoneyEffect(400)).toBe(0);
  });

  it("RUL-PRES-02/AC-PRES-02: clasifica los once tipos exactamente", () => {
    expect(MOVEMENT_TYPES).toHaveLength(11);
    const counts = new Map(
      MOVEMENT_TYPES.map((type) => [
        type,
        movementCountsForBudget(
          movement(type, {
            category_id: type === "pago_deuda" ? "deudas" : "alimentacion",
          }),
          null
        ),
      ])
    );

    expect([...counts.entries()].filter(([, doesCount]) => doesCount)).toEqual([
      ["gasto", true],
      ["pago_deuda", true],
      ["pago_recurrente", true],
    ]);
  });

  it("RUL-PRES-02/03: pago de deuda solo cuenta en general o deudas", () => {
    const debtPayment = movement("pago_deuda", { category_id: "deudas" });
    expect(movementCountsForBudget(debtPayment, null)).toBe(true);
    expect(movementCountsForBudget(debtPayment, "deudas")).toBe(true);
    expect(movementCountsForBudget(debtPayment, "alimentacion")).toBe(false);
    expect(
      movementCountsForBudget(
        movement("pago_deuda", { category_id: "otros" }),
        null
      )
    ).toBe(false);
  });

  it("WEB-D219: solo suma PEN y estados financieros activos", () => {
    const base = movement("gasto");
    for (const status of ["confirmed", "needs_review", "corrected"] as const) {
      expect(movementCountsForBudget({ ...base, status }, null)).toBe(true);
    }
    for (const status of ["deleted", "reversed"] as const) {
      expect(movementCountsForBudget({ ...base, status }, null)).toBe(false);
    }
    expect(
      movementCountsForBudget({ ...base, currency: "USD" }, null)
    ).toBe(false);
    expect(
      movementCountsForBudget(
        { ...base, status: "corrected", deleted_at: "2026-07-20T15:00:00Z" },
        null
      )
    ).toBe(false);
  });

  it("RUL-PRES-03: S/318.50 de S/400 deja S/81.50 y tramo atencion", () => {
    const progress = calculateBudgetProgress({
      amount: 400,
      category_id: "alimentacion",
      movements: [movement("gasto", { id: "g-1", amount: 318.5 })],
    });

    expect(progress).toEqual({
      spent: 318.5,
      remaining: 81.5,
      pct: 0.7963,
      percentage: 80,
      percentage_exact: 79.625,
      band: "atencion",
      movement_ids: ["g-1"],
    });
  });

  it("RUL-PRES-03: general incluye sin categoria y una categoria no", () => {
    const uncategorized = movement("gasto", {
      id: "sin-categoria",
      category_id: null,
      amount: 40,
    });
    expect(
      calculateBudgetProgress({
        amount: 100,
        category_id: null,
        movements: [uncategorized],
      }).spent
    ).toBe(40);
    expect(
      calculateBudgetProgress({
        amount: 100,
        category_id: "otros",
        movements: [uncategorized],
      }).spent
    ).toBe(0);
  });

  it("RUL-PRES-04: ningun tipo bloquea gastos", () => {
    expect(budgetKindBlocksSpending("presupuesto")).toBe(false);
    expect(budgetKindBlocksSpending("limite_blando")).toBe(false);
    expect(budgetKindBlocksSpending("limite_duro")).toBe(false);
  });

  it("los cuatro tramos respetan 70, 90 y 100 por ciento", () => {
    expect(resolveBudgetProgressBand(69.99, 100)).toBe("holgado");
    expect(resolveBudgetProgressBand(70, 100)).toBe("atencion");
    expect(resolveBudgetProgressBand(90, 100)).toBe("cerca");
    expect(resolveBudgetProgressBand(100, 100)).toBe("superado");
  });
});
