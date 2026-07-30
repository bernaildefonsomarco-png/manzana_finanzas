import { describe, expect, it } from "vitest";
import { CreateGoalRequestSchema } from "@/app/api/v1/goals/schemas";
import { SimulateExpenseRequestSchema } from "@/app/api/v1/projections/schemas";
import { CreateBudgetRequestSchema } from "./schemas";

describe("esquemas monetarios W-12", () => {
  it("AC-PRES-09: el traspaso queda apagado cuando no se solicita", () => {
    expect(CreateBudgetRequestSchema.parse({ amount: 300 }).rollover).toBe(
      false,
    );
  });

  it.each([
    ["presupuesto", () => CreateBudgetRequestSchema.parse({ amount: 0.29 })],
    [
      "meta",
      () =>
        CreateGoalRequestSchema.parse({
          name: "Meta de centavos",
          target_amount: 0.29,
        }),
    ],
    [
      "simulacion",
      () => SimulateExpenseRequestSchema.parse({ amount: 0.29 }),
    ],
  ])("acepta S/0.29 en %s pese a la representación binaria", (_, parse) => {
    expect(parse()).toBeTruthy();
  });
});
