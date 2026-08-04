import { describe, expect, it } from "vitest";
import { OnboardingActionRequestSchema } from "./schemas";

describe("OnboardingActionRequestSchema", () => {
  it("acepta solo el inicio explicito desde superficies conocidas", () => {
    expect(
      OnboardingActionRequestSchema.parse({
        action: "start",
        source: "dashboard_home",
      })
    ).toEqual({ action: "start", source: "dashboard_home" });
  });

  it("rechaza estados arbitrarios enviados por cliente", () => {
    expect(() =>
      OnboardingActionRequestSchema.parse({
        action: "complete",
        source: "dashboard_home",
      })
    ).toThrow();
  });

  it("44 SCR-ONB-02: acepta las cuatro salidas de la bienvenida, una por puerta", () => {
    for (const source of [
      "welcome_movement",
      "welcome_account",
      "welcome_email",
      "welcome_skip",
    ] as const) {
      expect(OnboardingActionRequestSchema.parse({ action: "start", source })).toEqual({
        action: "start",
        source,
      });
    }
  });

  it("rechaza una fuente inventada fuera del enum", () => {
    expect(() =>
      OnboardingActionRequestSchema.parse({ action: "start", source: "welcome_de_mentira" }),
    ).toThrow();
  });
});
