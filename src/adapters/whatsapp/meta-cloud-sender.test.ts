import { describe, expect, it } from "vitest";
import {
  buildMetaCloudMessagePayload,
  mapMetaCloudProviderError,
  sendMetaCloudMessage,
  toMetaRecipientPhone,
  WhatsAppSenderError,
} from "./meta-cloud-sender";
import type { OutboundWhatsAppCommand } from "./types";

const baseCommand: OutboundWhatsAppCommand = {
  provider: "meta_cloud",
  userId: "00000000-0000-0000-0000-000000000001",
  toPhone: "+51 911 111 111",
  messageKind: "freeform",
  text: "Listo. Cafe registrado.",
  idempotencyKey: "trace:message:1",
  traceId: "00000000-0000-0000-0000-000000000002",
};

describe("Meta Cloud sender", () => {
  it("construye payload freeform seguro para mensajes dentro de ventana", () => {
    expect(buildMetaCloudMessagePayload(baseCommand)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "51911111111",
      type: "text",
      text: {
        preview_url: false,
        body: "Listo. Cafe registrado.",
      },
    });
  });

  it("construye payload template con parametros deterministas", () => {
    const payload = buildMetaCloudMessagePayload({
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

  it("construye payload interactivo con hasta tres botones", () => {
    const payload = buildMetaCloudMessagePayload({
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

  it("rechaza mensajes interactivos con mas de tres botones", () => {
    expect(() =>
      buildMetaCloudMessagePayload({
        ...baseCommand,
        messageKind: "interactive",
        text: undefined,
        interactive: {
          type: "button",
          bodyText: "Elige una opcion",
          buttons: [
            { id: "1", title: "Uno" },
            { id: "2", title: "Dos" },
            { id: "3", title: "Tres" },
            { id: "4", title: "Cuatro" },
          ],
        },
      })
    ).toThrow(WhatsAppSenderError);
  });

  it("envia a Meta Cloud y devuelve el provider message id", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.out.1" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await sendMetaCloudMessage(
      baseCommand,
      {
        accessToken: "token",
        phoneNumberId: "phone_1",
        graphVersion: "v25.0",
        apiBaseUrl: "https://graph.facebook.test",
      },
      fetcher
    );

    expect(calls[0]?.url).toBe(
      "https://graph.facebook.test/v25.0/phone_1/messages"
    );
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    });
    expect(result).toMatchObject({
      provider: "meta_cloud",
      providerMessageId: "wamid.out.1",
      httpStatus: 200,
    });
  });

  it("normaliza errores del proveedor", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Invalid OAuth access token.",
            type: "OAuthException",
            code: 190,
          },
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );

    await expect(
      sendMetaCloudMessage(
        baseCommand,
        { accessToken: "bad-token", phoneNumberId: "phone_1" },
        fetcher
      )
    ).rejects.toMatchObject({
      providerError: {
        code: "PROVIDER_ERROR",
        message: "Invalid OAuth access token.",
        httpStatus: 401,
        providerErrorCode: 190,
        providerErrorType: "OAuthException",
      },
    });

    expect(mapMetaCloudProviderError({}, 500)).toMatchObject({
      code: "PROVIDER_ERROR",
      httpStatus: 500,
    });
  });

  it("normaliza telefono outbound al formato requerido por Meta", () => {
    expect(toMetaRecipientPhone("+51 987 654 321")).toBe("51987654321");
  });
});
