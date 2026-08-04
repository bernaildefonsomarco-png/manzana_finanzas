import { z } from "zod";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { verifyUnsubscribeToken } from "@/core/email-outbox/unsubscribe-token";
import { suppressAddress } from "@/data/repositories/email-outbox.repository";
import { setReminderPreference } from "@/data/repositories/reminders.repository";
import { createServiceClient } from "@/data/supabase/server";
import { REMINDER_KINDS } from "@/shared/types/domain";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ token: z.string().min(1) }).strict();

// `46` `ACT-MAIL-04` — baja total: suprime la dirección entera
// (`RUL-MAIL-08`, misma tabla que un rebote duro o una queja) y apaga los
// diez tipos por correo, para que `/configuracion/recordatorios` refleje
// el mismo estado si el usuario entra después. Sin sesión, como `/baja`:
// el token firmado es la única autorización.
export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const body = BodySchema.parse(await readJsonBody(request));
    const verified = verifyUnsubscribeToken(body.token);
    if (!verified.ok) {
      return errorJson("VALIDATION_ERROR", "Ese enlace no es válido.", meta, 400);
    }

    const client = createServiceClient();
    await suppressAddress(client, { userId: verified.payload.userId, reason: "baja_total" });
    await Promise.all(
      REMINDER_KINDS.map((nudgeType) =>
        setReminderPreference(client, verified.payload.userId, {
          nudgeType,
          channel: "email",
          enabled: false,
        }),
      ),
    );

    return okJson({ unsubscribed_all: true }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta, "Enlace inválido.");
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues),
  );
}
