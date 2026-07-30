import { describe, expect, it } from "vitest";
import {
  advanceBudgetThresholds,
  resetBudgetThresholdsForRenewal,
} from "./budget-thresholds";

describe("umbrales de presupuesto (RUL-PRES-06)", () => {
  it("reproduce los siete pasos: tres avisos y termina en 70,90,100", () => {
    let alerted: number[] = [];
    const emitted: number[] = [];

    for (const spent of [215, 276, 258, 291, 330, 358]) {
      const result = advanceBudgetThresholds({
        kind: "limite_duro",
        amount: 300,
        spent,
        alerted_thresholds: alerted,
      });
      emitted.push(...result.crossed_thresholds);
      alerted = result.alerted_thresholds;
    }

    expect(emitted).toEqual([70, 90, 100]);
    expect(alerted).toEqual([70, 90, 100]);
    expect(resetBudgetThresholdsForRenewal()).toEqual([]);
  });

  it("bajar y volver a cruzar no avisa; editar monto no vacia lo alertado", () => {
    const first = advanceBudgetThresholds({
      kind: "limite_duro",
      amount: 300,
      spent: 276,
      alerted_thresholds: [70],
    });
    const afterDelete = advanceBudgetThresholds({
      kind: "limite_duro",
      amount: 300,
      spent: 258,
      alerted_thresholds: first.alerted_thresholds,
    });
    const crossedAgain = advanceBudgetThresholds({
      kind: "limite_duro",
      amount: 300,
      spent: 291,
      alerted_thresholds: afterDelete.alerted_thresholds,
    });
    const editedAmount = advanceBudgetThresholds({
      kind: "limite_duro",
      amount: 400,
      spent: 291,
      alerted_thresholds: crossedAgain.alerted_thresholds,
    });

    expect(first.crossed_thresholds).toEqual([90]);
    expect(afterDelete.crossed_thresholds).toEqual([]);
    expect(crossedAgain.crossed_thresholds).toEqual([]);
    expect(editedAmount.alerted_thresholds).toEqual([70, 90]);
  });
});
