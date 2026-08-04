// `46` §8 — el token de `/baja` incluye usuario, tipo y caducidad, y
// **solo puede dar de baja**: nunca inicia sesión ni da acceso a nada
// (`SCR-MAIL-02`). HMAC-SHA256 con un secreto de servidor, no JWT: no hace
// falta más que un valor que el servidor pueda verificar sin estado, y un
// HMAC de un payload propio es más corto y no arrastra un `alg` que
// alguien pueda intentar cambiar a `none`.

import { createHmac, timingSafeEqual } from "node:crypto";

export type UnsubscribeTokenPayload = {
  userId: string;
  /** `"__all__"` para "dejar de recibir todos" (`ACT-MAIL-04`). */
  type: string;
  expiresAt: number; // epoch ms
};

function secret(): string {
  const value = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("EMAIL_UNSUBSCRIBE_SECRET no configurado.");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function issueUnsubscribeToken(
  input: { userId: string; type: string },
  ttlMs = 90 * 24 * 60 * 60 * 1000, // 90 días: un enlace de correo puede abrirse mucho después
): string {
  const payload: UnsubscribeTokenPayload = {
    userId: input.userId,
    type: input.type,
    expiresAt: Date.now() + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export type VerifyResult =
  | { ok: true; payload: UnsubscribeTokenPayload }
  | { ok: false; reason: "malformado" | "firma_invalida" | "caducado" };

export function verifyUnsubscribeToken(token: string): VerifyResult {
  const [body, signature] = token.split(".");
  if (!body || !signature) return { ok: false, reason: "malformado" };

  const expected = sign(body);
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "firma_invalida" };
  }

  let payload: UnsubscribeTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformado" };
  }
  if (typeof payload.userId !== "string" || typeof payload.type !== "string") {
    return { ok: false, reason: "malformado" };
  }
  if (Date.now() > payload.expiresAt) return { ok: false, reason: "caducado" };

  return { ok: true, payload };
}
