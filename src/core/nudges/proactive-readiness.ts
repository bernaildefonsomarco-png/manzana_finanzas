import type { ProactiveNudgeActivationConfig } from "./proactive-activation";

export type ProactiveGlobalReadiness = {
  configuration_ready: boolean;
  sending_active: boolean;
  blockers: string[];
  safety_holds: string[];
  checks: {
    kapso_provider_selected: boolean;
    provider_config_ready: boolean;
    payment_method_confirmed: boolean;
    template_configured: boolean;
    template_approval_attested: boolean;
    template_approved_live: boolean;
    business_account_configured: boolean;
    pilot_cohort_configured: boolean;
    pilot_allowlist_valid: boolean;
  };
};

export function buildProactiveGlobalReadiness(input: {
  config: ProactiveNudgeActivationConfig;
  // Opaco a proposito: este fichero solo compara contra el nombre del
  // proveedor esperado, no necesita saber el vocabulario completo de
  // proveedores que vive en el adaptador de canal.
  provider: string;
  providerReady: boolean;
  template: { ready: boolean; [key: string]: unknown };
}): ProactiveGlobalReadiness {
  const checks = {
    kapso_provider_selected: input.provider === "kapso",
    provider_config_ready: input.providerReady,
    payment_method_confirmed: input.config.paymentMethodConfirmed,
    template_configured: Boolean(input.config.templateName),
    template_approval_attested: input.config.templateApprovalConfirmed,
    template_approved_live: input.template.ready,
    business_account_configured: Boolean(input.config.businessAccountId),
    pilot_cohort_configured: input.config.pilotUserIds.size > 0,
    pilot_allowlist_valid: input.config.invalidPilotUserIds.length === 0,
  };
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const configurationReady = blockers.length === 0;
  const safetyHolds: string[] = [];
  if (input.config.mode !== "pilot") {
    safetyHolds.push(`activation_mode_${input.config.mode}`);
  }
  if (!input.config.sendKillSwitchEnabled) {
    safetyHolds.push("proactive_send_kill_switch_disabled");
  }

  return {
    configuration_ready: configurationReady,
    sending_active:
      configurationReady &&
      input.config.mode === "pilot" &&
      input.config.sendKillSwitchEnabled,
    blockers,
    safety_holds: safetyHolds,
    checks,
  };
}
