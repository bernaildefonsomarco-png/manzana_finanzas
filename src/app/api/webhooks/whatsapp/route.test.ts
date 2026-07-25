import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  recordExternalEvent: vi.fn(),
  getExternalEventByIdempotencyKey: vi.fn(),
  appendOutboxEvent: vi.fn(),
  findUserIdByWhatsAppPhone: vi.fn(),
  touchWhatsAppWindowFromInbound: vi.fn(),
  reconcileWhatsAppDeliveryStatusByProviderMessageId: vi.fn(),
  reconcileLinkedWhatsAppDeliveryStatus: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: () => ({ fixture: "service-client" }),
}));

vi.mock("@/data/repositories/events.repository", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/data/repositories/events.repository")
    >();
  return {
    ...actual,
    recordExternalEvent: routeMocks.recordExternalEvent,
    getExternalEventByIdempotencyKey:
      routeMocks.getExternalEventByIdempotencyKey,
    appendOutboxEvent: routeMocks.appendOutboxEvent,
  };
});

vi.mock(
  "@/data/repositories/whatsapp-window.repository",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/data/repositories/whatsapp-window.repository")
      >();
    return {
      ...actual,
      findUserIdByWhatsAppPhone: routeMocks.findUserIdByWhatsAppPhone,
      touchWhatsAppWindowFromInbound:
        routeMocks.touchWhatsAppWindowFromInbound,
    };
  }
);

vi.mock(
  "@/data/repositories/whatsapp-delivery.repository",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/data/repositories/whatsapp-delivery.repository")
      >();
    return {
      ...actual,
      reconcileWhatsAppDeliveryStatusByProviderMessageId:
        routeMocks.reconcileWhatsAppDeliveryStatusByProviderMessageId,
      reconcileLinkedWhatsAppDeliveryStatus:
        routeMocks.reconcileLinkedWhatsAppDeliveryStatus,
    };
  }
);

import { GET, POST } from "./route";

const originalVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
const originalWebhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const originalKapsoWebhookSecret = process.env.KAPSO_WEBHOOK_SECRET;
const originalAppEnv = process.env.APP_ENV;
const originalAutoDrain = process.env.OUTBOX_AUTO_DRAIN_ON_WEBHOOK;

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.recordExternalEvent.mockResolvedValue({
    id: "55555555-5555-4555-8555-555555555555",
    user_id: "22222222-2222-4222-8222-222222222222",
  });
  routeMocks.findUserIdByWhatsAppPhone.mockResolvedValue(
    "22222222-2222-4222-8222-222222222222"
  );
  routeMocks.reconcileWhatsAppDeliveryStatusByProviderMessageId.mockResolvedValue(
    {
      reconciled: true,
      attempt: { id: "attempt-fixture" },
    }
  );
  routeMocks.reconcileLinkedWhatsAppDeliveryStatus.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env.WHATSAPP_VERIFY_TOKEN = originalVerifyToken;
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = originalWebhookVerifyToken;
  process.env.KAPSO_WEBHOOK_SECRET = originalKapsoWebhookSecret;
  process.env.APP_ENV = originalAppEnv;
  process.env.OUTBOX_AUTO_DRAIN_ON_WEBHOOK = originalAutoDrain;
});

describe("WhatsApp webhook route", () => {
  it("responde el challenge cuando el verify token coincide", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "local-token";
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    const response = await GET(
      new Request(
        "http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=local-token&hub.challenge=abc123"
      )
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("abc123");
  });

  it("rechaza el challenge cuando el verify token no coincide", async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "expected-token";

    const response = await GET(
      new Request(
        "http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=abc123"
      )
    );

    expect(response.status).toBe(403);
  });

  it("recibe y reconcilia un delivery Kapso V2 sin persistir texto", async () => {
    process.env.KAPSO_WEBHOOK_SECRET = "kapso-route-fixture-secret";
    process.env.APP_ENV = "staging";
    process.env.OUTBOX_AUTO_DRAIN_ON_WEBHOOK = "false";
    const rawBody = JSON.stringify({
      message: {
        id: "wamid.route.v2",
        timestamp: "1780877010",
        type: "text",
        to: "51911111111",
        text: { body: "texto privado que no debe quedar en status" },
        kapso: {
          direction: "outbound",
          status: "delivered",
          statuses: [
            {
              id: "wamid.route.v2",
              status: "delivered",
              timestamp: "1780877010",
              recipient_id: "51911111111",
            },
          ],
        },
      },
      conversation: {
        id: "conv_route_v2",
        phone_number: "51911111111",
        phone_number_id: "phone_route_v2",
      },
      phone_number_id: "phone_route_v2",
    });
    const signature = createHmac(
      "sha256",
      process.env.KAPSO_WEBHOOK_SECRET
    )
      .update(rawBody, "utf8")
      .digest("hex");

    const response = await POST(
      new Request("http://localhost/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-event": "whatsapp.message.delivered",
          "x-webhook-signature": signature,
        },
        body: rawBody,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      statuses_received: 1,
      statuses_reconciled: 1,
      unknown_users: 0,
    });
    expect(
      routeMocks.reconcileWhatsAppDeliveryStatusByProviderMessageId
    ).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerMessageId: "wamid.route.v2",
        deliveryStatus: "delivered",
        conversationId: "conv_route_v2",
      })
    );
    const persistedInput = routeMocks.recordExternalEvent.mock.calls[0]?.[1];
    expect(persistedInput?.metadata).toMatchObject({
      provider: "kapso",
      delivery_status: "delivered",
      normalized_payload_version: 1,
    });
    expect(JSON.stringify(persistedInput)).not.toContain(
      "texto privado que no debe quedar en status"
    );
  });
});
