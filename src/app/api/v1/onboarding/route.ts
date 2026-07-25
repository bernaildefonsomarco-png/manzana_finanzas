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
  deriveInitialOnboardingSummary,
  startInitialOnboarding,
} from "@/core/onboarding/onboarding-activation";
import {
  getInitialOnboardingFacts,
} from "@/data/repositories/onboarding.repository";
import {
  getProfile,
  upsertProfile,
} from "@/data/repositories/profiles.repository";
import { createServiceClient } from "@/data/supabase/server";
import { OnboardingActionRequestSchema } from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const serviceClient = createServiceClient();
    const [profile, facts] = await Promise.all([
      getProfile(auth.client, auth.userId).then(
        (current) => current ?? upsertProfile(serviceClient, auth.userId, {})
      ),
      getInitialOnboardingFacts(auth.client, auth.userId),
    ]);
    const onboarding = deriveInitialOnboardingSummary({
      persistedStatus: profile.onboarding_status,
      confirmedMovementsCount: facts.confirmedMovementsCount,
      debtsCount: facts.debtsCount,
    });

    return okJson({ onboarding }, meta);
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

    const parsed = OnboardingActionRequestSchema.parse(
      await readJsonBody(request)
    );
    const serviceClient = createServiceClient();
    const transition = await startInitialOnboarding(serviceClient, {
      userId: auth.userId,
      source: parsed.source,
      traceId: trace_id,
    });
    const profile = await getProfile(serviceClient, auth.userId);

    if (!profile) {
      return errorJson(
        "NOT_FOUND",
        "No pude encontrar el perfil de activacion.",
        meta,
        404
      );
    }

    return okJson(
      {
        transition,
        onboarding: deriveInitialOnboardingSummary({
          persistedStatus: profile.onboarding_status,
          confirmedMovementsCount: 0,
          debtsCount: 0,
        }),
      },
      meta
    );
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
