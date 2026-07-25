import { describe, expect, it } from "vitest";
import {
  evaluateProactiveNudgeActivation,
  getProactiveNudgeActivationConfig,
} from "./proactive-activation";

const userId = "11111111-1111-4111-8111-111111111111";

describe("proactive nudge activation", () => {
  it("mantiene apagado el envio aunque sobreviva el flag legacy", () => {
    const config = getProactiveNudgeActivationConfig({
      WHATSAPP_SEND_PROACTIVE_NUDGES: "true",
    });

    const decision = evaluateProactiveNudgeActivation({
      config,
      userId,
      providerReady: true,
      phoneLinked: true,
      whatsappOptIn: true,
      explicitTypeOptIn: true,
      deliveryMode: "freeform",
    });

    expect(config.mode).toBe("off");
    expect(decision.canSend).toBe(false);
    expect(decision.reasons).toContain("activation_mode_off");
  });

  it("planifica pero nunca envia en modo planned", () => {
    const config = readyConfig({ WHATSAPP_PROACTIVE_NUDGE_MODE: "planned" });

    const decision = evaluateProactiveNudgeActivation({
      config,
      userId,
      providerReady: true,
      phoneLinked: true,
      whatsappOptIn: true,
      explicitTypeOptIn: true,
      deliveryMode: "template",
    });

    expect(decision.canSend).toBe(false);
    expect(decision.reasons).toEqual(["activation_mode_planned"]);
  });

  it("rechaza a usuarios fuera de la cohorte aunque todo lo demas este listo", () => {
    const config = readyConfig();

    const decision = evaluateProactiveNudgeActivation({
      config,
      userId: "22222222-2222-4222-8222-222222222222",
      providerReady: true,
      phoneLinked: true,
      whatsappOptIn: true,
      explicitTypeOptIn: true,
      deliveryMode: "freeform",
    });

    expect(decision.canSend).toBe(false);
    expect(decision.reasons).toContain("pilot_user_not_allowlisted");
  });

  it("habilita solo al piloto con consentimiento y puertas operativas completas", () => {
    const config = readyConfig();

    const decision = evaluateProactiveNudgeActivation({
      config,
      userId,
      providerReady: true,
      phoneLinked: true,
      whatsappOptIn: true,
      explicitTypeOptIn: true,
      deliveryMode: "template",
    });

    expect(decision).toEqual({
      canSend: true,
      mode: "pilot",
      pilotUser: true,
      reasons: [],
    });
  });

  it("bloquea si falta consentimiento granular o confirmacion de pago", () => {
    const config = readyConfig({
      WHATSAPP_PROACTIVE_PAYMENT_METHOD_CONFIRMED: "false",
    });

    const decision = evaluateProactiveNudgeActivation({
      config,
      userId,
      providerReady: true,
      phoneLinked: true,
      whatsappOptIn: true,
      explicitTypeOptIn: false,
      deliveryMode: "freeform",
    });

    expect(decision.canSend).toBe(false);
    expect(decision.reasons).toContain("payment_method_not_confirmed");
    expect(decision.reasons).toContain("nudge_type_opt_in_missing");
  });
});

function readyConfig(
  overrides: Record<string, string | undefined> = {},
) {
  return getProactiveNudgeActivationConfig({
    WHATSAPP_PROACTIVE_NUDGE_MODE: "pilot",
    WHATSAPP_SEND_PROACTIVE_NUDGES: "true",
    WHATSAPP_PROACTIVE_PAYMENT_METHOD_CONFIRMED: "true",
    WHATSAPP_PROACTIVE_TEMPLATE_APPROVED: "true",
    WHATSAPP_NUDGE_TEMPLATE_NAME: "manzana_aviso_util_v1",
    WHATSAPP_NUDGE_TEMPLATE_LANGUAGE: "es_PE",
    KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID: "waba-1",
    WHATSAPP_PROACTIVE_NUDGE_PILOT_USER_IDS: userId,
    ...overrides,
  });
}
