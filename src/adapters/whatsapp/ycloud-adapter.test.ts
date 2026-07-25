import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  normalizeYCloudWebhook,
  verifyYCloudWebhookSignature,
} from "./ycloud-adapter";
import {
  buildWhatsAppMessageIdempotencyKey,
  buildWhatsAppStatusIdempotencyKey,
} from "./meta-cloud-adapter";

describe("YCloud WhatsApp adapter", () => {
  it("valida YCloud-Signature con timestamp y body crudo", () => {
    const body = JSON.stringify({
      id: "evt_1",
      type: "whatsapp.inbound_message.received",
    });
    const secret = "ycloud-webhook-secret";
    const timestamp = "1780877000";
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`, "utf8")
      .digest("hex");

    expect(
      verifyYCloudWebhookSignature(body, `t=${timestamp},s=${signature}`, secret, {
        requireSignature: true,
      })
    ).toBe(true);
    expect(
      verifyYCloudWebhookSignature(`${body} `, `t=${timestamp},s=${signature}`, secret, {
        requireSignature: true,
      })
    ).toBe(false);
  });

  it("normaliza mensajes inbound de YCloud", () => {
    const normalized = normalizeYCloudWebhook({
      id: "evt_in_1",
      type: "whatsapp.inbound_message.received",
      createTime: "2026-06-08T00:03:00.000Z",
      whatsappInboundMessage: {
        id: "ycloud_in_1",
        wamid: "wamid.inbound",
        wabaId: "waba_1",
        from: "51911111111",
        to: "51999888777",
        sendTime: "2026-06-08T00:03:20.000Z",
        type: "text",
        text: { body: "gaste 8 cafe" },
      },
    });

    expect(normalized.inboundMessages).toHaveLength(1);
    expect(normalized.inboundMessages[0]).toMatchObject({
      provider: "ycloud",
      providerMessageId: "ycloud_in_1",
      providerThreadId: "evt_in_1",
      waPhoneNumberId: "waba_1",
      fromPhone: "+51911111111",
      toPhone: "+51999888777",
      receivedAt: "2026-06-08T00:03:20.000Z",
      messageType: "text",
      text: "gaste 8 cafe",
    });
    expect(
      buildWhatsAppMessageIdempotencyKey(normalized.inboundMessages[0])
    ).toBe("ycloud:message:ycloud_in_1");
  });

  it("prefiere el id del boton interactivo sobre el titulo visible", () => {
    const normalized = normalizeYCloudWebhook({
      id: "evt_button_1",
      type: "whatsapp.inbound_message.received",
      createTime: "2026-06-08T00:03:00.000Z",
      whatsappInboundMessage: {
        id: "ycloud_in_button",
        wamid: "wamid.button",
        wabaId: "waba_1",
        from: "51911111111",
        to: "51999888777",
        sendTime: "2026-06-08T00:03:20.000Z",
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: {
            id: "confirmar P-ABC12345",
            title: "Confirmar",
          },
        },
      },
    });

    expect(normalized.inboundMessages[0]).toMatchObject({
      messageType: "interactive",
      text: "confirmar P-ABC12345",
    });
  });

  it("normaliza estados de delivery de YCloud", () => {
    const normalized = normalizeYCloudWebhook({
      id: "evt_status_1",
      type: "whatsapp.message.updated",
      createTime: "2026-06-08T00:03:00.000Z",
      whatsappMessage: {
        id: "ycloud_msg_1",
        wamid: "wamid.outbound",
        wabaId: "waba_1",
        to: "51911111111",
        status: "read",
        readTime: "2026-06-08T00:03:30.000Z",
        conversation: { id: "conv_1", originType: "utility" },
        pricingCategory: "utility",
      },
    });

    expect(normalized.statuses).toHaveLength(1);
    expect(normalized.statuses[0]).toMatchObject({
      provider: "ycloud",
      providerMessageId: "ycloud_msg_1",
      waPhoneNumberId: "waba_1",
      recipientPhone: "+51911111111",
      status: "read",
      receivedAt: "2026-06-08T00:03:30.000Z",
      conversationId: "conv_1",
      pricingCategory: "utility",
      errors: [],
    });
    expect(buildWhatsAppStatusIdempotencyKey(normalized.statuses[0])).toBe(
      "ycloud:status:ycloud_msg_1:read:2026-06-08T00:03:30.000Z"
    );
  });
});
