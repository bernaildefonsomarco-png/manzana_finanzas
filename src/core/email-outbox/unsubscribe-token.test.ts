import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

beforeEach(() => {
  vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", "test-secret-do-not-use-in-prod");
});

describe("issueUnsubscribeToken / verifyUnsubscribeToken — 46 §8: solo puede dar de baja", () => {
  it("un token recién emitido verifica con el mismo usuario y tipo", () => {
    const token = issueUnsubscribeToken({ userId: "user-1", type: "cuota_vence" });
    const result = verifyUnsubscribeToken(token);
    expect(result).toEqual({
      ok: true,
      payload: expect.objectContaining({ userId: "user-1", type: "cuota_vence" }),
    });
  });

  it("ACT-MAIL-04: type '__all__' para baja total", () => {
    const token = issueUnsubscribeToken({ userId: "user-1", type: "__all__" });
    const result = verifyUnsubscribeToken(token);
    expect(result.ok).toBe(true);
    expect(result.ok && result.payload.type).toBe("__all__");
  });

  it("un token caducado se rechaza", () => {
    const token = issueUnsubscribeToken({ userId: "user-1", type: "x" }, -1000);
    expect(verifyUnsubscribeToken(token)).toEqual({ ok: false, reason: "caducado" });
  });

  it("un token con la firma alterada se rechaza", () => {
    const token = issueUnsubscribeToken({ userId: "user-1", type: "x" });
    const [body] = token.split(".");
    const tampered = `${body}.${"0".repeat(64)}`;
    expect(verifyUnsubscribeToken(tampered)).toEqual({ ok: false, reason: "firma_invalida" });
  });

  it("un payload alterado tras firmar (mismo largo de firma) se rechaza", () => {
    const token = issueUnsubscribeToken({ userId: "user-1", type: "x" });
    const [, signature] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ userId: "user-2", type: "x", expiresAt: Date.now() + 100000 }),
      "utf8",
    ).toString("base64url");
    expect(verifyUnsubscribeToken(`${forgedBody}.${signature}`)).toEqual({
      ok: false,
      reason: "firma_invalida",
    });
  });

  it("un token malformado (sin punto) se rechaza", () => {
    expect(verifyUnsubscribeToken("no-es-un-token")).toEqual({ ok: false, reason: "malformado" });
  });

  it("RUL-HECHO-02: si la verificación de firma se saltara, el token forjado del caso de arriba pasaría", () => {
    // Documentado como contraste: el test anterior es el que prueba de
    // verdad que la firma se comprueba, no solo que el formato es válido.
    const token = issueUnsubscribeToken({ userId: "user-1", type: "x" });
    expect(verifyUnsubscribeToken(token).ok).toBe(true);
  });
});
