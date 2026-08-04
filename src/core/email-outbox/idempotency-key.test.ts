import { describe, expect, it } from "vitest";
import { buildEmailIdempotencyKey } from "./idempotency-key";

describe("buildEmailIdempotencyKey — RUL-MAIL-07: un correo duplicado es peor que uno tarde", () => {
  it("compone tipo · sujeto · día, con el ejemplo exacto de 46 §4.2", () => {
    expect(
      buildEmailIdempotencyKey({
        template: "recordatorio",
        subjectRef: "cuota:debt_31c#4",
        isoDate: "2026-07-26",
      }),
    ).toBe("recordatorio·cuota:debt_31c#4·2026-07-26");
  });

  it("el mismo trabajo reintentado produce la misma clave", () => {
    const input = { template: "recordatorio", subjectRef: "cuota:debt_1", isoDate: "2026-08-03" };
    expect(buildEmailIdempotencyKey(input)).toBe(buildEmailIdempotencyKey({ ...input }));
  });

  it("un día distinto produce una clave distinta (mismo aviso, otro día, no es duplicado)", () => {
    const a = buildEmailIdempotencyKey({ template: "recordatorio", subjectRef: "cuota:debt_1", isoDate: "2026-08-03" });
    const b = buildEmailIdempotencyKey({ template: "recordatorio", subjectRef: "cuota:debt_1", isoDate: "2026-08-04" });
    expect(a).not.toBe(b);
  });
});
