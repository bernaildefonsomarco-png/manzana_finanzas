import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildWhatsAppMessageIdempotencyKey,
  buildWhatsAppStatusIdempotencyKey,
} from "./meta-cloud-adapter";
import {
  normalizeKapsoWebhook,
  verifyKapsoWebhookSignature,
} from "./kapso-adapter";

describe("Kapso WhatsApp adapter", () => {
  it("valida X-Webhook-Signature sobre el body crudo", () => {
    const body = JSON.stringify({ event: "message.received", data: { id: "1" } });
    const secret = "kapso-webhook-secret";
    const signature = createHmac("sha256", secret).update(body, "utf8").digest("hex");

    expect(
      verifyKapsoWebhookSignature(body, signature, secret, {
        requireSignature: true,
      })
    ).toBe(true);
    expect(
      verifyKapsoWebhookSignature(`${body} `, signature, secret, {
        requireSignature: true,
      })
    ).toBe(false);
  });

  it("normaliza mensajes inbound de Kapso", () => {
    const normalized = normalizeKapsoWebhook(
      {
        id: "evt_1",
        data: {
          id: "wamid.in.1",
          phoneNumberId: "phone_1",
          from: "51911111111",
          to: "51999888777",
          timestamp: "1780877000",
          type: "text",
          text: { body: "gaste 8 cafe" },
        },
      },
      "message.received"
    );

    expect(normalized.inboundMessages).toHaveLength(1);
    expect(normalized.inboundMessages[0]).toMatchObject({
      provider: "kapso",
      providerMessageId: "wamid.in.1",
      waPhoneNumberId: "phone_1",
      fromPhone: "+51911111111",
      toPhone: "+51999888777",
      messageType: "text",
      text: "gaste 8 cafe",
    });
    expect(
      buildWhatsAppMessageIdempotencyKey(normalized.inboundMessages[0])
    ).toBe("kapso:message:wamid.in.1");
  });

  it("normaliza estados de delivery de Kapso", () => {
    const normalized = normalizeKapsoWebhook(
      {
        id: "evt_2",
        data: {
          id: "wamid.out.1",
          phoneNumberId: "phone_1",
          to: "51911111111",
          timestamp: "1780877010",
          conversation: { id: "conv_1" },
          pricing: { category: "utility" },
        },
      },
      "message.delivered"
    );

    expect(normalized.statuses).toHaveLength(1);
    expect(normalized.statuses[0]).toMatchObject({
      provider: "kapso",
      providerMessageId: "wamid.out.1",
      waPhoneNumberId: "phone_1",
      recipientPhone: "+51911111111",
      status: "delivered",
      conversationId: "conv_1",
      pricingCategory: "utility",
    });
    expect(buildWhatsAppStatusIdempotencyKey(normalized.statuses[0])).toBe(
      "kapso:status:wamid.out.1:delivered:2026-06-08T00:03:30.000Z"
    );
  });

  it("normaliza el envelope V2 oficial sin conservar texto en el status", () => {
    const normalized = normalizeKapsoWebhook(
      {
        message: {
          id: "wamid.v2.delivered",
          timestamp: "1780877010",
          type: "text",
          to: "51911111111",
          text: { body: "contenido que no debe persistirse" },
          kapso: {
            direction: "outbound",
            status: "delivered",
            processing_status: "completed",
            statuses: [
              {
                id: "wamid.v2.delivered",
                status: "sent",
                timestamp: "1780877000",
                recipient_id: "51911111111",
              },
              {
                id: "wamid.v2.delivered",
                status: "delivered",
                timestamp: "1780877010",
                recipient_id: "51911111111",
                pricing: { category: "service" },
              },
            ],
          },
        },
        conversation: {
          id: "conv_v2",
          phone_number: "51911111111",
          phone_number_id: "phone_v2",
        },
        phone_number_id: "phone_v2",
      },
      "whatsapp.message.delivered"
    );

    expect(normalized.statuses).toHaveLength(1);
    expect(normalized.statuses[0]).toMatchObject({
      provider: "kapso",
      providerMessageId: "wamid.v2.delivered",
      waPhoneNumberId: "phone_v2",
      recipientPhone: "+51911111111",
      status: "delivered",
      conversationId: "conv_v2",
      pricingCategory: "service",
      errors: [],
    });
    expect(JSON.stringify(normalized.statuses[0].payload)).not.toContain(
      "contenido que no debe persistirse"
    );
  });

  it.each([
    ["sent", "whatsapp.message.sent"],
    ["read", "whatsapp.message.read"],
    ["failed", "whatsapp.message.failed"],
  ])("normaliza status V2 %s", (status, event) => {
    const normalized = normalizeKapsoWebhook(
      {
        message: {
          id: `wamid.v2.${status}`,
          timestamp: "1780877010",
          to: "51911111111",
          kapso: {
            direction: "outbound",
            status,
            statuses: [
              {
                id: `wamid.v2.${status}`,
                status,
                timestamp: "1780877010",
                recipient_id: "51911111111",
                ...(status === "failed"
                  ? { errors: [{ code: 131047, title: "fixture" }] }
                  : {}),
              },
            ],
          },
        },
        conversation: {
          id: "conv_v2",
          phone_number: "51911111111",
          phone_number_id: "phone_v2",
        },
        phone_number_id: "phone_v2",
      },
      event
    );

    expect(normalized.statuses[0]).toMatchObject({
      providerMessageId: `wamid.v2.${status}`,
      status,
      recipientPhone: "+51911111111",
    });
    expect(normalized.statuses[0].errors).toHaveLength(
      status === "failed" ? 1 : 0
    );
  });

  it("prefiere el id del boton interactivo sobre el titulo visible", () => {
    const normalized = normalizeKapsoWebhook(
      {
        id: "evt_button_1",
        data: {
          id: "wamid.button.1",
          phoneNumberId: "phone_1",
          from: "51911111111",
          to: "51999888777",
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
      },
      "message.received"
    );

    expect(normalized.inboundMessages[0]).toMatchObject({
      messageType: "interactive",
      text: "confirmar P-ABC12345",
    });
  });

  it("remapea payloads Meta compatibles al proveedor Kapso", () => {
    const normalized = normalizeKapsoWebhook({
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
                messages: [
                  {
                    from: "51911111111",
                    id: "wamid.meta-shaped",
                    timestamp: "1780877000",
                    text: { body: "hola" },
                    type: "text",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(normalized.inboundMessages[0]).toMatchObject({
      provider: "kapso",
      providerMessageId: "wamid.meta-shaped",
    });
    expect(
      buildWhatsAppMessageIdempotencyKey(normalized.inboundMessages[0])
    ).toBe("kapso:message:wamid.meta-shaped");
  });
});
