import { describe, expect, it } from "vitest";
import {
  buildYCloudMessagePayload,
  mapYCloudProviderError,
  sendYCloudMessage,
  toYCloudE164Phone,
} from "./ycloud-sender";
import { WhatsAppSenderError } from "./meta-cloud-sender";
import type { OutboundWhatsAppCommand } from "./types";

const baseCommand: OutboundWhatsAppCommand = {
  provider: "ycloud",
  userId: "00000000-0000-0000-0000-000000000001",
  toPhone: "+51 911 111 111",
  messageKind: "freeform",
  text: "Listo. Cafe registrado.",
  idempotencyKey: "trace:message:1",
  traceId: "00000000-0000-0000-0000-000000000002",
};

const config = {
  apiKey: "ycloud_key",
  fromPhone: "+51 928 377 977",
  apiBaseUrl: "https://api.ycloud.test/v2",
};

describe("YCloud sender", () => {
  it("construye payload freeform para sendDirectly", () => {
    expect(buildYCloudMessagePayload(baseCommand, config)).toEqual({
      from: "+51928377977",
      to: "+51911111111",
      type: "text",
      text: {
        body: "Listo. Cafe registrado.",
        preview_url: false,
      },
      externalId: "trace:message:1",
    });
  });

  it("construye payload template con parametros deterministas", () => {
    const payload = buildYCloudMessagePayload(
      {
        ...baseCommand,
        messageKind: "template",
        text: undefined,
        templateName: "pending_confirmation",
        templateLanguage: "es_PE",
        templateParams: {
          b_movements: "3",
          a_name: "Ana",
        },
      },
      config
    );

    expect(payload).toMatchObject({
      from: "+51928377977",
      to: "+51911111111",
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
    const payload = buildYCloudMessagePayload(
      {
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
      },
      config
    );

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

  it("envia a YCloud con X-API-Key y devuelve id de proveedor", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ id: "ycloud_msg_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await sendYCloudMessage(baseCommand, config, fetcher);

    expect(calls[0]?.url).toBe(
      "https://api.ycloud.test/v2/whatsapp/messages/sendDirectly"
    );
    expect(calls[0]?.init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-API-Key": "ycloud_key",
    });
    expect(result).toMatchObject({
      provider: "ycloud",
      providerMessageId: "ycloud_msg_1",
      httpStatus: 200,
    });
  });

  it("normaliza errores del proveedor", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Invalid API key.",
            type: "authentication_error",
            code: "unauthorized",
          },
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );

    await expect(
      sendYCloudMessage(baseCommand, { ...config, apiKey: "bad-key" }, fetcher)
    ).rejects.toMatchObject({
      providerError: {
        code: "PROVIDER_ERROR",
        message: "Invalid API key.",
        httpStatus: 401,
        providerErrorCode: "unauthorized",
        providerErrorType: "authentication_error",
      },
    });

    expect(mapYCloudProviderError({}, 500)).toMatchObject({
      code: "PROVIDER_ERROR",
      httpStatus: 500,
    });
  });

  it("rechaza telefonos que no pueden enviarse como E.164", () => {
    expect(toYCloudE164Phone("+51 987 654 321")).toBe("+51987654321");
    expect(() => toYCloudE164Phone("123")).toThrow(WhatsAppSenderError);
  });
});
