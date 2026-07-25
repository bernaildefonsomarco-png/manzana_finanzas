import { describe, expect, it } from "vitest";
import { UpdatePendingRequestSchema } from "./schemas";

describe("pending edit schema", () => {
  it("acepta completar una transferencia con dos cuentas", () => {
    expect(
      UpdatePendingRequestSchema.parse({
        normalized_summary: {
          title: "Transferencia propia",
          amount: 50,
          currency: "PEN",
          occurred_at: "2026-07-22T12:00:00.000Z",
        },
        proposed_action: {
          action: "record_transfer",
          account_origin_id: "11111111-1111-4111-8111-111111111111",
          account_destination_id: "22222222-2222-4222-8222-222222222222",
        },
      }).proposed_action,
    ).toMatchObject({ action: "record_transfer" });
  });

  it("rechaza campos arbitrarios en la accion financiera", () => {
    expect(() =>
      UpdatePendingRequestSchema.parse({
        normalized_summary: { title: "Pendiente" },
        proposed_action: {
          action: "record_debt_payment",
          raw_sql: "select 1",
        },
      }),
    ).toThrow();
  });
});
