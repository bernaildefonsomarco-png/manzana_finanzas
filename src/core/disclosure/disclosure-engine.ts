export type DisclosureChannel =
  | "whatsapp"
  | "dashboard"
  | "dashboard_preview"
  | "push"
  | "email_notification";

export type DisclosureDecision = {
  level: "summary" | "standard" | "detailed";
  safe_facts: Record<string, unknown>;
  redacted_keys: string[];
  redaction_applied: boolean;
  reasons: string[];
};

const SENSITIVE_KEYS = new Set([
  "amount",
  "amounts",
  "merchant",
  "account",
  "account_name",
  "bank",
  "person",
  "person_name",
  "balance",
  "free_money",
  "debt_name",
  "debt_amount",
  "category_sensitive",
]);

export function evaluateDisclosure(input: {
  channel: DisclosureChannel;
  initiatedBySystem: boolean;
  authenticatedSession: boolean;
  discreetMode: boolean;
  riskLevel?: "low" | "medium" | "high" | "sensitive";
  facts: Record<string, unknown>;
  sensitiveFactKeys?: string[];
}): DisclosureDecision {
  const proactiveExternal =
    input.initiatedBySystem &&
    ["whatsapp", "push", "email_notification", "dashboard_preview"].includes(
      input.channel,
    );
  const mayShowDetail =
    (input.channel === "dashboard" && input.authenticatedSession) ||
    (input.channel === "whatsapp" && !input.initiatedBySystem);
  const forceSafeSummary =
    proactiveExternal && input.riskLevel === "sensitive";

  if (
    !forceSafeSummary &&
    (!input.discreetMode || !proactiveExternal || mayShowDetail)
  ) {
    return {
      level: mayShowDetail ? "detailed" : "standard",
      safe_facts: { ...input.facts },
      redacted_keys: [],
      redaction_applied: false,
      reasons: [mayShowDetail ? "user_requested_or_authenticated" : "discreet_mode_off"],
    };
  }

  const sensitive = new Set([
    ...SENSITIVE_KEYS,
    ...(input.sensitiveFactKeys ?? []),
  ]);
  const safeFacts: Record<string, unknown> = {};
  const redacted: string[] = [];
  for (const [key, value] of Object.entries(input.facts)) {
    if (sensitive.has(key)) redacted.push(key);
    else safeFacts[key] = value;
  }
  return {
    level: "summary",
    safe_facts: safeFacts,
    redacted_keys: redacted,
    redaction_applied: redacted.length > 0,
    reasons: [
      forceSafeSummary
        ? "sensitive_proactive_external_output"
        : "discreet_proactive_external_output",
    ],
  };
}
