import { describe, expect, it } from "vitest";
import {
  buildKapsoMessagePayload,
  mapKapsoProviderError,
  sendKapsoMessage,
  toKapsoRecipientPhone,
} from "./kapso-sender";
import { WhatsAppSenderError } from "./meta-cloud-sender";
import type { OutboundWhatsAppCommand } from "./types";

const baseCommand: OutboundWhatsAppCommand = {
  provider: "kapso",
  userId: "00000000-0000-0000-0000-000000000001",
  toPhone: "+51 911 111 111",
  messageKind: "freeform",
  text: "Listo. Cafe registrado.",
  idempotencyKey: "trace:message:1",
  traceId: "00000000-0000-0000-0000-000000000002",
};

const config = {
  apiKey: "kapso_key",
  phoneNumberId: "phone_1",
  apiBaseUrl: "https://api.kapso.test/meta/whatsapp/v24.0",
};

describe("Kapso sender", () => {
  it("construye payload freeform compatible con WhatsApp Cloud", () => {
    expect(buildKapsoMessagePayload(baseCommand)).toEqual({
      messaging_product: "whatsapp",
      to: "51911111111",
      type: "text",
      text: {
        preview_url: false,
        body: "Listo. Cafe registrado.",
      },
    });
  });

  it("construye payload template con parametros ordenados", () => {
    const payload = buildKapsoMessagePayload({
      ...baseCommand,
      messageKind: "template",
      text: undefined,
      templateName: "pending_confirmation",
      templateLanguage: "es_PE",
      templateParams: {
        b_movements: "3",
        a_name: "Ana",
      },
    });

    expect(payload).toMatchObject({
      type: "template",
      template: {
        name: "pending_confirmation",
        language: { code: "es_PE" },
      },
    });
    expect(payload.template?.components?.[0]?.parameters).toEqual([
      { type: "text", text: "Ana" },
      { type: "text", text: "3" },
    ]);
  });

  it("construye payload interactivo con botones de respuesta", () => {
    const payload = buildKapsoMessagePayload({
      ...baseCommand,
      messageKind: "interactive",
      text: undefined,
      interactive: {
        type: "button",
        bodyText: "Tienes 2 pendientes por revisar.",
        buttons: [
          { id: "confirm_all", title: "Confirmar" },
          { id: "review", title: "Ver" },
        ],
      },
    });

    expect(payload).toMatchObject({
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Tienes 2 pendientes por revisar." },
        action: {
          buttons: [
            { type: "reply", reply: { id: "confirm_all", title: "Confirmar" } },
            { type: "reply", reply: { id: "review", title: "Ver" } },
          ],
        },
      },
    });
  });

  it("envia a Kapso con X-API-Key y devuelve id de proveedor", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.kapso.1" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await sendKapsoMessage(baseCommand, config, fetcher);

    expect(calls[0]?.url).toBe(
      "https://api.kapso.test/meta/whatsapp/v24.0/phone_1/messages"
    );
    expect(calls[0]?.init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-API-Key": "kapso_key",
    });
    expect(result).toMatchObject({
      provider: "kapso",
      providerMessageId: "wamid.kapso.1",
      httpStatus: 200,
    });
  });

  it("normaliza errores del proveedor", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Invalid API key.",
            type: "Unauthorized",
            code: "unauthorized",
          },
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );

    await expect(
      sendKapsoMessage(baseCommand, { ...config, apiKey: "bad-key" }, fetcher)
    ).rejects.toMatchObject({
      providerError: {
        code: "PROVIDER_ERROR",
        message: "Invalid API key.",
        httpStatus: 401,
        providerErrorCode: "unauthorized",
        providerErrorType: "Unauthorized",
      },
    });

    expect(mapKapsoProviderError({}, 500)).toMatchObject({
      code: "PROVIDER_ERROR",
      httpStatus: 500,
    });
  });

  it("normaliza telefono outbound al formato requerido por Kapso", () => {
    expect(toKapsoRecipientPhone("+51 987 654 321")).toBe("51987654321");
    expect(() => toKapsoRecipientPhone("123")).toThrow(WhatsAppSenderError);
  });
});
