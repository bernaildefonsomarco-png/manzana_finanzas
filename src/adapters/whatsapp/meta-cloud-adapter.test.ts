import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildWhatsAppMessageIdempotencyKey,
  buildWhatsAppStatusIdempotencyKey,
  normalizeMetaCloudWebhook,
  normalizePhone,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from "./meta-cloud-adapter";

describe("Meta WhatsApp Cloud adapter", () => {
  it("verifica el challenge del webhook con token esperado", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "verify-token",
      "hub.challenge": "123456",
    });

    expect(verifyMetaWebhookChallenge(params, "verify-token")).toBe("123456");
    expect(verifyMetaWebhookChallenge(params, "otro-token")).toBeNull();
  });

  it("valida X-Hub-Signature-256 sobre el body crudo", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const secret = "app-secret";
    const signature = createHmac("sha256", secret).update(body, "utf8").digest("hex");

    expect(
      verifyMetaWebhookSignature(body, `sha256=${signature}`, secret, {
        requireSignature: true,
      })
    ).toBe(true);
    expect(
      verifyMetaWebhookSignature(`${body} `, `sha256=${signature}`, secret, {
        requireSignature: true,
      })
    ).toBe(false);
  });

  it("normaliza mensajes de texto y status de Meta", () => {
    const normalized = normalizeMetaCloudWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_1",
          changes: [
            {
              field: "messages",
              value: {
                metadata: {
                  display_phone_number: "51 999 888 777",
                  phone_number_id: "phone_1",
                },
                contacts: [{ wa_id: "51911111111", profile: { name: "Ana" } }],
                messages: [
                  {
                    from: "51911111111",
                    id: "wamid.abc",
                    timestamp: "1780877000",
                    text: { body: "gaste 8 cafe" },
                    type: "text",
                  },
                ],
                statuses: [
                  {
                    id: "wamid.outbound",
                    recipient_id: "51911111111",
                    status: "delivered",
                    timestamp: "1780877010",
                    conversation: { id: "conv_1" },
                    pricing: { category: "utility" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(normalized.inboundMessages).toHaveLength(1);
    expect(normalized.inboundMessages[0]).toMatchObject({
      provider: "meta_cloud",
      providerMessageId: "wamid.abc",
      waPhoneNumberId: "phone_1",
      fromPhone: "+51911111111",
      toPhone: "+51999888777",
      messageType: "text",
      text: "gaste 8 cafe",
    });

    expect(normalized.statuses).toHaveLength(1);
    expect(normalized.statuses[0]).toMatchObject({
      providerMessageId: "wamid.outbound",
      recipientPhone: "+51911111111",
      status: "delivered",
      conversationId: "conv_1",
      pricingCategory: "utility",
    });
  });

  it("prefiere el id del boton interactivo sobre el titulo visible", () => {
    const normalized = normalizeMetaCloudWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone_1" },
                messages: [
                  {
                    from: "51911111111",
                    id: "wamid.button.1",
                    timestamp: "1780877000",
                    type: "interactive",
                    interactive: {
                      type: "button_reply",
                      button_reply: {
                        id: "confirmar P-ABC12345",
                        title: "Confirmar",
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(normalized.inboundMessages[0]).toMatchObject({
      messageType: "interactive",
      text: "confirmar P-ABC12345",
    });
  });

  it("construye idempotency keys estables por mensaje y status", () => {
    const normalized = normalizeMetaCloudWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone_1" },
                messages: [
                  {
                    from: "51911111111",
                    id: "wamid.abc",
                    timestamp: "1780877000",
                    text: { body: "hola" },
                    type: "text",
                  },
                ],
                statuses: [
                  {
                    id: "wamid.outbound",
                    recipient_id: "51911111111",
                    status: "read",
                    timestamp: "1780877010",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(buildWhatsAppMessageIdempotencyKey(normalized.inboundMessages[0])).toBe(
      "meta_cloud:message:wamid.abc"
    );
    expect(buildWhatsAppStatusIdempotencyKey(normalized.statuses[0])).toBe(
      "meta_cloud:status:wamid.outbound:read:2026-06-08T00:03:30.000Z"
    );
  });

  it("normaliza telefonos al formato usado por profiles.phone_e164", () => {
    expect(normalizePhone("51987654321")).toBe("+51987654321");
    expect(normalizePhone("+51 987 654 321")).toBe("+51987654321");
  });
});
