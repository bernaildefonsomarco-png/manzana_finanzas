import { describe, expect, it } from "vitest";
import { calculateGoalMonthlyPace } from "./goal-pace";

describe("ritmo necesario de una meta (RUL-PRES-12, WEB-D222)", () => {
  it("S/1,200 restantes de julio a diciembre son S/240 por mes", () => {
    expect(
      calculateGoalMonthlyPace({
        target_amount: 2_000,
        current_balance: 800,
        as_of: "2026-07-15",
        target_date: "2026-12-20",
      })
    ).toBe(240);
  });

  it("redondea hacia arriba al centimo", () => {
    expect(
      calculateGoalMonthlyPace({
        target_amount: 100,
        current_balance: 0,
        as_of: "2026-07-15",
        target_date: "2026-10-15",
      })
    ).toBe(33.34);
  });

  it("sin fecha futura no muestra ritmo y una meta alcanzada muestra cero", () => {
    expect(
      calculateGoalMonthlyPace({
        target_amount: 100,
        current_balance: 0,
        as_of: "2026-07-15",
        target_date: null,
      })
    ).toBeNull();
    expect(
      calculateGoalMonthlyPace({
        target_amount: 100,
        current_balance: 0,
        as_of: "2026-07-15",
        target_date: "2026-07-15",
      })
    ).toBeNull();
    expect(
      calculateGoalMonthlyPace({
        target_amount: 100,
        current_balance: 120,
        as_of: "2026-07-15",
        target_date: "2026-08-15",
      })
    ).toBe(0);
  });
});
