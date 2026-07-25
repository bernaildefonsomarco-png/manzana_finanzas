import { describe, expect, it } from "vitest";
import { evaluateMovementRisk, evaluateSystemActionRisk } from "./risk-policy";

describe("RiskPolicyEngine", () => {
  it("permite un gasto claro y cotidiano con confianza de silent accept", () => {
    expect(
      evaluateMovementRisk({
        movementType: "gasto",
        amount: 8,
        confidence: 0.98,
        categorySensitive: false,
      }).decision,
    ).toBe("allow");
  });

  it("exige confirmacion para confianza media aunque el agente no vea riesgo", () => {
    const result = evaluateMovementRisk({
      movementType: "gasto",
      amount: 20,
      confidence: 0.9,
      categorySensitive: false,
    });
    expect(result.decision).toBe("confirm");
    expect(result.reasons).toContain("confidence_below_silent_accept");
  });

  it("no permite que una senal semantica rebaje una categoria sensible", () => {
    const result = evaluateMovementRisk({
      movementType: "gasto",
      amount: 90,
      confidence: 0.99,
      categorySensitive: true,
      semanticAssessment: {
        action_id: "a1",
        semantic_level: "none",
        signals: [],
        confidence: 1,
        requires_confirmation_advisory: false,
        safe_explanation: "Sin riesgo adicional.",
      },
    });
    expect(result).toMatchObject({ decision: "confirm", risk_level: "sensitive" });
  });

  it("marca monto inusual con reglas exactas", () => {
    const result = evaluateMovementRisk({
      movementType: "gasto",
      amount: 5_000,
      confidence: 0.99,
      categorySensitive: false,
    });
    expect(result.decision).toBe("confirm");
    expect(result.reasons).toContain("unusual_amount");
  });

  it("exige confirmacion explicita para una accion financiera destructiva", () => {
    const result = evaluateSystemActionRisk({
      actionKind: "destructive_financial_write",
      explicitUserConfirmation: false,
      reversible: false,
    });

    expect(result).toMatchObject({ decision: "confirm", risk_level: "high" });
    expect(result.reasons).toContain("destructive_financial_action");
  });

  it("bloquea una salida proactiva sin opt-in aplicable", () => {
    const result = evaluateSystemActionRisk({
      actionKind: "proactive_external_output",
      initiatedBySystem: true,
      applicableOptIn: false,
      disclosureSafe: true,
    });

    expect(result.decision).toBe("block");
    expect(result.reasons).toContain("proactive_opt_in_missing");
  });

  it("permite una salida proactiva sensible solo cuando ya es segura", () => {
    const result = evaluateSystemActionRisk({
      actionKind: "proactive_external_output",
      baseRiskLevel: "sensitive",
      initiatedBySystem: true,
      applicableOptIn: true,
      disclosureSafe: true,
    });

    expect(result).toMatchObject({ decision: "allow", risk_level: "sensitive" });
    expect(result.reasons).toContain("sensitive_proactive_output_summarized");
  });

  it("una senal semantica puede elevar riesgo pero no quitar confirmacion exacta", () => {
    const result = evaluateSystemActionRisk({
      actionKind: "preference_change",
      explicitUserConfirmation: false,
      semanticAssessment: {
        action_id: "preference-1",
        semantic_level: "none",
        signals: [],
        confidence: 1,
        requires_confirmation_advisory: false,
        safe_explanation: "Sin riesgo semantico adicional.",
      },
    });

    expect(result.decision).toBe("confirm");
    expect(result.risk_level).toBe("medium");
  });
});
