import type { SupabaseClient } from "@supabase/supabase-js";
import { getWhatsAppNudgeConsent } from "./nudges.repository";
import type { Database, Json } from "@/data/supabase/types";

type Client = SupabaseClient<Database>;

export type ProactiveNudgeUserOperationalState = {
  phone_linked: boolean;
  timezone: string;
  consent: {
    whatsapp_opt_in: boolean;
    payment_due: boolean;
    debt_due: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
    configured: boolean;
  };
};

export type LatencyMetric = {
  samples: number;
  average_ms: number | null;
  p95_ms: number | null;
};

export type ProactivePilotMetrics = {
  window_days: number;
  scope_users: number;
  truncated: boolean;
  candidates: {
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
  };
  deliveries: {
    total: number;
    by_status: Record<string, number>;
    dispatch_latency: LatencyMetric;
    provider_delivery_latency: LatencyMetric;
    user_response_latency: LatencyMetric;
  };
  provider_attempts: {
    total: number;
    by_status: Record<string, number>;
    latency: LatencyMetric;
    top_error_codes: Array<{ code: string; count: number }>;
  };
  quality_signals: {
    dismissed: number;
    rejected_after_revalidation: number;
    false_positive_rate: null;
    note: string;
  };
  template_usage: {
    paid_templates_today: number;
    paid_templates_this_month: number;
    monetary_cost: null;
    currency: null;
    note: string;
  };
};

const MAX_ROWS_PER_SOURCE = 2_500;

export async function getProactiveNudgeUserOperationalState(
  client: Client,
  userId: string,
): Promise<ProactiveNudgeUserOperationalState> {
  const [profileResult, consent] = await Promise.all([
    client
      .from("profiles")
      .select("phone_e164,timezone")
      .eq("id", userId)
      .maybeSingle(),
    getWhatsAppNudgeConsent(client, userId),
  ]);
  if (profileResult.error) throw profileResult.error;

  return {
    phone_linked: Boolean(profileResult.data?.phone_e164),
    timezone: profileResult.data?.timezone ?? "America/Lima",
    consent,
  };
}

export async function getProactivePilotMetrics(
  client: Client,
  userIds: string[],
  windowDays: number,
  now: Date = new Date(),
): Promise<ProactivePilotMetrics> {
  const scope = [...new Set(userIds.map((value) => value.toLowerCase()))];
  if (scope.length === 0) return emptyMetrics(windowDays);

  const since = new Date(
    now.getTime() - windowDays * 24 * 60 * 60 * 1_000,
  ).toISOString();
  const [candidateResult, deliveryResult, attemptResult, windowResult] =
    await Promise.all([
      client
        .from("nudge_candidates")
        .select("status,type,metadata")
        .in("user_id", scope)
        .gte("created_at", since)
        .limit(MAX_ROWS_PER_SOURCE),
      client
        .from("nudge_deliveries")
        .select("status,created_at,sent_at,delivered_at,responded_at,metadata")
        .in("user_id", scope)
        .eq("channel", "whatsapp")
        .gte("created_at", since)
        .limit(MAX_ROWS_PER_SOURCE),
      client
        .from("whatsapp_delivery_attempts")
        .select("status,latency_ms,error_code,created_at")
        .in("user_id", scope)
        .eq("direction", "outbound")
        .gte("created_at", since)
        .limit(MAX_ROWS_PER_SOURCE),
      client
        .from("whatsapp_window_states")
        .select("paid_templates_today,paid_templates_this_month")
        .in("user_id", scope)
        .limit(MAX_ROWS_PER_SOURCE),
    ]);

  for (const result of [
    candidateResult,
    deliveryResult,
    attemptResult,
    windowResult,
  ]) {
    if (result.error) throw result.error;
  }

  const candidates = candidateResult.data ?? [];
  const deliveries = deliveryResult.data ?? [];
  const attempts = attemptResult.data ?? [];
  const windows = windowResult.data ?? [];
  const truncated = [candidates, deliveries, attempts, windows].some(
    (rows) => rows.length >= MAX_ROWS_PER_SOURCE,
  );

  return {
    window_days: windowDays,
    scope_users: scope.length,
    truncated,
    candidates: {
      total: candidates.length,
      by_status: countBy(candidates, (row) => row.status),
      by_type: countBy(candidates, (row) => row.type),
    },
    deliveries: {
      total: deliveries.length,
      by_status: countBy(deliveries, (row) => row.status),
      dispatch_latency: summarizeLatency(
        deliveries.map((row) => elapsedMs(row.created_at, row.sent_at)),
      ),
      provider_delivery_latency: summarizeLatency(
        deliveries.map((row) => elapsedMs(row.sent_at, row.delivered_at)),
      ),
      user_response_latency: summarizeLatency(
        deliveries.map((row) => elapsedMs(row.sent_at, row.responded_at)),
      ),
    },
    provider_attempts: {
      total: attempts.length,
      by_status: countBy(attempts, (row) => row.status),
      latency: summarizeLatency(attempts.map((row) => row.latency_ms)),
      top_error_codes: topCounts(
        attempts.map((row) => row.error_code).filter(isString),
      ),
    },
    quality_signals: {
      dismissed: candidates.filter((row) => row.status === "dismissed").length,
      rejected_after_revalidation: candidates.filter(
        (row) =>
          row.status === "rejected" &&
          metadataReasons(row.metadata).includes("source_no_longer_eligible"),
      ).length,
      false_positive_rate: null,
      note:
        "La tasa de falsos positivos requiere feedback humano etiquetado; no se infiere desde descartes.",
    },
    template_usage: {
      paid_templates_today: windows.reduce(
        (sum, row) => sum + row.paid_templates_today,
        0,
      ),
      paid_templates_this_month: windows.reduce(
        (sum, row) => sum + row.paid_templates_this_month,
        0,
      ),
      monetary_cost: null,
      currency: null,
      note:
        "El costo monetario se incorpora cuando exista una fuente de billing conciliada; aquí solo se cuentan templates.",
    },
  };
}

function emptyMetrics(windowDays: number): ProactivePilotMetrics {
  const emptyLatency = summarizeLatency([]);
  return {
    window_days: windowDays,
    scope_users: 0,
    truncated: false,
    candidates: { total: 0, by_status: {}, by_type: {} },
    deliveries: {
      total: 0,
      by_status: {},
      dispatch_latency: emptyLatency,
      provider_delivery_latency: emptyLatency,
      user_response_latency: emptyLatency,
    },
    provider_attempts: {
      total: 0,
      by_status: {},
      latency: emptyLatency,
      top_error_codes: [],
    },
    quality_signals: {
      dismissed: 0,
      rejected_after_revalidation: 0,
      false_positive_rate: null,
      note:
        "La tasa de falsos positivos requiere feedback humano etiquetado; no se infiere desde descartes.",
    },
    template_usage: {
      paid_templates_today: 0,
      paid_templates_this_month: 0,
      monetary_cost: null,
      currency: null,
      note:
        "El costo monetario se incorpora cuando exista una fuente de billing conciliada; aquí solo se cuentan templates.",
    },
  };
}

function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = key(row);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function summarizeLatency(values: Array<number | null>): LatencyMetric {
  const samples = values
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .map((value) => Math.max(0, Math.round(value)))
    .sort((left, right) => left - right);
  if (samples.length === 0) {
    return { samples: 0, average_ms: null, p95_ms: null };
  }
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const p95Index = Math.min(
    samples.length - 1,
    Math.ceil(samples.length * 0.95) - 1,
  );
  return {
    samples: samples.length,
    average_ms: Math.round(average),
    p95_ms: samples[p95Index] ?? null,
  };
}

function elapsedMs(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const elapsed = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(elapsed) ? elapsed : null;
}

function topCounts(values: string[]): Array<{ code: string; count: number }> {
  return Object.entries(
    values.reduce<Record<string, number>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));
}

function metadataReasons(metadata: Json): string[] {
  if (!isRecord(metadata) || !Array.isArray(metadata.last_policy_reasons)) {
    return [];
  }
  return metadata.last_policy_reasons.filter(isString);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
