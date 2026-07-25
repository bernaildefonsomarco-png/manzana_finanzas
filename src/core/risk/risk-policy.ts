import type { RiskSignalAssessment } from "@/agents/risk-signal-agent";
import type { MovementType, RiskLevel } from "@/shared/types/domain";

export type RiskPolicyDecision = {
  decision: "allow" | "confirm" | "block";
  risk_level: RiskLevel;
  reasons: string[];
};

export type SystemActionKind =
  | "financial_write"
  | "destructive_financial_write"
  | "financial_correction"
  | "batch_confirmation"
  | "pending_resolution"
  | "recurring_activation"
  | "preference_change"
  | "experience_feedback"
  | "sensitive_read"
  | "proactive_external_output";

export type SystemActionRiskInput = {
  actionKind: SystemActionKind;
  baseRiskLevel?: RiskLevel;
  itemCount?: number;
  authenticatedSession?: boolean;
  verifiedRecipient?: boolean;
  initiatedBySystem?: boolean;
  explicitUserConfirmation?: boolean;
  applicableOptIn?: boolean;
  disclosureSafe?: boolean;
  reversible?: boolean;
  semanticAssessment?: RiskSignalAssessment | null;
};

const DIRECT_TYPES = new Set<MovementType>(["gasto", "ingreso"]);

export function evaluateMovementRisk(input: {
  movementType: MovementType;
  amount: number | null;
  confidence: number;
  categorySensitive: boolean;
  semanticAssessment?: RiskSignalAssessment | null;
  recentMedianAmount?: number | null;
}): RiskPolicyDecision {
  const reasons: string[] = [];

  if (!DIRECT_TYPES.has(input.movementType)) {
    return {
      decision: "block",
      risk_level: "high",
      reasons: ["specialized_engine_required"],
    };
  }
  if (input.amount === null || input.confidence < 0.7) {
    return {
      decision: "block",
      risk_level: "high",
      reasons: [
        input.amount === null ? "missing_amount" : "confidence_below_safe_floor",
      ],
    };
  }

  let level: RiskLevel = "low";
  if (input.categorySensitive) {
    level = "sensitive";
    reasons.push("sensitive_category");
  }

  if (isUnusualAmount(input.amount, input.recentMedianAmount)) {
    level = maxRisk(level, "high");
    reasons.push("unusual_amount");
  }

  const semantic = input.semanticAssessment;
  if (semantic && semantic.confidence >= 0.6) {
    if (semantic.semantic_level === "sensitive") {
      level = "sensitive";
    } else if (semantic.semantic_level === "high") {
      level = maxRisk(level, "high");
    } else if (semantic.semantic_level === "medium") {
      level = maxRisk(level, "medium");
    }
    reasons.push(...semantic.signals.map((signal) => `semantic:${signal}`));
    if (semantic.requires_confirmation_advisory) {
      reasons.push("semantic_confirmation_advisory");
    }
  }

  if (input.confidence < 0.95) {
    level = maxRisk(level, "medium");
    reasons.push(
      input.confidence < 0.85
        ? "confidence_requires_clarification"
        : "confidence_below_silent_accept",
    );
  }

  const mustConfirm =
    level !== "low" ||
    reasons.includes("semantic_confirmation_advisory");
  return {
    decision: mustConfirm ? "confirm" : "allow",
    risk_level: level,
    reasons: reasons.length > 0 ? unique(reasons) : ["low_risk_exact_action"],
  };
}

/**
 * Gate transversal para acciones que no son una captura simple.
 * Las señales semánticas solo pueden elevar el riesgo; nunca autorizan una
 * acción que una regla exacta haya bloqueado o marcado para confirmación.
 */
export function evaluateSystemActionRisk(
  input: SystemActionRiskInput,
): RiskPolicyDecision {
  const reasons: string[] = [];
  let level = input.baseRiskLevel ?? "low";
  let decision: RiskPolicyDecision["decision"] = "allow";

  if (input.actionKind === "financial_write") {
    reasons.push("financial_write_requires_core");
    if (
      ["high", "sensitive"].includes(level) &&
      !input.explicitUserConfirmation
    ) {
      decision = "confirm";
      reasons.push("high_risk_financial_write_requires_confirmation");
    }
  }

  if (input.actionKind === "destructive_financial_write") {
    level = maxRisk(level, "high");
    reasons.push("destructive_financial_action");
    decision = input.explicitUserConfirmation ? "allow" : "confirm";
  }

  if (input.actionKind === "financial_correction") {
    level = maxRisk(level, "medium");
    reasons.push("financial_correction_requires_audit");
    if (!input.explicitUserConfirmation) decision = "confirm";
  }

  if (
    input.actionKind === "batch_confirmation" &&
    Math.max(0, input.itemCount ?? 0) > 1
  ) {
    level = maxRisk(level, "high");
    reasons.push("batch_financial_confirmation");
    if (!input.explicitUserConfirmation) decision = "confirm";
  }

  if (input.actionKind === "pending_resolution") {
    level = maxRisk(level, "medium");
    reasons.push("pending_resolution_requires_explicit_user_action");
    if (!input.explicitUserConfirmation) decision = "confirm";
  }

  if (input.actionKind === "recurring_activation") {
    level = maxRisk(level, "high");
    reasons.push("recurring_rule_changes_future_behavior");
    if (!input.explicitUserConfirmation) decision = "confirm";
  }

  if (input.actionKind === "preference_change") {
    level = maxRisk(level, "medium");
    reasons.push("preference_changes_future_behavior");
    if (!input.explicitUserConfirmation) decision = "confirm";
  }

  if (input.actionKind === "experience_feedback") {
    reasons.push("experience_feedback_is_non_financial");
    if (!input.authenticatedSession) {
      level = maxRisk(level, "medium");
      reasons.push("experience_feedback_requires_authenticated_session");
      decision = "block";
    }
    if (input.reversible === false) {
      level = maxRisk(level, "medium");
      reasons.push("experience_feedback_should_be_reversible");
      decision = "block";
    }
  }

  if (
    input.actionKind === "sensitive_read" &&
    !input.authenticatedSession &&
    !input.verifiedRecipient
  ) {
    level = "sensitive";
    reasons.push("sensitive_read_outside_authenticated_session");
    decision = input.disclosureSafe ? "allow" : "block";
  }

  if (input.actionKind === "proactive_external_output") {
    if (!input.initiatedBySystem) {
      reasons.push("proactive_flag_missing");
      decision = "block";
    }
    if (!input.applicableOptIn) {
      reasons.push("proactive_opt_in_missing");
      decision = "block";
    }
    if (!input.disclosureSafe) {
      reasons.push("proactive_disclosure_not_safe");
      decision = "block";
    }
    if (level === "sensitive") {
      reasons.push("sensitive_proactive_output_summarized");
    }
  }

  if (input.reversible === false) {
    level = maxRisk(level, "high");
    reasons.push("irreversible_action");
    if (decision !== "block" && !input.explicitUserConfirmation) {
      decision = "confirm";
    }
  }

  const semantic = input.semanticAssessment;
  if (semantic && semantic.confidence >= 0.6) {
    const semanticLevel = semantic.semantic_level;
    if (semanticLevel === "sensitive") level = "sensitive";
    else if (semanticLevel === "high") level = maxRisk(level, "high");
    else if (semanticLevel === "medium") level = maxRisk(level, "medium");
    reasons.push(...semantic.signals.map((signal) => `semantic:${signal}`));
    if (
      decision === "allow" &&
      semantic.requires_confirmation_advisory &&
      input.actionKind !== "proactive_external_output"
    ) {
      decision = "confirm";
      reasons.push("semantic_confirmation_advisory");
    }
  }

  return {
    decision,
    risk_level: level,
    reasons: unique(reasons.length > 0 ? reasons : ["low_risk_exact_action"]),
  };
}

function isUnusualAmount(amount: number, recentMedian?: number | null): boolean {
  if (amount >= 5_000) return true;
  if (!recentMedian || recentMedian <= 0 || amount < 200) return false;
  return amount >= recentMedian * 5;
}

function maxRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "sensitive"];
  return order[Math.max(order.indexOf(left), order.indexOf(right))];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
