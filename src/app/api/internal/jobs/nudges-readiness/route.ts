import { z } from "zod";
import {
  checkKapsoTemplateReadiness,
  getKapsoTemplateReadinessConfigFromEnv,
  type KapsoTemplateReadiness,
} from "@/adapters/whatsapp/kapso-template-readiness";
import {
  getWhatsAppProviderFromEnv,
  getWhatsAppSendConfigFromEnv,
  isWhatsAppSendConfigReady,
} from "@/adapters/whatsapp/send-config";
import { isQuietHoursActive } from "@/core/nudges/nudge-policy";
import { getProactiveNudgeActivationConfig } from "@/core/nudges/proactive-activation";
import { buildProactiveGlobalReadiness } from "@/core/nudges/proactive-readiness";
import {
  getProactiveNudgeUserOperationalState,
  getProactivePilotMetrics,
} from "@/data/repositories/proactive-nudge-operations.repository";
import { createServiceClient } from "@/data/supabase/server";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";

const ReadinessRequestSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    window_days: z.coerce.number().int().min(1).max(31).optional(),
  })
  .strict();

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const authError = authorizeReadiness(request, meta);
    if (authError) return authError;

    const url = new URL(request.url);
    const parsed = ReadinessRequestSchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const activationConfig = getProactiveNudgeActivationConfig();
    const provider = getWhatsAppProviderFromEnv();
    const providerReady = isWhatsAppSendConfigReady(
      getWhatsAppSendConfigFromEnv(),
    );
    const template =
      provider === "kapso"
        ? await checkKapsoTemplateReadiness(
            getKapsoTemplateReadinessConfigFromEnv(),
          )
        : unsupportedProviderTemplateReadiness(provider);
    const global = buildProactiveGlobalReadiness({
      config: activationConfig,
      provider,
      providerReady,
      template,
    });
    const serviceClient = createServiceClient();
    const metricUserIds = parsed.user_id
      ? [parsed.user_id]
      : [...activationConfig.pilotUserIds];
    const [metrics, userState] = await Promise.all([
      getProactivePilotMetrics(
        serviceClient,
        metricUserIds,
        parsed.window_days ?? 7,
      ),
      parsed.user_id
        ? getProactiveNudgeUserOperationalState(serviceClient, parsed.user_id)
        : Promise.resolve(null),
    ]);
    const user =
      parsed.user_id && userState
        ? buildUserReadiness({
            userId: parsed.user_id,
            state: userState,
            activationConfig,
            configurationReady: global.configuration_ready,
            sendingActive: global.sending_active,
          })
        : null;

    return okJson(
      {
        read_only: true,
        checked_at: new Date().toISOString(),
        provider,
        activation: {
          mode: activationConfig.mode,
          send_kill_switch_enabled:
            activationConfig.sendKillSwitchEnabled,
          pilot_cohort_size: activationConfig.pilotUserIds.size,
          invalid_pilot_user_ids_count:
            activationConfig.invalidPilotUserIds.length,
        },
        global,
        template,
        user,
        metrics,
      },
      meta,
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function buildUserReadiness(input: {
  userId: string;
  state: Awaited<ReturnType<typeof getProactiveNudgeUserOperationalState>>;
  activationConfig: ReturnType<typeof getProactiveNudgeActivationConfig>;
  configurationReady: boolean;
  sendingActive: boolean;
}) {
  const pilotAllowlisted = input.activationConfig.pilotUserIds.has(
    input.userId.toLowerCase(),
  );
  const hasTypeOptIn =
    input.state.consent.payment_due || input.state.consent.debt_due;
  const quietHoursActive = isQuietHoursActive(
    new Date(),
    input.state.timezone,
    input.state.consent.quiet_hours_start,
    input.state.consent.quiet_hours_end,
  );
  const blockers = [
    !pilotAllowlisted && "pilot_user_not_allowlisted",
    !input.state.phone_linked && "whatsapp_phone_not_linked",
    !input.state.consent.whatsapp_opt_in && "whatsapp_opt_in_missing",
    !hasTypeOptIn && "nudge_type_opt_in_missing",
    quietHoursActive && "quiet_hours_active_now",
  ].filter((value): value is string => Boolean(value));
  const pilotReady =
    input.configurationReady &&
    pilotAllowlisted &&
    input.state.phone_linked &&
    input.state.consent.whatsapp_opt_in &&
    hasTypeOptIn;

  return {
    pilot_allowlisted: pilotAllowlisted,
    phone_linked: input.state.phone_linked,
    consent: input.state.consent,
    timezone: input.state.timezone,
    quiet_hours_active_now: quietHoursActive,
    pilot_ready: pilotReady,
    eligible_now: pilotReady && !quietHoursActive,
    sending_active_for_user:
      input.sendingActive && pilotReady && !quietHoursActive,
    blockers,
  };
}

function unsupportedProviderTemplateReadiness(
  provider: string,
): KapsoTemplateReadiness {
  return {
    checked: false,
    ready: false,
    found: false,
    template_name: process.env.WHATSAPP_NUDGE_TEMPLATE_NAME ?? null,
    language: process.env.WHATSAPP_NUDGE_TEMPLATE_LANGUAGE ?? "es_PE",
    status: null,
    category: null,
    reason: `live_template_check_not_supported_for_${provider}`,
    checked_at: new Date().toISOString(),
  };
}

function authorizeReadiness(
  request: Request,
  meta: { trace_id: string },
) {
  const authorization = request.headers.get("authorization");
  const allowedSecrets = [
    process.env.CRON_SECRET,
    process.env.WORKER_SECRET,
  ].filter((secret): secret is string => Boolean(secret));

  if (allowedSecrets.length > 0) {
    const authorized = allowedSecrets.some(
      (secret) => authorization === `Bearer ${secret}`,
    );
    return authorized
      ? null
      : errorJson("FORBIDDEN", "Readiness no autorizado.", meta, 403);
  }
  if (process.env.APP_ENV !== "local") {
    return errorJson(
      "FORBIDDEN",
      "CRON_SECRET o WORKER_SECRET no configurado para readiness.",
      meta,
      403,
    );
  }
  return null;
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
