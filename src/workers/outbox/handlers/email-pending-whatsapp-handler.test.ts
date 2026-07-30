import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "@/core/events/domain-events";
import type {
  WhatsAppWindowState,
} from "@/data/repositories/whatsapp-window.repository";
import type { PendingItem } from "@/shared/types/domain";
import {
  buildPendingConfirmationText,
  createEmailPendingWhatsAppHandler,
  deliverEmailPendingConfirmation,
} from "./email-pending-whatsapp-handler";

const mocks = vi.hoisted(() => ({
  getPendingItemById: vi.fn(),
  listPendingItems: vi.fn(),
  markPendingSentForConfirmation: vi.fn(),
  recordPendingWhatsAppPolicyDecision: vi.fn(),
  schedulePendingConfirmationDelivery: vi.fn(),
  getWhatsAppWindowByUserAndPhone: vi.fn(),
  recordWhatsAppPaidTemplateSent: vi.fn(),
  sendTrackedWhatsAppMessage: vi.fn(),
  getWhatsAppProviderFromEnv: vi.fn(),
  getWhatsAppSendConfigFromEnv: vi.fn(),
  isWhatsAppSendConfigReady: vi.fn(),
}));

vi.mock("@/data/repositories/pending.repository", () => ({
  getPendingItemById: mocks.getPendingItemById,
  listPendingItems: mocks.listPendingItems,
  markPendingSentForConfirmation: mocks.markPendingSentForConfirmation,
  recordPendingWhatsAppPolicyDecision:
    mocks.recordPendingWhatsAppPolicyDecision,
  schedulePendingConfirmationDelivery:
    mocks.schedulePendingConfirmationDelivery,
}));

vi.mock("@/data/repositories/whatsapp-window.repository", () => ({
  getWhatsAppWindowByUserAndPhone:
    mocks.getWhatsAppWindowByUserAndPhone,
  recordWhatsAppPaidTemplateSent:
    mocks.recordWhatsAppPaidTemplateSent,
}));

vi.mock("@/adapters/whatsapp/outbound-service", () => ({
  sendTrackedWhatsAppMessage: mocks.sendTrackedWhatsAppMessage,
}));

vi.mock("@/adapters/whatsapp/send-config", () => ({
  getWhatsAppProviderFromEnv: mocks.getWhatsAppProviderFromEnv,
  getWhatsAppSendConfigFromEnv: mocks.getWhatsAppSendConfigFromEnv,
  isWhatsAppSendConfigReady: mocks.isWhatsAppSendConfigReady,
}));

const userId = "22222222-2222-4222-8222-222222222222";
const pendingId = "33333333-3333-4333-8333-333333333333";
const traceId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-07-23T17:00:00.000Z");

const pending: PendingItem = {
  id: pendingId,
  user_id: userId,
  type: "email_detected",
  status: "pending",
  source: "email_pending",
  source_ref: "gmail:connection:message",
  proposed_action: {
    action: "create_movement",
  },
  normalized_summary: {
    title: "Transferencia entre cuentas",
    amount: 40,
    currency: "PEN",
    occurred_at: "2026-07-23T16:55:00.000Z",
  },
  dedup_status: null,
  risk_level: "low",
  confirmable: true,
  confirm_command: {},
  expires_at: null,
  sent_for_confirmation_at: null,
  resolved_at: null,
  resolved_by: null,
  created_at: "2026-07-23T16:56:00.000Z",
  updated_at: "2026-07-23T16:56:00.000Z",
  metadata: {
    institution_key: "bcp",
  },
};

const openWindow: WhatsAppWindowState = {
  id: "55555555-5555-4555-8555-555555555555",
  user_id: userId,
  phone: "+51999999999",
  last_user_message_at: "2026-07-23T16:00:00.000Z",
  window_expires_at: "2026-07-24T16:00:00.000Z",
  status: "open",
  paid_templates_today: 0,
  paid_templates_this_month: 0,
  last_paid_template_at: null,
  last_window_continuation_prompt_at: null,
  last_window_final_prompt_at: null,
  created_at: "2026-07-23T16:00:00.000Z",
  updated_at: "2026-07-23T16:00:00.000Z",
  metadata: {},
};

describe("email pending WhatsApp outbox handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPendingItemById.mockResolvedValue(pending);
    mocks.listPendingItems.mockResolvedValue([pending]);
    mocks.getWhatsAppWindowByUserAndPhone.mockResolvedValue(openWindow);
    mocks.getWhatsAppProviderFromEnv.mockReturnValue("ycloud");
    mocks.getWhatsAppSendConfigFromEnv.mockReturnValue({
      provider: "ycloud",
      ycloud: {
        apiKey: "test",
        fromPhone: "+51988888888",
      },
    });
    mocks.isWhatsAppSendConfigReady.mockReturnValue(true);
    mocks.sendTrackedWhatsAppMessage.mockResolvedValue({
      attempt: {
        provider_message_id: "wamid-1",
        status: "accepted",
      },
      providerResult: {
        providerMessageId: "wamid-1",
      },
      sent: true,
      idempotent: false,
    });
    mocks.markPendingSentForConfirmation.mockResolvedValue({
      ...pending,
      status: "sent_for_confirmation",
    });
  });

  it("solo consume pendientes email en vivo y nunca backfill", () => {
    const handler = createEmailPendingWhatsAppHandler({} as never);

    expect(handler.canHandle(outboxEvent("email_pending"))).toBe(true);
    expect(handler.canHandle(outboxEvent("backfill_pending"))).toBe(false);
  });

  it("envia botones dentro de la ventana y marca el pendiente", async () => {
    const result = await deliverEmailPendingConfirmation(
      profileClient({
        whatsapp_opt_in: true,
        discreet_mode_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      }),
      {
        userId,
        pendingItemId: pendingId,
        traceId,
        now,
        env: sendEnv(),
      },
    );

    expect(result).toEqual({
      outcome: "sent",
      reason: "window_open",
      delivery_mode: "interactive",
    });
    expect(mocks.sendTrackedWhatsAppMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        messageKind: "interactive",
        idempotencyKey: `email-pending:${pendingId}:whatsapp:v2`,
        interactive: expect.objectContaining({
          buttons: expect.arrayContaining([
            expect.objectContaining({ title: "Confirmar" }),
            expect.objectContaining({ title: "Descartar" }),
          ]),
        }),
      }),
      expect.anything(),
    );
    expect(mocks.markPendingSentForConfirmation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pendingItemId: pendingId,
        deliveryMode: "interactive",
        providerMessageId: "wamid-1",
      }),
    );
    expect(
      mocks.recordPendingWhatsAppPolicyDecision,
    ).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pendingItemId: pendingId,
        reason: "interactive_sent",
      }),
    );
  });

  it("ofrece Revisar en vez de Confirmar si faltan datos especializados", async () => {
    mocks.getPendingItemById.mockResolvedValue({
      ...pending,
      proposed_action: {
        action: "review_specialized",
        movement_type: "transferencia",
      },
    });

    await deliverEmailPendingConfirmation(
      profileClient({
        whatsapp_opt_in: true,
        discreet_mode_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      }),
      {
        userId,
        pendingItemId: pendingId,
        traceId,
        now,
        env: sendEnv(),
      },
    );

    expect(mocks.sendTrackedWhatsAppMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        interactive: expect.objectContaining({
          buttons: expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^revisar P-/),
              title: "Revisar",
            }),
            expect.objectContaining({ title: "Descartar" }),
          ]),
        }),
        metadata: expect.objectContaining({
          requires_review: true,
        }),
      }),
      expect.anything(),
    );
  });

  it("programa despues del silencio y no envia", async () => {
    const result = await deliverEmailPendingConfirmation(
      profileClient({
        whatsapp_opt_in: true,
        discreet_mode_enabled: false,
        quiet_hours_start: "08:00",
        quiet_hours_end: "14:00",
      }),
      {
        userId,
        pendingItemId: pendingId,
        traceId,
        now,
        env: sendEnv(),
      },
    );

    expect(result).toMatchObject({
      outcome: "scheduled",
      reason: "quiet_hours",
    });
    expect(mocks.schedulePendingConfirmationDelivery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pendingItemId: pendingId,
        reason: "quiet_hours",
      }),
    );
    expect(mocks.sendTrackedWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("acumula sin plantilla cuando ya existe otra confirmacion", async () => {
    mocks.getWhatsAppWindowByUserAndPhone.mockResolvedValue({
      ...openWindow,
      window_expires_at: "2026-07-22T16:00:00.000Z",
      status: "closed",
    });
    mocks.listPendingItems.mockResolvedValue([
      pending,
      {
        ...pending,
        id: "66666666-6666-4666-8666-666666666666",
        status: "sent_for_confirmation",
        sent_for_confirmation_at: "2026-07-23T15:00:00.000Z",
      },
    ]);

    const result = await deliverEmailPendingConfirmation(
      profileClient({
        whatsapp_opt_in: true,
        discreet_mode_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      }),
      {
        userId,
        pendingItemId: pendingId,
        traceId,
        now,
        env: {
          ...sendEnv(),
          WHATSAPP_EMAIL_PENDING_TEMPLATE_APPROVED: "true",
          WHATSAPP_EMAIL_PENDING_TEMPLATE_NAME: "manzana_movimiento_pendiente",
        },
      },
    );

    expect(result).toMatchObject({
      outcome: "dashboard_only",
      reason: "pending_confirmation_accumulated",
    });
    expect(mocks.sendTrackedWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("usa plantilla aprobada fuera de la ventana", async () => {
    mocks.getWhatsAppWindowByUserAndPhone.mockResolvedValue({
      ...openWindow,
      window_expires_at: "2026-07-22T16:00:00.000Z",
      status: "closed",
    });

    const result = await deliverEmailPendingConfirmation(
      profileClient({
        whatsapp_opt_in: true,
        discreet_mode_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      }),
      {
        userId,
        pendingItemId: pendingId,
        traceId,
        now,
        env: {
          ...sendEnv(),
          WHATSAPP_EMAIL_PENDING_TEMPLATE_APPROVED: "true",
          WHATSAPP_EMAIL_PENDING_TEMPLATE_NAME: "manzana_movimiento_pendiente",
        },
      },
    );

    expect(result.delivery_mode).toBe("template");
    expect(mocks.sendTrackedWhatsAppMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        messageKind: "template",
        templateName: "manzana_movimiento_pendiente",
      }),
      expect.anything(),
    );
    expect(mocks.recordWhatsAppPaidTemplateSent).toHaveBeenCalledOnce();
  });

  it("la copia discreta no expone banco, importe ni concepto", () => {
    const copy = buildPendingConfirmationText(pending, "P-ABC123", true);

    expect(copy).not.toContain("BCP");
    expect(copy).not.toContain("40");
    expect(copy).not.toContain("Transferencia");
    expect(copy).toContain("P-ABC123");
  });
});

function outboxEvent(
  source: "email_pending" | "backfill_pending",
): OutboxEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: userId,
    event_type: "pending_created",
    aggregate_type: "pending_item",
    aggregate_id: pendingId,
    payload: {
      pending_item_id: pendingId,
      source,
      created_from: "gmail",
    },
    payload_version: 1,
    status: "pending",
    attempt_count: 0,
    max_attempts: 8,
    next_attempt_at: now.toISOString(),
    processing_started_at: null,
    published_at: null,
    trace_id: traceId,
    metadata: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    last_error: null,
  };
}

function profileClient(preferences: {
  whatsapp_opt_in: boolean;
  discreet_mode_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}) {
  return {
    from(table: string) {
      const data =
        table === "profiles"
          ? {
              phone_e164: "+51999999999",
              timezone: "America/Lima",
            }
          : preferences;
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data, error: null }),
      };
      return builder;
    },
  } as never;
}

function sendEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    WHATSAPP_SEND_EMAIL_PENDING_CONFIRMATIONS: "true",
  };
}
