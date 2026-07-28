import { describe, expect, it } from "vitest";
import { parseDebtScreenIntent } from "./debt-intent";

describe("parseDebtScreenIntent", () => {
  it("acepta un deep-link valido de pago de cuota", () => {
    const params = new URLSearchParams({
      debt: "11111111-1111-4111-8111-111111111111",
      installment: "22222222-2222-4222-8222-222222222222",
      action: "pay",
    });

    expect(parseDebtScreenIntent(params)).toEqual({
      debtId: "11111111-1111-4111-8111-111111111111",
      installmentId: "22222222-2222-4222-8222-222222222222",
      action: "pay",
    });
  });

  it("rechaza ids o acciones manipuladas", () => {
    expect(
      parseDebtScreenIntent(
        new URLSearchParams({
          debt: "javascript:alert(1)",
          action: "pay",
        })
      )
    ).toBeNull();
    expect(
      parseDebtScreenIntent(
        new URLSearchParams({
          debt: "11111111-1111-4111-8111-111111111111",
          action: "delete",
        })
      )
    ).toBeNull();
  });
});
