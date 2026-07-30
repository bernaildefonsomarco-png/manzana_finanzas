import { describe, expect, it } from "vitest";
import { calculateRenewedBudgetAmounts } from "./budget-rollover";

describe("renovacion y traspaso (RUL-PRES-08/10, WEB-D220)", () => {
  it("S/400 con S/340 gastado renueva en S/460 con traspaso y S/400 sin el", () => {
    expect(
      calculateRenewedBudgetAmounts({
        base_amount: 400,
        rollover_amount: 0,
        spent: 340,
        rollover: true,
      })
    ).toEqual({
      base_amount: 400,
      rollover_amount: 60,
      amount: 460,
      alerted_thresholds: [],
    });
    expect(
      calculateRenewedBudgetAmounts({
        base_amount: 400,
        rollover_amount: 0,
        spent: 340,
        rollover: false,
      })
    ).toEqual({
      base_amount: 400,
      rollover_amount: 0,
      amount: 400,
      alerted_thresholds: [],
    });
  });

  it("el acarreo recibido se consume primero y nunca vuelve a propagarse", () => {
    expect(
      calculateRenewedBudgetAmounts({
        base_amount: 400,
        rollover_amount: 60,
        spent: 340,
        rollover: true,
      })
    ).toEqual({
      base_amount: 400,
      rollover_amount: 120,
      amount: 520,
      alerted_thresholds: [],
    });
  });

  it("un sobrante negativo no se traspasa y auto_renew apagado no crea otro", () => {
    expect(
      calculateRenewedBudgetAmounts({
        base_amount: 400,
        rollover_amount: 0,
        spent: 430,
        rollover: true,
      })
    ).toEqual({
      base_amount: 400,
      rollover_amount: 0,
      amount: 400,
      alerted_thresholds: [],
    });
    expect(
      calculateRenewedBudgetAmounts({
        base_amount: 400,
        rollover_amount: 0,
        spent: 340,
        rollover: true,
        auto_renew: false,
      })
    ).toBeNull();
  });
});
