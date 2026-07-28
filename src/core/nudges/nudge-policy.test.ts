import { describe, expect, it } from "vitest";
import {
  evaluateNudgePolicy,
  resolveNudgeTypeOptIn,
  type ChannelDeliveryCheck,
} from "./nudge-policy";
import { planWhatsAppDelivery } from "@/adapters/whatsapp/window-manager";
import type { WhatsAppWindowState } from "@/data/repositories/whatsapp-window.repository";
import type {
  NudgeCandidate,
  NudgeDelivery,
  UserPreferences,
} from "@/shared/types/domain";

// Reproduce, solo para las pruebas, lo que el worker real hace en
// proactive-nudge-worker.ts: envolver planWhatsAppDelivery del adaptador de
// canal en la forma que nudge-policy.ts espera (21 S6).
function testChannelDelivery(
  windowState: WhatsAppWindowState | null,
  templateAvailable: boolean,
): ChannelDeliveryCheck {
  return (delivery) => {
    const deliveryPlan = planWhatsAppDelivery({
      state: windowState,
      intent: delivery.intent,
      hasActionableValue: delivery.hasActionableValue,
      whatsappOptIn: true,
      quietHoursActive: false,
      isSensitive: delivery.isSensitive,
      discreetCopyPrepared: delivery.discreetCopyPrepared,
      now: delivery.now,
    });
    if (deliveryPlan.mode === "app_only" || deliveryPlan.mode === "blocked") {
      return { eligible: false, reason: deliveryPlan.reason };
    }
    if (deliveryPlan.mode === "template" && !templateAvailable) {
      return { eligible: false, reason: "utility_template_not_configured" };
    }
    return { eligible: true, mode: deliveryPlan.mode, reason: deliveryPlan.reason };
  };
}

const now = new Date("2026-07-18T15:00:00.000Z");
const candidate: NudgeCandidate = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  type: "payment_due",
  source_entity_type: "recurring_occurrence",
  source_entity_id: "33333333-3333-4333-8333-333333333333",
  priority: 80,
  risk_level: "low",
  status: "approved",
  scheduled_for: now.toISOString(),
  metadata: {},
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};
const preferences: UserPreferences = {
  user_id: candidate.user_id,
  tone_style: null,
  discreet_mode_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  whatsapp_opt_in: true,
  email_opt_in: false,
  nudge_opt_in: { payment_due: true },
  default_account_id: null,
  metadata: {},
};
const openWindow = {
  id: "44444444-4444-4444-8444-444444444444",
  user_id: candidate.user_id,
  phone: "+51999999999",
  last_user_message_at: "2026-07-18T12:00:00.000Z",
  window_expires_at: "2026-07-19T12:00:00.000Z",
  status: "open" as const,
  paid_templates_today: 0,
  paid_templates_this_month: 0,
  last_paid_template_at: null,
  last_window_continuation_prompt_at: null,
  last_window_final_prompt_at: null,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
  metadata: {},
};

describe("NudgePolicyEngine", () => {
  it("requiere consentimiento canonico y del canal cuando ambos existen", () => {
    expect(
      resolveNudgeTypeOptIn({
        candidateType: "payment_due",
        preferences,
        explicitPreferenceEnabled: true,
      }),
    ).toBe(true);
    expect(
      resolveNudgeTypeOptIn({
        candidateType: "payment_due",
        preferences: { ...preferences, nudge_opt_in: { payment_due: false } },
        explicitPreferenceEnabled: true,
      }),
    ).toBe(false);
    expect(
      resolveNudgeTypeOptIn({
        candidateType: "payment_due",
        preferences,
        explicitPreferenceEnabled: false,
      }),
    ).toBe(false);
  });

  it("trata overdue_payment como parte del consentimiento payment_due", () => {
    expect(
      resolveNudgeTypeOptIn({
        candidateType: "overdue_payment",
        preferences,
        explicitPreferenceEnabled: true,
      }),
    ).toBe(true);
  });

  it("autoriza mensaje libre solo tras pasar todos los gates", () => {
    const decision = evaluateNudgePolicy({
      candidate,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now,
    });

    expect(decision.decision).toBe("send");
    expect(decision.delivery_mode).toBe("freeform");
    expect(decision.requires_disclosure).toBe(true);
  });

  it("no convierte visibilidad dashboard en opt-in externo", () => {
    const decision = evaluateNudgePolicy({
      candidate,
      preferences: { ...preferences, whatsapp_opt_in: false },
      explicitTypeOptIn: true,
      recentDeliveries: [],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now,
    });
    expect(decision.decision).toBe("dashboard_only");
    expect(decision.reasons).toContain("whatsapp_opt_in_missing");
  });

  it("mantiene backfill en Dashboard aunque exista consentimiento", () => {
    const decision = evaluateNudgePolicy({
      candidate: {
        ...candidate,
        type: "pending_review",
        source_entity_type: "pending_batch",
        metadata: {
          delivery_channel: "dashboard_only",
          backfill_pending_count: 3,
        },
      },
      preferences: {
        ...preferences,
        nudge_opt_in: { pending_review: true },
      },
      explicitTypeOptIn: true,
      recentDeliveries: [],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now,
    });

    expect(decision.decision).toBe("dashboard_only");
    expect(decision.reasons).toContain("backfill_dashboard_only");
  });

  it("difiere durante horario silencioso", () => {
    const decision = evaluateNudgePolicy({
      candidate,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now: new Date("2026-07-19T04:00:00.000Z"),
    });
    expect(decision.decision).toBe("defer");
    expect(decision.reasons).toContain("quiet_hours");
  });

  it("acepta time de PostgreSQL y permite desactivar quiet hours con horas iguales", () => {
    const decision = evaluateNudgePolicy({
      candidate: { ...candidate, scheduled_for: null },
      preferences: {
        ...preferences,
        quiet_hours_start: "00:00:00",
        quiet_hours_end: "00:00:00",
      },
      explicitTypeOptIn: true,
      recentDeliveries: [],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now: new Date("2026-07-19T04:00:00.000Z"),
    });

    expect(decision.decision).toBe("send");
    expect(decision.reasons).not.toContain("quiet_hours");
  });

  it("no repite el mismo candidato", () => {
    const decision = evaluateNudgePolicy({
      candidate,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [delivery({ nudge_candidate_id: candidate.id })],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now,
    });
    expect(decision.decision).toBe("reject");
    expect(decision.reasons).toContain("candidate_already_delivered");
  });

  it("respeta el maximo global de dos no solicitados por dia", () => {
    const decision = evaluateNudgePolicy({
      candidate,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [delivery(), delivery()],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now,
    });
    expect(decision.decision).toBe("defer");
    expect(decision.reasons).toContain("daily_global_cap_reached");
  });

  it("no abre una conversacion cerrada sin plantilla utility configurada", () => {
    const decision = evaluateNudgePolicy({
      candidate,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(null, false),
      now,
    });
    expect(decision.decision).toBe("dashboard_only");
    expect(decision.reasons).toContain("utility_template_not_configured");
  });

  it("permite plantilla utility en ventana cerrada con consentimiento", () => {
    const decision = evaluateNudgePolicy({
      candidate,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(null, true),
      now,
    });
    expect(decision.decision).toBe("send");
    expect(decision.delivery_mode).toBe("template");
  });

  it("permite un aviso sensible solo si DisclosureEngine preparo copia segura", () => {
    const sensitive = {
      ...candidate,
      type: "debt_due" as const,
      risk_level: "sensitive" as const,
    };

    const blocked = evaluateNudgePolicy({
      candidate: sensitive,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(null, true),
      now,
    });
    const allowed = evaluateNudgePolicy({
      candidate: sensitive,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(null, true),
      sensitiveCopyPrepared: true,
      now,
    });

    expect(blocked.decision).toBe("dashboard_only");
    expect(blocked.reasons).toContain("sensitive_copy_not_prepared");
    expect(allowed.decision).toBe("send");
  });

  it("aplica la cadencia semanal por tipo y no por cualquier entrega", () => {
    const weekly = {
      ...candidate,
      id: "55555555-5555-4555-8555-555555555555",
      type: "weekly_review" as const,
      source_entity_type: "lifecycle_weekly",
    };
    const unrelated = evaluateNudgePolicy({
      candidate: weekly,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [
        delivery({ metadata: { nudge_type: "payment_due" } }),
      ],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now,
    });
    const repeated = evaluateNudgePolicy({
      candidate: weekly,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [
        delivery({
          sent_at: "2026-07-16T15:00:00.000Z",
          metadata: { nudge_type: "weekly_review" },
        }),
      ],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now,
    });

    expect(unrelated.decision).toBe("send");
    expect(repeated.decision).toBe("defer");
    expect(repeated.reasons).toContain("weekly_review_cap_reached");
    expect(repeated.scheduled_for).toBe("2026-07-23T15:00:00.000Z");
  });

  it("no insiste con reengagement si el usuario no respondio", () => {
    const reengagement = {
      ...candidate,
      id: "66666666-6666-4666-8666-666666666666",
      type: "reengagement" as const,
      source_entity_type: "lifecycle_inactivity",
    };
    const decision = evaluateNudgePolicy({
      candidate: reengagement,
      preferences,
      explicitTypeOptIn: true,
      recentDeliveries: [
        delivery({
          sent_at: "2026-07-08T15:00:00.000Z",
          metadata: { nudge_type: "reengagement" },
        }),
      ],
      channel: "whatsapp" as const,
      checkChannelDelivery: testChannelDelivery(openWindow, false),
      now,
    });

    expect(decision.decision).toBe("defer");
    expect(decision.reasons).toContain("reengagement_unanswered_cooldown");
    expect(decision.scheduled_for).toBe("2026-07-22T15:00:00.000Z");
  });
});

function delivery(
  overrides: Partial<NudgeDelivery> = {},
): NudgeDelivery {
  return {
    id: crypto.randomUUID(),
    user_id: candidate.user_id,
    nudge_candidate_id: crypto.randomUUID(),
    channel: "whatsapp",
    status: "sent",
    sent_at: now.toISOString(),
    delivered_at: null,
    responded_at: null,
    response_summary: null,
    created_at: now.toISOString(),
    metadata: {},
    ...overrides,
  };
}
