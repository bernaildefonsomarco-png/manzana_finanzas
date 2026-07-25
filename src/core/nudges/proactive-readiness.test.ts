import { describe, expect, it } from "vitest";
import { buildProactiveGlobalReadiness } from "./proactive-readiness";
import { getProactiveNudgeActivationConfig } from "./proactive-activation";

const template = {
  checked: true,
  ready: true,
  found: true,
  template_name: "manzana_payment_due",
  language: "es_PE",
  status: "APPROVED",
  category: "UTILITY",
  reason: "template_approved_live",
  checked_at: "2026-07-20T12:00:00.000Z",
};

describe("proactive global readiness", () => {
  it("distingue configuracion lista de envio activado", () => {
    const config = getProactiveNudgeActivationConfig({
      WHATSAPP_PROACTIVE_NUDGE_MODE: "planned",
      WHATSAPP_SEND_PROACTIVE_NUDGES: "false",
      WHATSAPP_PROACTIVE_PAYMENT_METHOD_CONFIRMED: "true",
      WHATSAPP_PROACTIVE_TEMPLATE_APPROVED: "true",
      WHATSAPP_NUDGE_TEMPLATE_NAME: "manzana_payment_due",
      KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID: "waba-1",
      WHATSAPP_PROACTIVE_NUDGE_PILOT_USER_IDS:
        "11111111-1111-4111-8111-111111111111",
    });

    const result = buildProactiveGlobalReadiness({
      config,
      provider: "kapso",
      providerReady: true,
      template,
    });

    expect(result.configuration_ready).toBe(true);
    expect(result.sending_active).toBe(false);
    expect(result.safety_holds).toEqual([
      "activation_mode_planned",
      "proactive_send_kill_switch_disabled",
    ]);
  });

  it("bloquea si la aprobacion solo fue declarada pero no confirmada en vivo", () => {
    const config = getProactiveNudgeActivationConfig({
      WHATSAPP_PROACTIVE_NUDGE_MODE: "pilot",
      WHATSAPP_SEND_PROACTIVE_NUDGES: "true",
      WHATSAPP_PROACTIVE_PAYMENT_METHOD_CONFIRMED: "true",
      WHATSAPP_PROACTIVE_TEMPLATE_APPROVED: "true",
      WHATSAPP_NUDGE_TEMPLATE_NAME: "manzana_payment_due",
      KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID: "waba-1",
      WHATSAPP_PROACTIVE_NUDGE_PILOT_USER_IDS:
        "11111111-1111-4111-8111-111111111111",
    });

    const result = buildProactiveGlobalReadiness({
      config,
      provider: "kapso",
      providerReady: true,
      template: { ...template, ready: false, status: "PENDING" },
    });

    expect(result.configuration_ready).toBe(false);
    expect(result.sending_active).toBe(false);
    expect(result.blockers).toContain("template_approved_live");
  });
});
