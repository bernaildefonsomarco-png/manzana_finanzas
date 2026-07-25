import { z } from "zod";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  getEmailCaptureHealth,
  getEmailExtractionAgentHealth,
  getEmailSenderAuthenticationHealth,
} from "@/data/repositories/email.repository";
import { createServiceClient } from "@/data/supabase/server";
import { logger } from "@/shared/telemetry/logger";

export const dynamic = "force-dynamic";

const QuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(90).default(7),
  })
  .strict();

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const authError = authorize(request, meta);
    if (authError) return authError;

    const url = new URL(request.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams));
    const client = createServiceClient();
    const [health, extractionAgentHealth, senderAuthenticationHealth] =
      await Promise.all([
        getEmailCaptureHealth(client, query.days),
        getEmailExtractionAgentHealth(client, query.days),
        getEmailSenderAuthenticationHealth(client, query.days),
      ]);
    const failedTargets = [
      ...Object.entries(health.targets)
        .filter(([, value]) => value === false)
        .map(([name]) => name),
      ...Object.entries(extractionAgentHealth.targets)
        .filter(([, value]) => value === false)
        .map(([name]) => `email_extraction_agent.${name}`),
      ...Object.entries(senderAuthenticationHealth.targets)
        .filter(([, value]) => value === false)
        .map(([name]) => `sender_authentication.${name}`),
    ];
    const healthy = failedTargets.length === 0;

    if (!healthy) {
      logger.warn("email.capture_health_degraded", {
        failed_targets: failedTargets,
        window_days: health.window_days,
        allowed_messages_persisted: health.allowed_messages_persisted,
        parse_failures: health.parse_failures,
        failed_external_events: health.failed_external_events,
        stuck_external_events: health.stuck_external_events,
        watch_connections_unhealthy: health.watch_connections_unhealthy,
        connections_missing_token: health.connections_missing_token,
        stale_active_templates: health.stale_active_templates,
        email_extraction_agent_attempts:
          extractionAgentHealth.agent_attempts,
        email_extraction_agent_fallbacks:
          extractionAgentHealth.agent_fallbacks,
        email_extraction_agent_grounding_failures:
          extractionAgentHealth.agent_grounding_failures,
        email_extraction_agent_p95_latency_ms:
          extractionAgentHealth.p95_agent_latency_ms,
        email_extraction_agent_evidence_repaired_attempts:
          extractionAgentHealth.agent_evidence_repaired_attempts,
        email_extraction_agent_value_normalized_attempts:
          extractionAgentHealth.agent_value_normalized_attempts,
        sender_authentication_rejections:
          senderAuthenticationHealth.sender_authentication_rejections,
        sender_authentication_content_fetch_violations:
          senderAuthenticationHealth.content_fetch_violations,
      });
    }

    return okJson(
      {
        worker: "email_capture_health",
        healthy,
        failed_targets: failedTargets,
        health,
        extraction_agent_health: extractionAgentHealth,
        sender_authentication_health: senderAuthenticationHealth,
      },
      meta,
      { status: healthy ? 200 : 503 },
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function authorize(request: Request, meta: { trace_id: string }) {
  const authorization = request.headers.get("authorization");
  const allowedSecrets = [
    process.env.CRON_SECRET,
    process.env.WORKER_SECRET,
  ].filter((secret): secret is string => Boolean(secret));

  if (allowedSecrets.length > 0) {
    if (
      !allowedSecrets.some(
        (secret) => authorization === `Bearer ${secret}`,
      )
    ) {
      return errorJson("FORBIDDEN", "Worker no autorizado.", meta, 403);
    }
    return null;
  }

  if (process.env.APP_ENV !== "local") {
    return errorJson(
      "FORBIDDEN",
      "CRON_SECRET o WORKER_SECRET no configurado para health de email.",
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
