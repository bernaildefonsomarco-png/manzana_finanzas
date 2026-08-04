import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailSender, LoggingEmailSender } from "./outbound-sender";
import { ResendEmailSender } from "./resend-sender";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("createEmailSender — punto único de selección de proveedor", () => {
  it("sin RESEND_API_KEY, cae a LoggingEmailSender (nunca falla en silencio)", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(createEmailSender()).toBeInstanceOf(LoggingEmailSender);
  });

  it("con RESEND_API_KEY, usa ResendEmailSender", () => {
    vi.stubEnv("RESEND_API_KEY", "re_real_key");
    expect(createEmailSender()).toBeInstanceOf(ResendEmailSender);
  });

  it("sin EMAIL_FROM_ADDRESS, usa el remitente de prueba de Resend (nunca cierra AC-MAIL-12 así)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_real_key");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "x" }) });
    vi.stubGlobal("fetch", mockFetch);

    const sender = createEmailSender();
    await sender.send({ to: "a@b.com", subject: "x", html: "x", text: "x" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.from).toBe("Manzana <onboarding@resend.dev>");
    vi.unstubAllGlobals();
  });
});

describe("LoggingEmailSender — AC-MAIL-* sin proveedor: no falla en silencio, ni finge que se entregó de verdad al usuario", () => {
  it("registra la intención sin el cuerpo del mensaje, y devuelve éxito local", async () => {
    const sender = new LoggingEmailSender();
    const result = await sender.send({ to: "a@b.com", subject: "x", html: "<p>secreto</p>", text: "secreto" });
    expect(result.ok).toBe(true);
  });
});
