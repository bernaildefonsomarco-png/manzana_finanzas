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
});
