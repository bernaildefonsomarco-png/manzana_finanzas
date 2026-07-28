import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getWhatsAppProviderFromEnv,
  getWhatsAppSendConfigFromEnv,
  isWhatsAppSendConfigReady,
} from "@/adapters/whatsapp/send-config";
import { sendTrackedWhatsAppMessage } from "@/adapters/whatsapp/outbound-service";
import { planWhatsAppDelivery } from "@/adapters/whatsapp/window-manager";
import {
  isQuietHoursActive,
  nextQuietHoursEnd,
} from "@/core/nudges/nudge-policy";
import { buildPendingItemReferenceCode } from "@/core/pending/reference-code";
import {
  getWhatsAppWindowByUserAndPhone,
  recordWhatsAppPaidTemplateSent,
} from "@/data/repositories/whatsapp-window.repository";
import {
  getPendingItemById,
  listPendingItems,
  markPendingSentForConfirmation,
  recordPendingWhatsAppPolicyDecision,
  schedulePendingConfirmationDelivery,
} from "@/data/repositories/pending.repository";
import type { Database } from "@/data/supabase/types";
import type { PendingItem } from "@/shared/types/domain";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";

type Client = SupabaseClient<Database>;

export type EmailPendingWhatsAppOutcome = {
  outcome: "sent" | "scheduled" | "dashboard_only" | "ignored";
  reason: string;
  delivery_mode: "interactive" | "template" | "dashboard";
};

export function createEmailPendingWhatsAppHandler(
  client: Client,
): OutboxHandler {
  return {
    consumerName: "email_pending.whatsapp_confirmation_v1",
    canHandle: (event) =>
      event.aggregate_type === "pending_item" &&
      (event.event_type === "pending_confirmation_delivery_requested" ||
        (event.event_type === "pending_created" &&
          event.payload.source === "email_pending")),
    handle: async (event) => {
      const pendingItemId =
        readString(event.payload.pending_item_id) ?? event.aggregate_id;
      if (!pendingItemId || !event.user_id) {
        throw new Error("Evento de confirmacion email sin referencias");
      }
      await deliverEmailPendingConfirmation(client, {
        userId: event.user_id,
        pendingItemId,
        traceId: event.trace_id,
      });
    },
  };
}

export async function deliverEmailPendingConfirmation(
  client: Client,
  input: {
    userId: string;
    pendingItemId: string;
    traceId: string;
    now?: Date;
    env?: NodeJS.ProcessEnv;
  },
): Promise<EmailPendingWhatsAppOutcome> {
  const now = input.now ?? new Date();
  const env = input.env ?? process.env;
  const pending = await getPendingItemById(
    client,
    input.userId,
    input.pendingItemId,
  );
  if (
    !pending ||
    pending.source !== "email_pending" ||
    !["pending", "sent_for_confirmation", "user_edited"].includes(
      pending.status,
    )
  ) {
    return outcome("ignored", "pending_not_eligible", "dashboard");
  }

  const [profileResult, preferencesResult] = await Promise.all([
    client
      .from("profiles")
      .select("phone_e164,timezone")
      .eq("id", input.userId)
      .maybeSingle(),
    client
      .from("user_preferences")
      .select(
        "whatsapp_opt_in,discreet_mode_enabled,quiet_hours_start,quiet_hours_end",
      )
      .eq("user_id", input.userId)
      .maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (preferencesResult.error) throw preferencesResult.error;
  const profile = profileResult.data;
  const preferences = preferencesResult.data;
  if (!profile?.phone_e164) {
    await recordDecision(client, input, "whatsapp_phone_missing");
    return outcome("dashboard_only", "whatsapp_phone_missing", "dashboard");
  }

  const timezone = profile.timezone || "America/Lima";
  const quietStart = preferences?.quiet_hours_start ?? "22:00";
  const quietEnd = preferences?.quiet_hours_end ?? "08:00";
  const quietHoursActive = isQuietHoursActive(
    now,
    timezone,
    quietStart,
    quietEnd,
  );
  if (quietHoursActive) {
    const scheduledFor = nextQuietHoursEnd(now, timezone, quietEnd);
    await schedulePendingConfirmationDelivery(client, {
      userId: input.userId,
      pendingItemId: input.pendingItemId,
      traceId: input.traceId,
      scheduledFor,
      reason: "quiet_hours",
    });
    await recordDecision(
      client,
      input,
      "quiet_hours",
      scheduledFor,
    );
    return outcome("scheduled", "quiet_hours", "dashboard");
  }

  const windowState = await getWhatsAppWindowByUserAndPhone(
    client,
    input.userId,
    profile.phone_e164,
  );
  const activeEmailPending = await listPendingItems(client, input.userId, {
    source: "email_pending",
    limit: 100,
  });
  const hasUnansweredConfirmation = activeEmailPending.some(
    (item) =>
      item.id !== pending.id &&
      item.status === "sent_for_confirmation" &&
      item.sent_for_confirmation_at !== null,
  );
  const discreet =
    preferences?.discreet_mode_enabled === true ||
    pending.risk_level === "sensitive";
  const deliveryPlan = planWhatsAppDelivery({
    state: windowState,
    intent: "pending_confirmation",
    hasActionableValue: true,
    preferInteractive: true,
    whatsappOptIn: preferences?.whatsapp_opt_in === true,
    quietHoursActive: false,
    isSensitive: discreet,
    discreetCopyPrepared: true,
    maxPaidTemplatesPerDay: 2,
    maxPaidTemplatesPerMonth: 20,
    now,
  });

  if (
    deliveryPlan.mode === "template" &&
    hasUnansweredConfirmation
  ) {
    await recordDecision(client, input, "pending_confirmation_accumulated");
    return outcome(
      "dashboard_only",
      "pending_confirmation_accumulated",
      "dashboard",
    );
  }
  if (
    deliveryPlan.mode === "app_only" ||
    deliveryPlan.mode === "blocked"
  ) {
    await recordDecision(client, input, deliveryPlan.reason);
    return outcome("dashboard_only", deliveryPlan.reason, "dashboard");
  }

  if (env.WHATSAPP_SEND_EMAIL_PENDING_CONFIRMATIONS !== "true") {
    await recordDecision(client, input, "email_pending_send_disabled");
    return outcome(
      "dashboard_only",
      "email_pending_send_disabled",
      "dashboard",
    );
  }
  const sendConfig = getWhatsAppSendConfigFromEnv(env);
  if (!isWhatsAppSendConfigReady(sendConfig)) {
    await recordDecision(client, input, "whatsapp_provider_not_configured");
    return outcome(
      "dashboard_only",
      "whatsapp_provider_not_configured",
      "dashboard",
    );
  }

  const provider = getWhatsAppProviderFromEnv(env);
  const pendingCode = buildPendingItemReferenceCode(pending);
  const requiresReview =
    readString(pending.proposed_action.action) === "review_specialized";
  const idempotencyKey = `email-pending:${pending.id}:whatsapp:v2`;
  const isTemplate = deliveryPlan.mode === "template";
  const templateName = cleanString(
    env.WHATSAPP_EMAIL_PENDING_TEMPLATE_NAME,
  );
  const templateApproved =
    env.WHATSAPP_EMAIL_PENDING_TEMPLATE_APPROVED === "true";
  if (isTemplate && (!templateName || !templateApproved)) {
    await recordDecision(client, input, "email_pending_template_not_ready");
    return outcome(
      "dashboard_only",
      "email_pending_template_not_ready",
      "dashboard",
    );
  }

  const sendResult = await sendTrackedWhatsAppMessage(
    client,
    {
      provider,
      userId: input.userId,
      toPhone: profile.phone_e164,
      messageKind: isTemplate ? "template" : "interactive",
      ...(isTemplate
        ? {
            templateName: templateName!,
            templateLanguage:
              cleanString(env.WHATSAPP_EMAIL_PENDING_TEMPLATE_LANGUAGE) ??
              "es_PE",
            templateParams: {},
          }
        : {
            interactive: {
              type: "button" as const,
              bodyText: buildPendingConfirmationText(
                pending,
                pendingCode,
                discreet,
              ),
              buttons: [
                {
                  id: `${
                    requiresReview ? "revisar" : "confirmar"
                  } ${pendingCode}`,
                  title: requiresReview ? "Revisar" : "Confirmar",
                },
                {
                  id: `descartar ${pendingCode}`,
                  title: "Descartar",
                },
              ],
            },
          }),
      idempotencyKey,
      traceId: input.traceId,
      metadata: {
        delivery_domain: "email_pending_confirmation",
        pending_item_id: pending.id,
        discreet_copy: discreet,
        requires_review: requiresReview,
        financial_write: false,
      },
    },
    sendConfig,
  );
  if (
    !sendResult.sent &&
    sendResult.attempt.status === "failed"
  ) {
    throw new Error("El intento WhatsApp idempotente esta fallido");
  }

  await markPendingSentForConfirmation(client, {
    userId: input.userId,
    pendingItemId: pending.id,
    traceId: input.traceId,
    deliveryMode: isTemplate ? "template" : "interactive",
    providerMessageId:
      sendResult.providerResult?.providerMessageId ??
      sendResult.attempt.provider_message_id,
    idempotencyKey,
    sentAt: now.toISOString(),
  });
  await recordDecision(
    client,
    input,
    isTemplate ? "template_sent" : "interactive_sent",
  );
  if (isTemplate && sendResult.sent) {
    await recordWhatsAppPaidTemplateSent(client, {
      userId: input.userId,
      phone: profile.phone_e164,
      sentAt: now.toISOString(),
      traceId: input.traceId,
      providerMessageId: sendResult.attempt.provider_message_id,
      metadata: {
        delivery_domain: "email_pending_confirmation",
        pending_item_id: pending.id,
      },
    });
  }

  return outcome(
    "sent",
    deliveryPlan.reason,
    isTemplate ? "template" : "interactive",
  );
}

export function buildPendingConfirmationText(
  pending: PendingItem,
  pendingCode: string,
  discreet: boolean,
): string {
  if (discreet) {
    return [
      "Detecte un movimiento para revisar.",
      `Codigo ${pendingCode}. Confirmalo o descartalo antes de registrarlo.`,
    ].join("\n");
  }
  const institution = humanize(
    readString(pending.metadata.institution_key) ?? "tu banco",
  );
  const amount =
    typeof pending.normalized_summary.amount === "number"
      ? formatMoney(
          pending.normalized_summary.amount,
          pending.normalized_summary.currency ?? "PEN",
        )
      : null;
  const title =
    pending.normalized_summary.title?.trim() || "movimiento detectado";
  return [
    `Detecte en ${institution}: ${title}${amount ? ` por ${amount}` : ""}.`,
    `Codigo ${pendingCode}. Revisalo antes de registrarlo.`,
  ].join("\n");
}

async function recordDecision(
  client: Client,
  input: {
    userId: string;
    pendingItemId: string;
    traceId: string;
  },
  reason: string,
  scheduledFor: string | null = null,
) {
  await recordPendingWhatsAppPolicyDecision(client, {
    userId: input.userId,
    pendingItemId: input.pendingItemId,
    traceId: input.traceId,
    reason,
    scheduledFor,
  });
}

function outcome(
  value: EmailPendingWhatsAppOutcome["outcome"],
  reason: string,
  deliveryMode: EmailPendingWhatsAppOutcome["delivery_mode"],
): EmailPendingWhatsAppOutcome {
  return {
    outcome: value,
    reason,
    delivery_mode: deliveryMode,
  };
}

function formatMoney(amount: number, currency: "PEN" | "USD"): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    .slice(0, 80);
}

function cleanString(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
