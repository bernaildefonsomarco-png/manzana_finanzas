import { describe, expect, it } from "vitest";
import type { WhatsAppWindowState } from "@/data/repositories/whatsapp-window.repository";
import {
  buildWindowExpiresAt,
  getContinuationPromptMilestone,
  planWhatsAppDelivery,
  resolveWhatsAppWindowStatus,
} from "./window-manager";

const NOW = new Date("2026-06-08T12:00:00.000Z");

function state(overrides: Partial<WhatsAppWindowState>): WhatsAppWindowState {
  return {
    id: "window_1",
    user_id: "00000000-0000-0000-0000-000000000001",
    phone: "+51911111111",
    last_user_message_at: null,
    window_expires_at: null,
    status: "closed",
    paid_templates_today: 0,
    paid_templates_this_month: 0,
    last_paid_template_at: null,
    last_window_continuation_prompt_at: null,
    last_window_final_prompt_at: null,
    created_at: "2026-06-08T00:00:00.000Z",
    updated_at: "2026-06-08T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("WhatsAppWindowManager", () => {
  it("responde freeform si el usuario acaba de iniciar la conversacion", () => {
    expect(
      planWhatsAppDelivery({
        state: null,
        intent: "direct_response",
        hasActionableValue: true,
        userInitiatedResponse: true,
        now: NOW,
      })
    ).toMatchObject({
      mode: "freeform",
      windowStatus: "open",
      requiresPaidTemplate: false,
      reason: "user_initiated_response",
    });
  });

  it("usa freeform o interactive mientras la ventana sigue abierta", () => {
    const window = state({
      last_user_message_at: "2026-06-08T10:00:00.000Z",
      window_expires_at: "2026-06-09T10:00:00.000Z",
      status: "open",
    });

    expect(resolveWhatsAppWindowStatus(window, NOW)).toBe("open");
    expect(
      planWhatsAppDelivery({
        state: window,
        intent: "pending_confirmation",
        hasActionableValue: true,
        preferInteractive: true,
        now: NOW,
      })
    ).toMatchObject({
      mode: "interactive",
      requiresPaidTemplate: false,
      reason: "window_open",
    });
  });

  it("marca closing_soon cuando quedan 12 horas o menos", () => {
    const window = state({
      last_user_message_at: "2026-06-07T23:00:00.000Z",
      window_expires_at: "2026-06-08T23:00:00.000Z",
      status: "open",
    });

    expect(resolveWhatsAppWindowStatus(window, NOW)).toBe("closing_soon");
  });

  it("permite template fuera de ventana solo con opt-in y valor accionable", () => {
    const window = state({
      window_expires_at: "2026-06-08T08:00:00.000Z",
      status: "closed",
    });

    expect(
      planWhatsAppDelivery({
        state: window,
        intent: "pending_confirmation",
        hasActionableValue: true,
        whatsappOptIn: true,
        now: NOW,
      })
    ).toMatchObject({
      mode: "template",
      requiresPaidTemplate: true,
      reason: "window_closed_template_allowed",
    });
  });

  it("manda a app_only si no hay opt-in o no hay valor claro", () => {
    expect(
      planWhatsAppDelivery({
        state: null,
        intent: "insight",
        hasActionableValue: true,
        whatsappOptIn: false,
        now: NOW,
      })
    ).toMatchObject({
      mode: "app_only",
      reason: "whatsapp_opt_in_missing",
    });

    expect(
      planWhatsAppDelivery({
        state: null,
        intent: "insight",
        hasActionableValue: false,
        whatsappOptIn: true,
        now: NOW,
      })
    ).toMatchObject({
      mode: "app_only",
      reason: "no_actionable_value",
    });
  });

  it("bloquea contenido sensible si el copy discreto no esta preparado", () => {
    expect(
      planWhatsAppDelivery({
        state: null,
        intent: "pending_confirmation",
        hasActionableValue: true,
        whatsappOptIn: true,
        isSensitive: true,
        discreetCopyPrepared: false,
        now: NOW,
      })
    ).toMatchObject({
      mode: "blocked",
      reason: "sensitive_copy_not_prepared",
    });
  });

  it("respeta caps suaves de templates pagados", () => {
    const window = state({
      paid_templates_today: 2,
      paid_templates_this_month: 4,
      status: "closed",
    });

    expect(
      planWhatsAppDelivery({
        state: window,
        intent: "pending_confirmation",
        hasActionableValue: true,
        whatsappOptIn: true,
        maxPaidTemplatesPerDay: 2,
        now: NOW,
      })
    ).toMatchObject({
      mode: "app_only",
      reason: "paid_template_cap_reached",
    });
  });

  it("detecta prompt principal de continuidad a las 12h", () => {
    const window = state({
      last_user_message_at: "2026-06-07T23:30:00.000Z",
      window_expires_at: "2026-06-08T23:30:00.000Z",
      status: "open",
    });

    expect(
      getContinuationPromptMilestone({
        state: window,
        hasActionableValue: true,
        now: NOW,
      })
    ).toBe("continuation_12h");
  });

  it("detecta prompt opcional de 20h solo si politica lo permite", () => {
    const window = state({
      last_user_message_at: "2026-06-07T15:00:00.000Z",
      window_expires_at: "2026-06-08T15:00:00.000Z",
      status: "open",
    });

    expect(
      getContinuationPromptMilestone({
        state: window,
        hasActionableValue: true,
        allowOptional20hPrompt: false,
        now: NOW,
      })
    ).toBeNull();
    expect(
      getContinuationPromptMilestone({
        state: window,
        hasActionableValue: true,
        allowOptional20hPrompt: true,
        now: NOW,
      })
    ).toBe("final_20h");
  });

  it("calcula expiracion exacta de 24h desde inbound", () => {
    expect(buildWindowExpiresAt("2026-06-08T09:00:00.000Z")).toBe(
      "2026-06-09T09:00:00.000Z"
    );
  });
});
