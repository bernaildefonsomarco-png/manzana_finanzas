import {
  evaluateSystemActionRisk,
  type RiskPolicyDecision,
  type SystemActionRiskInput,
} from "./risk-policy";

export class SystemActionRiskDeniedError extends Error {
  constructor(readonly riskDecision: RiskPolicyDecision) {
    super(
      riskDecision.decision === "block"
        ? "SYSTEM_ACTION_BLOCKED_BY_RISK_POLICY"
        : "SYSTEM_ACTION_REQUIRES_CONFIRMATION",
    );
    this.name = "SystemActionRiskDeniedError";
  }
}

export function assertSystemActionAllowed(
  input: SystemActionRiskInput,
): RiskPolicyDecision {
  const decision = evaluateSystemActionRisk(input);
  if (decision.decision !== "allow") {
    throw new SystemActionRiskDeniedError(decision);
  }
  return decision;
}
