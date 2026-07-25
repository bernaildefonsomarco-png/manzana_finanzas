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
  getWhatsAppNudgeConsent,
  setWhatsAppNudgeConsent,
} from "@/data/repositories/nudges.repository";
import { createServiceClient } from "@/data/supabase/server";
import { UpdateWhatsAppNudgeConsentSchema } from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    }

    const consent = await getWhatsAppNudgeConsent(auth.client, auth.userId);
    return okJson({ consent }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

export async function PUT(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    }

    const input = UpdateWhatsAppNudgeConsentSchema.parse(
      await readJsonBody(request),
    );
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const consent = await setWhatsAppNudgeConsent(
      createServiceClient(),
      auth.userId,
      input,
      trace_id,
    );

    return okJson({ consent }, meta);
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
