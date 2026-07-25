import { describe, expect, it } from "vitest";
import {
  assertSystemActionAllowed,
  SystemActionRiskDeniedError,
} from "./system-action-gate";

describe("assertSystemActionAllowed", () => {
  it("permite una correccion ya confirmada explicitamente", () => {
    expect(
      assertSystemActionAllowed({
        actionKind: "financial_correction",
        explicitUserConfirmation: true,
        reversible: true,
      }).decision,
    ).toBe("allow");
  });

  it("exige confirmacion para una eliminacion no confirmada", () => {
    expect(() =>
      assertSystemActionAllowed({
        actionKind: "destructive_financial_write",
        explicitUserConfirmation: false,
        reversible: false,
      }),
    ).toThrow(SystemActionRiskDeniedError);
  });

  it("no deja que una escritura sensible evite confirmacion", () => {
    expect(() =>
      assertSystemActionAllowed({
        actionKind: "financial_write",
        baseRiskLevel: "sensitive",
        explicitUserConfirmation: false,
      }),
    ).toThrow(SystemActionRiskDeniedError);
  });

  it("exige accion explicita antes de activar una regla recurrente", () => {
    expect(() =>
      assertSystemActionAllowed({
        actionKind: "recurring_activation",
        explicitUserConfirmation: false,
      }),
    ).toThrow(SystemActionRiskDeniedError);
  });
});
