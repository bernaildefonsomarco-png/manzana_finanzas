import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResendEmailSender } from "./resend-sender";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

const email = {
  to: "marco@ejemplo.com",
  subject: "Tu descarga está lista",
  html: "<p>Hola</p>",
  text: "Hola",
  headers: { "List-Unsubscribe": "<https://manzana.app/baja?t=x>" },
};

describe("ResendEmailSender", () => {
  it("camino feliz: llama a la API de Resend con Bearer y devuelve el id del proveedor", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "msg_123" }) });

    const sender = new ResendEmailSender("re_test_key", "Manzana <hola@manzana.pe>");
    const result = await sender.send(email);

    expect(result).toEqual({ ok: true, providerMessageId: "msg_123" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test_key" }),
      }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      from: "Manzana <hola@manzana.pe>",
      to: "marco@ejemplo.com",
      subject: "Tu descarga está lista",
      headers: { "List-Unsubscribe": "<https://manzana.app/baja?t=x>" },
    });
  });

  it("una respuesta de error de Resend se reporta, no se finge éxito", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: "Invalid `from` field" }),
    });

    const sender = new ResendEmailSender("re_test_key", "sin-verificar@ejemplo.com");
    const result = await sender.send(email);

    expect(result).toEqual({ ok: false, error: "Invalid `from` field" });
  });

  it("un fallo de red se reporta con su mensaje", async () => {
    mockFetch.mockRejectedValue(new Error("fetch failed: ECONNRESET"));

    const sender = new ResendEmailSender("re_test_key", "hola@manzana.pe");
    const result = await sender.send(email);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("ECONNRESET");
  });

  it("una respuesta 200 sin id se trata como fallo, no como éxito silencioso", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    const sender = new ResendEmailSender("re_test_key", "hola@manzana.pe");
    const result = await sender.send(email);

    expect(result.ok).toBe(false);
  });

  it("RUL-HECHO-02: si el Authorization no se enviara, este aserto de cabecera fallaría", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "msg_1" }) });
    const sender = new ResendEmailSender("re_secret", "hola@manzana.pe");
    await sender.send(email);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer re_secret");
  });
});
