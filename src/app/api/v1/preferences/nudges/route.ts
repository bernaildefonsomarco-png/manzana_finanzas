import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  evaluateDashboardNudges,
  listDashboardNudgePreferences,
  setDashboardNudgePreference,
} from "@/data/repositories/nudges.repository";
import { createServiceClient } from "@/data/supabase/server";
import { logger } from "@/shared/telemetry/logger";
import { UpdateDashboardNudgePreferenceSchema } from "./schemas";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const preferences = await listDashboardNudgePreferences(
      auth.client,
      auth.userId
    );

    return okJson({ preferences }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const parsed = UpdateDashboardNudgePreferenceSchema.parse(
      await readJsonBody(request)
    );
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const serviceClient = createServiceClient();
    await setDashboardNudgePreference(
      serviceClient,
      auth.userId,
      parsed.nudge_type,
      parsed.enabled
    );

    let refreshed = false;
    if (parsed.enabled) {
      try {
        await evaluateDashboardNudges(serviceClient, auth.userId, {
          traceId: trace_id,
        });
        refreshed = true;
      } catch (error) {
        logger.error("nudges.preference_refresh_failed", {
          error,
          trace_id,
          user_id: auth.userId,
          nudge_type: parsed.nudge_type,
        });
      }
    }

    const preferences = await listDashboardNudgePreferences(
      serviceClient,
      auth.userId
    );

    return okJson({ preferences, refreshed }, meta);
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
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
