import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  suppressAddress: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/data/repositories/email-outbox.repository", () => ({ suppressAddress: mocks.suppressAddress }));

import { POST } from "./route";

const SECRET = "test-webhook-secret";

beforeEach(() => {
  vi.stubEnv("EMAIL_WEBHOOK_SECRET", SECRET);
  mocks.createServiceClient.mockReset().mockReturnValue({ client: true });
  mocks.suppressAddress.mockReset().mockResolvedValue(undefined);
});

function signedRequest(body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  return new Request("http://localhost/api/webhooks/email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-signature": signature },
    body: raw,
  });
}

describe("POST /api/webhooks/email — AC-MAIL-17: la firma se verifica antes de leer el cuerpo", () => {
  it("AC-MAIL-10: una queja suprime todo, sin excepción", async () => {
    const response = await POST(
      signedRequest({ type: "complaint", user_id: "11111111-1111-4111-8111-111111111111" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ processed: true });
    expect(mocks.suppressAddress).toHaveBeenCalledWith(expect.anything(), {
      userId: "11111111-1111-4111-8111-111111111111",
      reason: "queja",
    });
  });

  it("un rebote duro suprime la dirección", async () => {
    await POST(
      signedRequest({
        type: "bounce",
        bounce_type: "hard",
        user_id: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(mocks.suppressAddress).toHaveBeenCalledWith(expect.anything(), {
      userId: "11111111-1111-4111-8111-111111111111",
      reason: "rebote_duro",
    });
  });

  it("un rebote transitorio NO suprime nada (RUL-MAIL-08: se reintenta, no se suprime)", async () => {
    const response = await POST(
      signedRequest({
        type: "bounce",
        bounce_type: "soft",
        user_id: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.suppressAddress).not.toHaveBeenCalled();
  });

  it("firma inválida: 403, nunca llega a parsear el cuerpo ni a suprimir nada", async () => {
    const response = await POST(
      signedRequest({ type: "complaint", user_id: "11111111-1111-4111-8111-111111111111" }, "otro-secreto"),
    );
    expect(response.status).toBe(403);
    expect(mocks.suppressAddress).not.toHaveBeenCalled();
  });

  it("sin cabecera de firma: 403", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "complaint", user_id: "11111111-1111-4111-8111-111111111111" }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("validación: user_id que no es UUID se rechaza tras verificar la firma", async () => {
    const response = await POST(signedRequest({ type: "complaint", user_id: "no-es-uuid" }));
    expect(response.status).toBe(400);
    expect(mocks.suppressAddress).not.toHaveBeenCalled();
  });

  it("RUL-HECHO-02: si la verificación de firma se saltara, la petición con secreto incorrecto pasaría — este aserto la distingue", async () => {
    const response = await POST(
      signedRequest({ type: "complaint", user_id: "11111111-1111-4111-8111-111111111111" }, "secreto-incorrecto"),
    );
    expect(response.status).not.toBe(200);
  });
});
