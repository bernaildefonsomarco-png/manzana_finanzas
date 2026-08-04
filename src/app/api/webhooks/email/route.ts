import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { suppressAddress } from "@/data/repositories/email-outbox.repository";
import { createServiceClient } from "@/data/supabase/server";
import { logger } from "@/shared/telemetry/logger";

export const dynamic = "force-dynamic";

// `46` §8 lo llama `POST /email/webhook`, junto a rutas de `/api/v1/*` — pero
// un webhook de un proveedor externo no puede pasar el `verifyOrigin` que
// `src/proxy.ts` exige a toda escritura de `/api/v1/*` (`14` §9): ningún
// proveedor manda nuestro `Origin`. Se corrige la ruta real a
// `/api/webhooks/email`, el mismo patrón que ya usan
// `/api/webhooks/whatsapp` y `/api/webhooks/gmail-pubsub` — las tres son
// "el emisor es un proveedor externo, no un usuario autenticado"
// (`scripts/gates/service-role-lista.ts`).
//
// `AC-MAIL-17` — la única ruta pública de este documento que escribe. Su
// firma se verifica **antes de leer el cuerpo** como JSON: un webhook sin
// verificar es una vía para que cualquiera suprima el correo de cualquier
// usuario (`46` §8).
const PayloadSchema = z.object({
  type: z.enum(["bounce", "complaint"]),
  bounce_type: z.enum(["hard", "soft"]).optional(),
  user_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const rawBody = await request.text();
    if (!verifySignature(request, rawBody)) {
      return errorJson("FORBIDDEN", "Firma inválida.", meta, 403);
    }

    const payload = PayloadSchema.parse(JSON.parse(rawBody));
    const client = createServiceClient();

    if (payload.type === "complaint") {
      // `RUL-MAIL-08`: una queja suprime todo, sin excepción.
      await suppressAddress(client, { userId: payload.user_id, reason: "queja" });
    } else if (payload.bounce_type === "hard") {
      await suppressAddress(client, { userId: payload.user_id, reason: "rebote_duro" });
    } else {
      // Rebote transitorio: no se suprime (RUL-MAIL-08), solo se registra.
      logger.warn("email.rebote_transitorio", { trace_id: meta.trace_id, user_id: payload.user_id });
    }

    return okJson({ processed: true }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function verifySignature(request: Request, rawBody: string): boolean {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) return process.env.APP_ENV === "local";

  const provided = request.headers.get("x-webhook-signature");
  if (!provided) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues),
  );
}
