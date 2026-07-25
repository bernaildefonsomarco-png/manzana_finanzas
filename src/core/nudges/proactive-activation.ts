import type { WhatsAppDeliveryMode } from "@/adapters/whatsapp/window-manager";

export const PROACTIVE_NUDGE_ACTIVATION_MODES = [
  "off",
  "planned",
  "pilot",
] as const;

export type ProactiveNudgeActivationMode =
  (typeof PROACTIVE_NUDGE_ACTIVATION_MODES)[number];

export type ProactiveNudgeActivationConfig = {
  mode: ProactiveNudgeActivationMode;
  sendKillSwitchEnabled: boolean;
  paymentMethodConfirmed: boolean;
  templateApprovalConfirmed: boolean;
  templateName: string | null;
  templateLanguage: string;
  businessAccountId: string | null;
  pilotUserIds: Set<string>;
  invalidPilotUserIds: string[];
};

export type ProactiveNudgeActivationDecision = {
  canSend: boolean;
  mode: ProactiveNudgeActivationMode;
  pilotUser: boolean;
  reasons: string[];
};

type ProactiveNudgeEnvironment = Record<string, string | undefined>;

export function getProactiveNudgeActivationConfig(
  env: ProactiveNudgeEnvironment = process.env,
): ProactiveNudgeActivationConfig {
  const requestedMode = cleanString(env.WHATSAPP_PROACTIVE_NUDGE_MODE);
  const mode = isActivationMode(requestedMode) ? requestedMode : "off";
  const parsedPilotUsers = parsePilotUserIds(
    env.WHATSAPP_PROACTIVE_NUDGE_PILOT_USER_IDS,
  );

  return {
    mode,
    sendKillSwitchEnabled:
      env.WHATSAPP_SEND_PROACTIVE_NUDGES === "true",
    paymentMethodConfirmed:
      env.WHATSAPP_PROACTIVE_PAYMENT_METHOD_CONFIRMED === "true",
    templateApprovalConfirmed:
      env.WHATSAPP_PROACTIVE_TEMPLATE_APPROVED === "true",
    templateName: cleanString(env.WHATSAPP_NUDGE_TEMPLATE_NAME),
    templateLanguage:
      cleanString(env.WHATSAPP_NUDGE_TEMPLATE_LANGUAGE) ?? "es_PE",
    businessAccountId:
      cleanString(env.KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID) ??
      cleanString(env.WHATSAPP_BUSINESS_ACCOUNT_ID),
    pilotUserIds: parsedPilotUsers.valid,
    invalidPilotUserIds: parsedPilotUsers.invalid,
  };
}

export function evaluateProactiveNudgeActivation(input: {
  config: ProactiveNudgeActivationConfig;
  userId: string;
  providerReady: boolean;
  phoneLinked: boolean;
  whatsappOptIn: boolean;
  explicitTypeOptIn: boolean;
  deliveryMode: WhatsAppDeliveryMode | "dashboard";
}): ProactiveNudgeActivationDecision {
  const reasons: string[] = [];
  const pilotUser = input.config.pilotUserIds.has(input.userId.toLowerCase());

  if (input.config.mode === "off") reasons.push("activation_mode_off");
  if (input.config.mode === "planned") reasons.push("activation_mode_planned");
  if (!input.config.sendKillSwitchEnabled) {
    reasons.push("proactive_send_kill_switch_disabled");
  }
  if (!pilotUser) reasons.push("pilot_user_not_allowlisted");
  if (input.config.invalidPilotUserIds.length > 0) {
    reasons.push("pilot_allowlist_contains_invalid_user_ids");
  }
  if (!input.config.paymentMethodConfirmed) {
    reasons.push("payment_method_not_confirmed");
  }
  if (!input.config.templateName) reasons.push("utility_template_not_configured");
  if (!input.config.templateApprovalConfirmed) {
    reasons.push("utility_template_approval_not_confirmed");
  }
  if (!input.config.businessAccountId) {
    reasons.push("whatsapp_business_account_id_not_configured");
  }
  if (!input.providerReady) reasons.push("provider_config_not_ready");
  if (!input.phoneLinked) reasons.push("whatsapp_phone_not_linked");
  if (!input.whatsappOptIn) reasons.push("whatsapp_opt_in_missing");
  if (!input.explicitTypeOptIn) reasons.push("nudge_type_opt_in_missing");
  if (input.deliveryMode === "dashboard") {
    reasons.push("delivery_mode_not_external");
  }

  return {
    canSend: input.config.mode === "pilot" && reasons.length === 0,
    mode: input.config.mode,
    pilotUser,
    reasons,
  };
}

export function proactiveActivationGlobalBlockers(
  config: ProactiveNudgeActivationConfig,
  providerReady: boolean,
): string[] {
  const decision = evaluateProactiveNudgeActivation({
    config,
    userId: "00000000-0000-4000-8000-000000000000",
    providerReady,
    phoneLinked: true,
    whatsappOptIn: true,
    explicitTypeOptIn: true,
    deliveryMode: "template",
  });

  return decision.reasons.filter(
    (reason) => reason !== "pilot_user_not_allowlisted",
  );
}

function parsePilotUserIds(value: string | undefined): {
  valid: Set<string>;
  invalid: string[];
} {
  const valid = new Set<string>();
  const invalid: string[] = [];

  for (const candidate of (value ?? "").split(",")) {
    const userId = candidate.trim();
    if (!userId) continue;
    if (isUuid(userId)) valid.add(userId.toLowerCase());
    else invalid.push(userId);
  }

  return { valid, invalid };
}

function isActivationMode(
  value: string | null,
): value is ProactiveNudgeActivationMode {
  return PROACTIVE_NUDGE_ACTIVATION_MODES.includes(
    value as ProactiveNudgeActivationMode,
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function cleanString(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
