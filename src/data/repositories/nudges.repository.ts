import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDebtDashboardNudgeDrafts,
  buildLifecycleNudgeDrafts,
  buildRecurringDashboardNudgeDrafts,
  type DashboardNudgeDraft,
  type LifecycleNudgeSignals,
} from "@/core/nudges/nudge-evaluator";
import { listDebtInstallmentCommitments } from "@/data/repositories/debts.repository";
import { listRecurringDashboard } from "@/data/repositories/recurring.repository";
import type { Database, Json } from "@/data/supabase/types";
import type {
  InsightCandidate,
  NudgeCandidate,
  NudgePreference,
  NudgeStatus,
} from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

const activeDashboardNudgeStatuses: NudgeStatus[] = [
  "candidate",
  "approved",
  "deferred",
  "scheduled",
];

export const DASHBOARD_NUDGE_PREFERENCE_TYPES = [
  "payment_due",
  "debt_due",
] as const;

export type DashboardNudgePreferenceType =
  (typeof DASHBOARD_NUDGE_PREFERENCE_TYPES)[number];

export type DashboardNudgePreferenceView = {
  nudge_type: DashboardNudgePreferenceType;
  enabled: boolean;
  configured: boolean;
  channel: "dashboard";
  paused_until: string | null;
};

export type DashboardNudgeEvaluationResult = {
  generated: number;
  inserted: number;
  updated: number;
  skipped: number;
  expired: number;
  candidates: NudgeCandidate[];
};

export type WhatsAppNudgeConsentView = {
  whatsapp_opt_in: boolean;
  payment_due: boolean;
  debt_due: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  configured: boolean;
};

export type WhatsAppNudgeConsentInput = Omit<
  WhatsAppNudgeConsentView,
  "configured"
>;

export async function getWhatsAppNudgeConsent(
  client: Client,
  userId: string,
): Promise<WhatsAppNudgeConsentView> {
  const [preferenceResult, channelResult] = await Promise.all([
    client
      .from("user_preferences")
      .select("whatsapp_opt_in,nudge_opt_in,quiet_hours_start,quiet_hours_end")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("nudge_preferences")
      .select("nudge_type,enabled")
      .eq("user_id", userId)
      .eq("channel", "whatsapp")
      .in("nudge_type", ["payment_due", "debt_due"]),
  ]);

  if (preferenceResult.error) throw preferenceResult.error;
  if (channelResult.error) throw channelResult.error;

  const canonical = asRecord(preferenceResult.data?.nudge_opt_in);
  const channelRows = channelResult.data ?? [];
  const channelValue = (type: DashboardNudgePreferenceType) =>
    channelRows.find((row) => row.nudge_type === type)?.enabled;
  const paymentCanonical = canonical.payment_due === true;
  const debtCanonical = canonical.debt_due === true;

  return {
    whatsapp_opt_in: preferenceResult.data?.whatsapp_opt_in === true,
    payment_due:
      paymentCanonical && channelValue("payment_due") !== false,
    debt_due: debtCanonical && channelValue("debt_due") !== false,
    quiet_hours_start:
      preferenceResult.data?.quiet_hours_start?.slice(0, 5) ?? "22:00",
    quiet_hours_end:
      preferenceResult.data?.quiet_hours_end?.slice(0, 5) ?? "08:00",
    configured: channelRows.length > 0,
  };
}

export async function setWhatsAppNudgeConsent(
  client: Client,
  userId: string,
  input: WhatsAppNudgeConsentInput,
  traceId: string,
): Promise<WhatsAppNudgeConsentView> {
  const { error } = await client.rpc("set_whatsapp_nudge_consent", {
    p_user_id: userId,
    p_enabled: input.whatsapp_opt_in,
    p_payment_due: input.payment_due,
    p_debt_due: input.debt_due,
    p_quiet_hours_start: input.quiet_hours_start,
    p_quiet_hours_end: input.quiet_hours_end,
    p_trace_id: traceId,
  });

  if (error) {
    logger.error("nudges.whatsapp_consent_update_failed", {
      error,
      user_id: userId,
      trace_id: traceId,
    });
    throw error;
  }

  return getWhatsAppNudgeConsent(client, userId);
}

export async function evaluateDashboardNudges(
  client: Client,
  userId: string,
  options: {
    now?: Date;
    horizonDays?: number;
    traceId?: string;
  } = {}
): Promise<DashboardNudgeEvaluationResult> {
  const now = options.now ?? new Date();
  const horizonDays = options.horizonDays ?? 3;
  const [{ rules }, debtInstallments, preferences, lifecycle] = await Promise.all([
    listRecurringDashboard(client, userId, ["active"]),
    listDebtInstallmentCommitments(client, userId, horizonDays, now),
    listDashboardNudgePreferences(client, userId, { now }),
    loadLifecycleNudgeSignals(client, userId, now),
  ]);
  const recurringDrafts = isDashboardNudgePreferenceEnabled(
    preferences,
    "payment_due"
  )
    ? buildRecurringDashboardNudgeDrafts({
        rules,
        now,
        horizonDays,
      })
    : [];
  const debtDrafts = isDashboardNudgePreferenceEnabled(preferences, "debt_due")
    ? buildDebtDashboardNudgeDrafts({
        installments: debtInstallments.map((installment) => ({
          id: installment.installment_id,
          debt_id: installment.debt_id,
          debt_name: installment.debt_name,
          installment_number: installment.installment_number,
          amount: installment.amount,
          currency: installment.currency,
          direction: installment.direction,
          due_date: installment.due_at,
        })),
        now,
        horizonDays,
      })
    : [];
  const lifecycleDrafts = buildLifecycleNudgeDrafts({
    signals: lifecycle.signals,
    now,
    timezone: lifecycle.timezone,
  });
  const drafts = [...recurringDrafts, ...debtDrafts, ...lifecycleDrafts].sort(
    compareNudgeDrafts,
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const candidates: NudgeCandidate[] = [];

  for (const draft of drafts) {
    const result = await upsertDashboardNudge(client, userId, draft, {
      traceId: options.traceId,
      now,
    });

    if (result.action === "inserted") inserted += 1;
    if (result.action === "updated") updated += 1;
    if (result.action === "skipped") skipped += 1;
    if (result.candidate) candidates.push(result.candidate);
  }

  const expired = await expireStaleDashboardNudges(
    client,
    userId,
    new Set(drafts.map(nudgeDraftKey)),
    {
      traceId: options.traceId,
      now,
    }
  );

  return {
    generated: drafts.length,
    inserted,
    updated,
    skipped,
    expired,
    candidates,
  };
}

export async function listDashboardNudgePreferences(
  client: Client,
  userId: string,
  options: { now?: Date } = {}
): Promise<DashboardNudgePreferenceView[]> {
  const { data, error } = await client
    .from("nudge_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("channel", "dashboard")
    .in("nudge_type", [...DASHBOARD_NUDGE_PREFERENCE_TYPES]);

  if (error) {
    logger.error("nudges.preferences_list_failed", {
      error,
      user_id: userId,
    });
    throw error;
  }

  const now = options.now ?? new Date();
  const rows = (data ?? []) as NudgePreference[];
  return resolveDashboardNudgePreferences(rows, now);
}

export function resolveDashboardNudgePreferences(
  rows: NudgePreference[],
  now: Date
): DashboardNudgePreferenceView[] {
  return DASHBOARD_NUDGE_PREFERENCE_TYPES.map((nudgeType) => {
    const row = rows.find((candidate) => candidate.nudge_type === nudgeType);
    const paused =
      row?.paused_until != null &&
      new Date(row.paused_until).getTime() > now.getTime();

    return {
      nudge_type: nudgeType,
      enabled: row ? row.enabled && !paused : true,
      configured: Boolean(row),
      channel: "dashboard",
      paused_until: row?.paused_until ?? null,
    };
  });
}

export async function setDashboardNudgePreference(
  client: Client,
  userId: string,
  nudgeType: DashboardNudgePreferenceType,
  enabled: boolean
): Promise<NudgePreference> {
  const { data, error } = await client.rpc("set_dashboard_nudge_preference", {
    p_user_id: userId,
    p_nudge_type: nudgeType,
    p_enabled: enabled,
  });

  if (error || !data) {
    logger.error("nudges.preference_update_failed", {
      error,
      user_id: userId,
      nudge_type: nudgeType,
    });
    throw error ?? new Error("No se pudo guardar la preferencia de avisos.");
  }

  return data as unknown as NudgePreference;
}

export async function listDashboardNudges(
  client: Client,
  userId: string,
  options: { limit?: number } = {}
): Promise<NudgeCandidate[]> {
  const { data, error } = await client
    .from("nudge_candidates")
    .select("*")
    .eq("user_id", userId)
    .neq("source_entity_type", "insight_candidate")
    .in("status", activeDashboardNudgeStatuses)
    .order("priority", { ascending: false })
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 5);

  if (error) {
    logger.error("nudges.list_dashboard_failed", { error, user_id: userId });
    throw error;
  }

  return (data ?? []) as NudgeCandidate[];
}

export async function syncInsightNudgeCandidate(
  client: Client,
  insight: InsightCandidate,
  options: {
    recommendedChannel: "dashboard" | "whatsapp";
    displayRecommendation: "now" | "dashboard_only" | "hold";
    traceId: string;
    now?: Date;
  },
): Promise<NudgeCandidate | null> {
  const now = options.now ?? new Date();
  const proactiveAnomaly =
    insight.type === "anomaly" &&
    insight.rank_score >= 85 &&
    insight.quality_score >= 80 &&
    insight.risk_level !== "sensitive";
  const shouldOfferWhatsApp =
    insight.status === "narrated" &&
    options.displayRecommendation === "now" &&
    (options.recommendedChannel === "whatsapp" || proactiveAnomaly) &&
    insight.confidence >= 0.75 &&
    insight.quality_score >= 70 &&
    insight.rank_score >= 70;
  const existing = await findInsightNudge(client, insight.user_id, insight.id);

  if (!shouldOfferWhatsApp) {
    if (existing && activeDashboardNudgeStatuses.includes(existing.status)) {
      await client
        .from("nudge_candidates")
        .update({
          status: "expired",
          metadata: toJson({
            ...asRecord(existing.metadata),
            expired_at: now.toISOString(),
            expired_reason: "insight_not_selected_for_proactive_delivery",
            trace_id: options.traceId,
          }),
        })
        .eq("id", existing.id)
        .eq("user_id", insight.user_id);
    }
    return null;
  }

  if (
    existing &&
    ["sent", "delivered", "responded", "acted", "dismissed"].includes(
      existing.status,
    )
  ) {
    return existing;
  }

  const type =
    insight.type === "anomaly"
      ? "anomaly_alert"
      : insight.type === "progress" || insight.type === "learning_progress"
        ? "progress_positive"
        : "insight_prompt";
  const metadata = toJson({
    ...(existing ? asRecord(existing.metadata) : {}),
    nudge_version: "insight-proactive-v1",
    source: "insight_candidate",
    insight_candidate_id: insight.id,
    insight_type: insight.type,
    title: insight.title,
    body: insight.body,
    evidence: insight.evidence_text,
    target_view: "insights",
    action_label: "Ver descubrimiento",
    recommended_channel: options.recommendedChannel,
    display_recommendation: options.displayRecommendation,
    last_evaluated_at: now.toISOString(),
    trace_id: options.traceId,
  });

  if (existing) {
    const { data, error } = await client
      .from("nudge_candidates")
      .update({
        type,
        priority: insight.rank_score,
        risk_level: insight.risk_level,
        status: "approved",
        scheduled_for: now.toISOString(),
        metadata,
      })
      .eq("id", existing.id)
      .eq("user_id", insight.user_id)
      .select("*")
      .single();
    if (error) throw error;
    return data as NudgeCandidate;
  }

  const { data, error } = await client
    .from("nudge_candidates")
    .insert({
      user_id: insight.user_id,
      type,
      source_entity_type: "insight_candidate",
      source_entity_id: insight.id,
      priority: insight.rank_score,
      risk_level: insight.risk_level,
      status: "approved",
      scheduled_for: now.toISOString(),
      metadata,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as NudgeCandidate;
}

export async function getDashboardNudgeById(
  client: Client,
  userId: string,
  nudgeId: string
): Promise<NudgeCandidate | null> {
  const { data, error } = await client
    .from("nudge_candidates")
    .select("*")
    .eq("user_id", userId)
    .eq("id", nudgeId)
    .maybeSingle();

  if (error) {
    logger.error("nudges.get_dashboard_failed", {
      error,
      user_id: userId,
      nudge_candidate_id: nudgeId,
    });
    throw error;
  }

  return (data as NudgeCandidate | null) ?? null;
}

export async function dismissDashboardNudge(
  client: Client,
  userId: string,
  nudgeId: string,
  traceId: string
): Promise<NudgeCandidate | null> {
  const existing = await getDashboardNudgeById(client, userId, nudgeId);
  if (!existing) return null;
  if (existing.status === "dismissed") return existing;

  const { data, error } = await client
    .from("nudge_candidates")
    .update({
      status: "dismissed",
      metadata: toJson({
        ...asRecord(existing.metadata),
        dismissed_at: new Date().toISOString(),
        dismissed_from: "dashboard",
        trace_id: traceId,
      }),
    })
    .eq("user_id", userId)
    .eq("id", nudgeId)
    .select()
    .single();

  if (error) {
    logger.error("nudges.dismiss_dashboard_failed", {
      error,
      user_id: userId,
      nudge_candidate_id: nudgeId,
    });
    throw error;
  }

  return data as NudgeCandidate;
}

async function upsertDashboardNudge(
  client: Client,
  userId: string,
  draft: DashboardNudgeDraft,
  options: { traceId?: string; now: Date }
): Promise<{
  action: "inserted" | "updated" | "skipped";
  candidate: NudgeCandidate | null;
}> {
  const existing = await findNudgeBySource(client, userId, draft);
  if (
    existing &&
    ["sent", "delivered", "responded", "acted", "dismissed"].includes(
      existing.status,
    )
  ) {
    return { action: "skipped", candidate: null };
  }

  const metadata = toJson({
    ...(existing ? asRecord(existing.metadata) : {}),
    ...draft.metadata,
    last_evaluated_at: options.now.toISOString(),
    ...(options.traceId ? { trace_id: options.traceId } : {}),
  });

  if (existing) {
    const { data, error } = await client
      .from("nudge_candidates")
      .update({
        priority: draft.priority,
        risk_level: draft.riskLevel,
        status: "approved",
        scheduled_for: draft.scheduledFor,
        metadata,
      })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("nudges.update_dashboard_failed", {
        error,
        user_id: userId,
        nudge_candidate_id: existing.id,
      });
      throw error;
    }

    return { action: "updated", candidate: data as NudgeCandidate };
  }

  const { data, error } = await client
    .from("nudge_candidates")
    .insert({
      user_id: userId,
      type: draft.type,
      source_entity_type: draft.sourceEntityType,
      source_entity_id: draft.sourceEntityId,
      priority: draft.priority,
      risk_level: draft.riskLevel,
      status: "approved",
      scheduled_for: draft.scheduledFor,
      metadata: toJson({
        ...draft.metadata,
        first_evaluated_at: options.now.toISOString(),
        last_evaluated_at: options.now.toISOString(),
        ...(options.traceId ? { trace_id: options.traceId } : {}),
      }),
    })
    .select()
    .single();

  if (error) {
    logger.error("nudges.insert_dashboard_failed", {
      error,
      user_id: userId,
      source_entity_id: draft.sourceEntityId,
    });
    throw error;
  }

  return { action: "inserted", candidate: data as NudgeCandidate };
}

async function findNudgeBySource(
  client: Client,
  userId: string,
  draft: DashboardNudgeDraft
): Promise<NudgeCandidate | null> {
  const { data, error } = await client
    .from("nudge_candidates")
    .select("*")
    .eq("user_id", userId)
    .eq("type", draft.type)
    .eq("source_entity_type", draft.sourceEntityType)
    .eq("source_entity_id", draft.sourceEntityId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    logger.error("nudges.find_dashboard_failed", {
      error,
      user_id: userId,
      source_entity_id: draft.sourceEntityId,
    });
    throw error;
  }

  return ((data ?? [])[0] as NudgeCandidate | undefined) ?? null;
}

async function findInsightNudge(
  client: Client,
  userId: string,
  insightId: string,
): Promise<NudgeCandidate | null> {
  const { data, error } = await client
    .from("nudge_candidates")
    .select("*")
    .eq("user_id", userId)
    .eq("source_entity_type", "insight_candidate")
    .eq("source_entity_id", insightId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as NudgeCandidate | undefined) ?? null;
}

async function expireStaleDashboardNudges(
  client: Client,
  userId: string,
  activeDraftKeys: Set<string>,
  options: { traceId?: string; now: Date }
): Promise<number> {
  const { data, error } = await client
    .from("nudge_candidates")
    .select("*")
    .eq("user_id", userId)
    .in("source_entity_type", [
      "recurring_occurrence",
      "debt_installment",
      "pending_batch",
      "lifecycle_daily",
      "lifecycle_weekly",
      "lifecycle_inactivity",
    ])
    .in("status", activeDashboardNudgeStatuses)
    .limit(200);

  if (error) {
    logger.error("nudges.list_stale_dashboard_failed", { error, user_id: userId });
    throw error;
  }

  let expired = 0;
  for (const candidate of ((data ?? []) as NudgeCandidate[])) {
    if (activeDraftKeys.has(nudgeCandidateKey(candidate))) continue;

    const { error: updateError } = await client
      .from("nudge_candidates")
      .update({
        status: "expired",
        metadata: toJson({
          ...asRecord(candidate.metadata),
          expired_at: options.now.toISOString(),
          expired_reason: "source_no_longer_open",
          ...(options.traceId ? { trace_id: options.traceId } : {}),
        }),
      })
      .eq("id", candidate.id)
      .eq("user_id", userId);

    if (updateError) {
      logger.error("nudges.expire_dashboard_failed", {
        error: updateError,
        user_id: userId,
        nudge_candidate_id: candidate.id,
      });
      throw updateError;
    }

    expired += 1;
  }

  return expired;
}

function isDashboardNudgePreferenceEnabled(
  preferences: DashboardNudgePreferenceView[],
  nudgeType: DashboardNudgePreferenceType
): boolean {
  return (
    preferences.find((preference) => preference.nudge_type === nudgeType)
      ?.enabled ?? true
  );
}

function nudgeDraftKey(draft: DashboardNudgeDraft): string {
  return `${draft.type}:${draft.sourceEntityType}:${draft.sourceEntityId}`;
}

function nudgeCandidateKey(candidate: NudgeCandidate): string {
  return `${candidate.type}:${candidate.source_entity_type}:${candidate.source_entity_id}`;
}

function compareNudgeDrafts(
  left: DashboardNudgeDraft,
  right: DashboardNudgeDraft
): number {
  if (right.priority !== left.priority) return right.priority - left.priority;
  return left.scheduledFor.localeCompare(right.scheduledFor);
}

async function loadLifecycleNudgeSignals(
  client: Client,
  userId: string,
  now: Date,
): Promise<{ signals: LifecycleNudgeSignals; timezone: string }> {
  const since = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const [
    profileResult,
    movementsResult,
    latestMovementResult,
    pendingResult,
    windowsResult,
  ] = await Promise.all([
    client.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    client
      .from("movements")
      .select("occurred_at,created_at")
      .eq("user_id", userId)
      .in("status", ["confirmed", "corrected"])
      .is("deleted_at", null)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(500),
    client
      .from("movements")
      .select("created_at")
      .eq("user_id", userId)
      .in("status", ["confirmed", "corrected"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("pending_items")
      .select("id,source,created_at")
      .eq("user_id", userId)
      .in("status", ["pending", "sent_for_confirmation", "user_edited"])
      .order("created_at", { ascending: true })
      .limit(200),
    client
      .from("whatsapp_window_states")
      .select("last_user_message_at")
      .eq("user_id", userId)
      .not("last_user_message_at", "is", null)
      .order("last_user_message_at", { ascending: false })
      .limit(1),
  ]);

  for (const result of [
    profileResult,
    movementsResult,
    latestMovementResult,
    pendingResult,
    windowsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const timezone = profileResult.data?.timezone ?? "America/Lima";
  const today = localIsoDate(now, timezone);
  const movements = movementsResult.data ?? [];
  const last7DaysCutoff = now.getTime() - 7 * 86_400_000;
  const movementsLast7Days = movements.filter(
    (movement) => new Date(movement.occurred_at).getTime() >= last7DaysCutoff,
  );
  const pending = pendingResult.data ?? [];
  const lastUserMessageAt = windowsResult.data?.[0]?.last_user_message_at ?? null;
  const periodKey = isoWeekKey(now, timezone);
  const lastActivityAt = latestIsoTimestamp(
    latestMovementResult.data?.created_at ?? null,
    lastUserMessageAt,
  );

  return {
    timezone,
    signals: {
      userId,
      movementCountToday: movementsLast7Days.filter(
        (movement) =>
          localIsoDate(new Date(movement.occurred_at), timezone) === today,
      ).length,
      movementCountLast7Days: movementsLast7Days.length,
      pendingCount: pending.length,
      emailPendingCount: pending.filter((item) => item.source === "email_pending")
        .length,
      backfillPendingCount: pending.filter(
        (item) => item.source === "backfill_pending",
      ).length,
      oldestPendingId: pending[0]?.id ?? null,
      lastActivityAt,
      lastUserMessageAt,
      sourceIds: {
        daily: stableUuid(`${userId}:lifecycle_daily:${today}`),
        weekly: stableUuid(`${userId}:lifecycle_weekly:${periodKey}`),
        inactivity: stableUuid(
          `${userId}:lifecycle_inactivity:${lastActivityAt?.slice(0, 10) ?? "none"}`,
        ),
      },
    },
  };
}

function stableUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16] ?? "0", 16) % 4];
  const compact = hex.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function localIsoDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function isoWeekKey(date: Date, timezone: string): string {
  const localDate = localIsoDate(date, timezone);
  const value = new Date(`${localDate}T00:00:00.000Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function latestIsoTimestamp(...values: Array<string | null>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => right.time - left.time)[0]?.value ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toJson(value: Record<string, unknown>): Json {
  return value as Json;
}
