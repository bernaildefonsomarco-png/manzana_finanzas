import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  getExperiencePreferences,
  setExperiencePreferences,
} from "@/data/repositories/experience-preferences.repository";
import { createServiceClient } from "@/data/supabase/server";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";

export const dynamic = "force-dynamic";

const PreferencesSchema = z.object({
  discreet_mode_enabled: z.boolean(),
  insights_whatsapp_opt_in: z.boolean(),
  weekly_summary_enabled: z.boolean(),
  weekly_summary_channel: z.enum(["dashboard", "whatsapp"]),
});

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const preferences = await getExperiencePreferences(
      auth.client,
      auth.userId,
    );
    return okJson({ preferences }, meta, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

export async function PUT(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para guardar las preferencias.",
        meta,
        400
      );
    }

    const preferences = PreferencesSchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const saved = await setExperiencePreferences(createServiceClient(), {
      userId: auth.userId,
      preferences,
      idempotencyKey,
    });
    return okJson({ preferences: saved }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
