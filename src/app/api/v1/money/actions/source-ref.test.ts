import { describe, expect, it } from "vitest";
import { buildMoneyActionSourceRef } from "./source-ref";

describe("buildMoneyActionSourceRef", () => {
  it("crea source_ref unico por accion e idempotency key", () => {
    const first = buildMoneyActionSourceRef(
      "transfer_between_accounts",
      "dashboard-money:transfer_between_accounts:one"
    );
    const second = buildMoneyActionSourceRef(
      "transfer_between_accounts",
      "dashboard-money:transfer_between_accounts:two"
    );

    expect(first).not.toBe(second);
    expect(first).toContain("transfer_between_accounts");
  });

  it("respeta el limite canonico de source_ref para idempotency keys validas", () => {
    const sourceRef = buildMoneyActionSourceRef(
      "adjust_account_balance",
      "x".repeat(180)
    );

    expect(sourceRef.length).toBeLessThanOrEqual(240);
  });
});
