import {
  evaluateDisclosure,
  type DisclosureChannel,
  type DisclosureDecision,
} from "./disclosure-engine";
import {
  evaluateSystemActionRisk,
  type RiskPolicyDecision,
} from "@/core/risk/risk-policy";
import type { RiskLevel } from "@/shared/types/domain";

export type OutputGuardDecision = {
  allowed: boolean;
  disclosure: DisclosureDecision;
  risk: RiskPolicyDecision;
  reasons: string[];
};

/**
 * Frontera unica para decidir que hechos pueden salir por cada canal.
 * Los agentes reciben solo safe_facts; nunca pueden elevar el nivel de detalle.
 */
export function evaluateOutputGuard(input: {
  channel: DisclosureChannel;
  initiatedBySystem: boolean;
  authenticatedSession: boolean;
  verifiedRecipient: boolean;
  discreetMode: boolean;
  riskLevel: RiskLevel;
  facts: Record<string, unknown>;
  sensitiveFactKeys?: string[];
  applicableOptIn?: boolean;
}): OutputGuardDecision {
  const disclosure = evaluateDisclosure({
    channel: input.channel,
    initiatedBySystem: input.initiatedBySystem,
    authenticatedSession: input.authenticatedSession,
    discreetMode: input.discreetMode,
    riskLevel: input.riskLevel,
    facts: input.facts,
    sensitiveFactKeys: input.sensitiveFactKeys,
  });
  const isProactiveExternal =
    input.initiatedBySystem &&
    ["whatsapp", "push", "email_notification", "dashboard_preview"].includes(
      input.channel,
    );
  const containsSensitiveFacts =
    input.riskLevel === "sensitive" ||
    (input.sensitiveFactKeys?.length ?? 0) > 0;
  const disclosureSafe =
    !containsSensitiveFacts ||
    disclosure.level === "summary" ||
    input.authenticatedSession ||
    (input.channel === "whatsapp" &&
      input.verifiedRecipient &&
      !input.initiatedBySystem);

  const risk = evaluateSystemActionRisk({
    actionKind: isProactiveExternal
      ? "proactive_external_output"
      : "sensitive_read",
    baseRiskLevel: input.riskLevel,
    authenticatedSession: input.authenticatedSession,
    verifiedRecipient: input.verifiedRecipient,
    initiatedBySystem: input.initiatedBySystem,
    applicableOptIn: isProactiveExternal
      ? input.applicableOptIn === true
      : undefined,
    disclosureSafe,
    reversible: true,
  });

  return {
    allowed: risk.decision === "allow",
    disclosure,
    risk,
    reasons: unique([...disclosure.reasons, ...risk.reasons]),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
