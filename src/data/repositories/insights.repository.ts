import type { SupabaseClient } from "@supabase/supabase-js";
import { InsightExperienceAgent } from "@/agents/insight-experience-agent";
import type { InsightExperienceOutput } from "@/agents/insight-experience-agent";
import { InsightNarratorAgent } from "@/agents/insight-narrator-agent";
import type { InsightNarratorOutput } from "@/agents/insight-narrator-agent";
import {
  buildAdvancedInsightDrafts,
  type InsightDraft,
} from "@/core/insights/insight-engine";
import {
  getActiveAccounts,
  getActiveBoxes,
} from "@/data/repositories/accounts.repository";
import {
  listDebtInstallmentCommitments,
  listDebts,
} from "@/data/repositories/debts.repository";
import {
  listRecurringDashboard,
  listUpcomingCommitments,
} from "@/data/repositories/recurring.repository";
import type { Database, Json } from "@/data/supabase/types";
import { syncInsightNudgeCandidate } from "@/data/repositories/nudges.repository";
import type {
  InsightCandidate,
  InsightStatus,
  DebtPayment,
  Movement,
  MovementTag,
  Profile,
  Tag,
  UserPreferences,
} from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

const recalculableStatuses: InsightStatus[] = [
  "candidate",
  "validated",
  "ranked",
  "narrated",
  "displayed",
  "sent",
];

const dashboardVisibleStatuses: InsightStatus[] = [
  "narrated",
  "displayed",
  "sent",
];

export type InsightEvaluationResult = {
  generated: number;
  inserted: number;
  updated: number;
  skipped: number;
  expired: number;
  outdated: number;
  candidates: InsightCandidate[];
};

export async function evaluateAdvancedInsights(
  client: Client,
  userId: string,
  options: {
    now?: Date;
    traceId?: string;
    experienceAgent?: InsightExperienceAgent;
    narratorAgent?: InsightNarratorAgent;
  } = {},
): Promise<InsightEvaluationResult> {
  const now = options.now ?? new Date();
  const traceId = options.traceId ?? crypto.randomUUID();
  const [
    movements,
    profile,
    preferences,
    existing,
    debts,
    debtPayments,
    recurringDashboard,
    accounts,
    boxes,
    recurringCommitments,
    debtCommitments,
    activePendingCount,
    feedbackHistory,
  ] = await Promise.all([
    listInsightSourceMovements(client, userId, now),
    getProfile(client, userId),
    getPreferences(client, userId),
    listRecalculableInsights(client, userId),
    listDebts(client, userId),
    listInsightDebtPayments(client, userId),
    listRecurringDashboard(client, userId),
    getActiveAccounts(client, userId),
    getActiveBoxes(client, userId),
    listUpcomingCommitments(client, userId, 31),
    listDebtInstallmentCommitments(client, userId, 31, now),
    countActiveInsightPendingItems(client, userId),
    listRecentInsightFeedback(client, userId),
  ]);
  const { movementTags, tags } = await listInsightContextTags(
    client,
    movements.map((movement) => movement.id),
  );
  const drafts = buildAdvancedInsightDrafts({
    movements,
    debts,
    debtPayments,
    recurringCandidates: recurringDashboard.candidates,
    accounts,
    boxes,
    commitments: [...recurringCommitments, ...debtCommitments],
    movementTags,
    tags,
    activePendingCount,
    now,
    timezone: profile?.timezone ?? "America/Lima",
  });
  const experienceAgent = options.experienceAgent ?? new InsightExperienceAgent();
  const narratorAgent = options.narratorAgent ?? new InsightNarratorAgent();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let expired = 0;
  const candidates: InsightCandidate[] = [];
  const activeExisting: InsightCandidate[] = [];
  const activeDraftKeys = new Set<string>();

  for (const candidate of existing) {
    if (isInsightPastExpiry(candidate, now)) {
      await markInsightTerminal(client, candidate, "expired", now, traceId, {
        reason: "temporal_expiration",
      });
      expired += 1;
    } else {
      activeExisting.push(candidate);
    }
  }

  for (const [index, originalDraft] of drafts.entries()) {
    const relevantFeedback = feedbackHistory.filter(
      (candidate) => candidate.type === originalDraft.type,
    );
    if (shouldSuppressInsightDraft(originalDraft, relevantFeedback, now)) {
      skipped += 1;
      continue;
    }
    const draft = applyInsightFeedbackPenalty(originalDraft, relevantFeedback, now);
    activeDraftKeys.add(insightDraftKey(draft));
    const matching = activeExisting
      .filter(
        (candidate) =>
          candidate.type === draft.type && candidate.fingerprint === draft.fingerprint,
      )
      .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
    const sameFacts = matching ? hasSameSourceFacts(matching, draft) : false;

    if (matching && sameFacts && ["displayed", "sent"].includes(matching.status)) {
      skipped += 1;
      candidates.push(matching);
      continue;
    }

    if (matching && !sameFacts && ["displayed", "sent"].includes(matching.status)) {
      await markInsightTerminal(client, matching, "outdated", now, traceId, {
        reason: "source_facts_changed",
      });
    }

    const experience = await resolveExperience({
      agent: experienceAgent,
      draft,
      profile,
      preferences,
      traceId,
      selective: index === 0 || draft.riskLevel === "sensitive" || draft.rankScore >= 70,
      recentFeedback: relevantFeedback.map(
        (candidate) => `${candidate.type}:${candidate.status}`,
      ),
    });
    const held = experience.display_recommendation === "hold";
    const narration = held
      ? deterministicNarration(draft)
      : await resolveNarration({
          agent: narratorAgent,
          draft,
          experience,
          preferences,
          traceId,
        });
    const status: InsightStatus = held ? "validated" : "narrated";
    const canUpdateMatching =
      matching != null && !["displayed", "sent", "outdated", "expired"].includes(matching.status);

    const payload = insightPayload({
      userId,
      draft,
      narration,
      experience,
      status,
      now,
      traceId,
    });
    const saved = canUpdateMatching
      ? await updateInsight(client, matching.id, userId, payload)
      : await insertInsight(client, payload);
    await syncInsightNudgeCandidate(client, saved, {
      recommendedChannel: experience.recommended_channel,
      displayRecommendation: experience.display_recommendation,
      traceId,
      now,
    });
    if (canUpdateMatching) updated += 1;
    else inserted += 1;
    candidates.push(saved);
  }

  let outdated = 0;
  for (const candidate of activeExisting) {
    if (activeDraftKeys.has(insightCandidateKey(candidate))) continue;
    if (["outdated", "expired"].includes(candidate.status)) continue;
    const terminal = ["displayed", "sent"].includes(candidate.status)
      ? "outdated"
      : "expired";
    await markInsightTerminal(client, candidate, terminal, now, traceId, {
      reason: "signal_no_longer_valid",
    });
    if (terminal === "outdated") outdated += 1;
    else expired += 1;
  }

  return {
    generated: drafts.length,
    inserted,
    updated,
    skipped,
    expired,
    outdated,
    candidates: candidates.sort(compareInsights),
  };
}

export async function listDashboardInsights(
  client: Client,
  userId: string,
  options: { limit?: number; now?: Date } = {},
): Promise<InsightCandidate[]> {
  const nowIso = (options.now ?? new Date()).toISOString();
  const { data, error } = await client
    .from("insight_candidates")
    .select("*")
    .eq("user_id", userId)
    .in("status", dashboardVisibleStatuses)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("rank_score", { ascending: false })
    .order("quality_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 10);

  if (error) {
    logger.error("insights.list_dashboard_failed", { error, user_id: userId });
    throw error;
  }
  return (data ?? []) as unknown as InsightCandidate[];
}

export async function recordDashboardInsightsDisplayed(
  client: Client,
  userId: string,
  insightIds: string[],
  options: { now?: Date; traceId?: string } = {},
): Promise<void> {
  const uniqueIds = [...new Set(insightIds)].filter(Boolean);
  if (uniqueIds.length === 0) return;

  const now = options.now ?? new Date();
  const displayedAt = now.toISOString();
  const { data: existingDeliveries, error: deliveriesError } = await client
    .from("insight_deliveries")
    .select("insight_candidate_id")
    .eq("user_id", userId)
    .eq("channel", "dashboard")
    .in("insight_candidate_id", uniqueIds);
  if (deliveriesError) throw deliveriesError;

  const alreadyDelivered = new Set(
    (existingDeliveries ?? [])
      .map((row) => row.insight_candidate_id)
      .filter((id): id is string => Boolean(id)),
  );
  const newDeliveryIds = uniqueIds.filter((id) => !alreadyDelivered.has(id));

  if (newDeliveryIds.length > 0) {
    const { error } = await client.from("insight_deliveries").insert(
      newDeliveryIds.map((insightId) => ({
        user_id: userId,
        insight_candidate_id: insightId,
        channel: "dashboard",
        status: "delivered",
        delivered_at: displayedAt,
        metadata: toJson({
          surface: "home",
          ...(options.traceId ? { trace_id: options.traceId } : {}),
        }),
      })),
    );
    if (error) throw error;
  }

  const { error: candidateError } = await client
    .from("insight_candidates")
    .update({
      status: "displayed",
      displayed_at: displayedAt,
    })
    .eq("user_id", userId)
    .eq("status", "narrated")
    .in("id", uniqueIds);
  if (candidateError) throw candidateError;
}

export type InsightListOptions = {
  limit?: number;
  status?: InsightStatus;
  type?: InsightCandidate["type"];
  now?: Date;
};

export type InsightDetail = {
  insight: InsightCandidate;
  deliveries: Array<{
    channel: string;
    status: string;
    delivered_at: string | null;
    seen_at: string | null;
    created_at: string;
  }>;
};

export async function listInsights(
  client: Client,
  userId: string,
  options: InsightListOptions = {},
): Promise<InsightCandidate[]> {
  let query = client
    .from("insight_candidates")
    .select("*")
    .eq("user_id", userId);

  if (options.status) query = query.eq("status", options.status);
  else query = query.in("status", [...dashboardVisibleStatuses, "outdated"]);
  if (options.type) query = query.eq("type", options.type);
  if (!options.status || !["outdated", "expired"].includes(options.status)) {
    query = query.or(
      `expires_at.is.null,expires_at.gt.${(options.now ?? new Date()).toISOString()}`,
    );
  }

  const { data, error } = await query
    .order("rank_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 20, 1), 100));
  if (error) throw error;
  return (data ?? []) as unknown as InsightCandidate[];
}

export async function getInsightById(
  client: Client,
  userId: string,
  insightId: string,
): Promise<InsightDetail | null> {
  const { data: insight, error } = await client
    .from("insight_candidates")
    .select("*")
    .eq("user_id", userId)
    .eq("id", insightId)
    .maybeSingle();
  if (error) throw error;
  if (!insight) return null;

  const { data: deliveries, error: deliveryError } = await client
    .from("insight_deliveries")
    .select("channel,status,delivered_at,seen_at,created_at")
    .eq("user_id", userId)
    .eq("insight_candidate_id", insightId)
    .order("created_at", { ascending: false });
  if (deliveryError) throw deliveryError;

  return {
    insight: insight as unknown as InsightCandidate,
    deliveries: deliveries ?? [],
  };
}

export async function recordInsightSeen(
  client: Client,
  userId: string,
  insightId: string,
  options: { now?: Date; traceId?: string } = {},
): Promise<InsightCandidate | null> {
  const existing = await getInsightCandidate(client, userId, insightId);
  if (!existing) return null;

  const nowIso = (options.now ?? new Date()).toISOString();
  await upsertDashboardInsightDelivery(client, existing, {
    status: "seen",
    deliveredAt: nowIso,
    seenAt: nowIso,
    traceId: options.traceId,
  });

  if (existing.status !== "narrated") return existing;
  return updateInsightLifecycle(client, existing, "displayed", {
    displayed_at: nowIso,
    metadata: toJson({
      ...asRecord(existing.metadata),
      last_seen_at: nowIso,
      ...(options.traceId ? { trace_id: options.traceId } : {}),
    }),
  });
}

export async function dismissInsight(
  client: Client,
  userId: string,
  insightId: string,
  options: { now?: Date; traceId?: string; reason?: string } = {},
): Promise<InsightCandidate | null> {
  return recordInsightTerminalFeedback(client, userId, insightId, "dismissed", {
    ...options,
    feedback: { reason: options.reason ?? null },
  });
}

export async function recordInsightAction(
  client: Client,
  userId: string,
  insightId: string,
  options: {
    now?: Date;
    traceId?: string;
    actionKey?: string;
    actionMetadata?: Record<string, unknown>;
  } = {},
): Promise<InsightCandidate | null> {
  return recordInsightTerminalFeedback(client, userId, insightId, "acted", {
    now: options.now,
    traceId: options.traceId,
    feedback: {
      action_key: options.actionKey ?? null,
      action_metadata: options.actionMetadata ?? {},
    },
  });
}

export async function getInsightEvidence(
  client: Client,
  userId: string,
  insightId: string,
): Promise<Record<string, unknown> | null> {
  const insight = await getInsightCandidate(client, userId, insightId);
  if (!insight) return null;
  const relatedMovements = await listInsightEvidenceMovements(
    client,
    userId,
    insight.source_entity_ids,
  );
  return {
    insight_id: insight.id,
    status: insight.status,
    period: { start: insight.period_start, end: insight.period_end },
    evidence_text: insight.evidence_text,
    evidence: insight.evidence,
    source_facts: insight.source_facts,
    source_entity_ids: insight.source_entity_ids,
    confidence: insight.confidence,
    action: insight.action,
    methodology: asRecord(insight.metadata).methodology ?? null,
    related_movements: relatedMovements,
  };
}

async function listInsightEvidenceMovements(
  client: Client,
  userId: string,
  sourceEntityIds: string[],
): Promise<
  Array<
    Pick<
      Movement,
      | "id"
      | "type"
      | "amount"
      | "currency"
      | "occurred_at"
      | "description"
      | "merchant"
      | "category_id"
    >
  >
> {
  const movementIds = [...new Set(sourceEntityIds)].filter(isUuid);
  if (movementIds.length === 0) return [];

  const rows: Array<
    Pick<
      Movement,
      | "id"
      | "type"
      | "amount"
      | "currency"
      | "occurred_at"
      | "description"
      | "merchant"
      | "category_id"
    >
  > = [];

  for (const ids of chunks(movementIds, 200)) {
    const { data, error } = await client
      .from("movements")
      .select(
        "id,type,amount,currency,occurred_at,description,merchant,category_id",
      )
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .is("deleted_at", null)
      .in("id", ids)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as typeof rows));
  }

  return rows.sort((left, right) =>
    right.occurred_at.localeCompare(left.occurred_at),
  );
}

export function isNarrationFactSafe(
  narration: Pick<InsightNarratorOutput, "title" | "body" | "evidence_text" | "preserved_fact_keys">,
  draft: InsightDraft,
): boolean {
  const factKeys = new Set(Object.keys(draft.sourceFacts));
  if (narration.preserved_fact_keys.some((key) => !factKeys.has(key))) return false;

  const allowedText = [
    draft.title,
    draft.body,
    draft.evidenceText,
    JSON.stringify(draft.sourceFacts),
  ].join(" ");
  const allowedNumbers = new Set(extractNumbers(allowedText));
  const narratedNumbers = extractNumbers(
    `${narration.title} ${narration.body} ${narration.evidence_text}`,
  );
  return narratedNumbers.every((number) => allowedNumbers.has(number));
}

async function listInsightSourceMovements(
  client: Client,
  userId: string,
  now: Date,
): Promise<Movement[]> {
  const from = new Date(now.getTime() - 70 * 86_400_000).toISOString();
  const { data, error } = await client
    .from("movements")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .gte("occurred_at", from)
    .lte("occurred_at", now.toISOString())
    .order("occurred_at", { ascending: true })
    .limit(2_000);
  if (error) {
    logger.error("insights.source_movements_failed", { error, user_id: userId });
    throw error;
  }
  return (data ?? []) as Movement[];
}

async function listInsightDebtPayments(
  client: Client,
  userId: string,
): Promise<DebtPayment[]> {
  const { data, error } = await client
    .from("debt_payments")
    .select("*")
    .eq("user_id", userId)
    .order("paid_at", { ascending: true })
    .limit(2_000);
  if (error) {
    logger.error("insights.source_debt_payments_failed", {
      error,
      user_id: userId,
    });
    throw error;
  }
  return (data ?? []) as DebtPayment[];
}

async function countActiveInsightPendingItems(
  client: Client,
  userId: string,
): Promise<number> {
  const { count, error } = await client
    .from("pending_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["pending", "sent_for_confirmation", "user_edited"]);
  if (error) throw error;
  return count ?? 0;
}

async function listInsightContextTags(
  client: Client,
  movementIds: string[],
): Promise<{ movementTags: MovementTag[]; tags: Tag[] }> {
  if (movementIds.length === 0) return { movementTags: [], tags: [] };

  const movementTags: MovementTag[] = [];
  for (const ids of chunks(movementIds, 200)) {
    const { data, error } = await client
      .from("movement_tags")
      .select("*")
      .in("movement_id", ids);
    if (error) throw error;
    movementTags.push(...((data ?? []) as MovementTag[]));
  }

  const tagIds = [...new Set(movementTags.map((assignment) => assignment.tag_id))];
  if (tagIds.length === 0) return { movementTags, tags: [] };

  const tags: Tag[] = [];
  for (const ids of chunks(tagIds, 200)) {
    const { data, error } = await client.from("tags").select("*").in("id", ids);
    if (error) throw error;
    tags.push(...((data ?? []) as Tag[]));
  }
  return { movementTags, tags };
}

async function listRecentInsightFeedback(
  client: Client,
  userId: string,
): Promise<InsightCandidate[]> {
  const { data, error } = await client
    .from("insight_candidates")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["dismissed", "acted", "ignored"])
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as InsightCandidate[];
}

async function getProfile(client: Client, userId: string): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

async function getPreferences(
  client: Client,
  userId: string,
): Promise<UserPreferences | null> {
  const { data, error } = await client
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as UserPreferences | null) ?? null;
}

async function listRecalculableInsights(
  client: Client,
  userId: string,
): Promise<InsightCandidate[]> {
  const { data, error } = await client
    .from("insight_candidates")
    .select("*")
    .eq("user_id", userId)
    .in("status", recalculableStatuses)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as InsightCandidate[];
}

async function resolveExperience(input: {
  agent: InsightExperienceAgent;
  draft: InsightDraft;
  profile: Profile | null;
  preferences: UserPreferences | null;
  traceId: string;
  selective: boolean;
  recentFeedback: string[];
}): Promise<InsightExperienceOutput> {
  const fallback = deterministicExperience(input.draft);
  if (!input.selective) return fallback;

  try {
    const response = await input.agent.evaluate(
      {
        context_pack_type: "insight_experience_context",
        version: "v1",
        locale: "es-PE",
        candidate: {
          fingerprint: input.draft.fingerprint,
          type: input.draft.type,
          risk_level: input.draft.riskLevel,
          rank_score: input.draft.rankScore,
          quality_score: input.draft.qualityScore,
          confidence: input.draft.confidence,
          safe_facts: input.draft.sourceFacts,
          deterministic_copy: {
            title: input.draft.title,
            body: input.draft.body,
            evidence_text: input.draft.evidenceText,
          },
        },
        user_context: {
          onboarding_status: input.profile?.onboarding_status ?? null,
          tone_style: input.preferences?.tone_style ?? null,
          discreet_mode_enabled:
            input.preferences?.discreet_mode_enabled ?? false,
          recent_feedback: input.recentFeedback,
        },
        candidate_channels: ["dashboard", "whatsapp"],
      },
      input.traceId,
    );
    const factKeys = new Set(Object.keys(input.draft.sourceFacts));
    if (response.output.preserved_fact_keys.some((key) => !factKeys.has(key))) {
      return fallback;
    }
    if (
      input.draft.riskLevel === "sensitive" &&
      response.output.recommended_channel === "whatsapp"
    ) {
      return { ...response.output, recommended_channel: "dashboard" };
    }
    return response.output;
  } catch (error) {
    logger.warn("insights.experience_agent_fallback", {
      error,
      fingerprint: input.draft.fingerprint,
      trace_id: input.traceId,
    });
    return fallback;
  }
}

async function resolveNarration(input: {
  agent: InsightNarratorAgent;
  draft: InsightDraft;
  experience: InsightExperienceOutput;
  preferences: UserPreferences | null;
  traceId: string;
}): Promise<InsightNarratorOutput> {
  const fallback = deterministicNarration(input.draft);
  try {
    const response = await input.agent.narrate(
      {
        context_pack_type: "insight_narrator_context",
        version: "v1",
        locale: "es-PE",
        channel: "dashboard",
        candidate: {
          fingerprint: input.draft.fingerprint,
          type: input.draft.type,
          safe_facts: input.draft.sourceFacts,
          deterministic_copy: {
            title: input.draft.title,
            body: input.draft.body,
            evidence_text: input.draft.evidenceText,
            action_label: actionLabel(input.draft),
          },
        },
        experience: {
          framing_angle: input.experience.framing_angle,
          depth: input.experience.depth,
          tone_style: input.preferences?.tone_style ?? null,
          discreet_mode_enabled:
            input.preferences?.discreet_mode_enabled ?? false,
        },
        limits: { title_max: 120, body_max: 320, evidence_max: 180 },
      },
      input.traceId,
    );
    return isNarrationFactSafe(response.output, input.draft)
      ? response.output
      : fallback;
  } catch (error) {
    logger.warn("insights.narrator_agent_fallback", {
      error,
      fingerprint: input.draft.fingerprint,
      trace_id: input.traceId,
    });
    return fallback;
  }
}

function deterministicExperience(draft: InsightDraft): InsightExperienceOutput {
  return {
    display_recommendation:
      draft.riskLevel === "sensitive" ? "dashboard_only" : "now",
    framing_angle:
      draft.type === "learning_progress"
        ? "learning"
        : draft.type === "progress"
          ? "progress"
          : draft.type === "debt"
            ? "gentle_attention"
            : draft.type === "recurring"
              ? "pattern"
              : draft.type === "free_money" || draft.type === "box_saving"
                ? "clarity"
          : draft.type === "data_quality"
            ? "data_quality"
            : draft.type === "anomaly"
              ? "gentle_attention"
              : draft.type === "temporal_pattern" ||
                  draft.type === "category_concentration"
                ? "pattern"
                : "change",
    depth: draft.rankScore >= 75 ? "actionable" : "brief",
    recommended_channel: "dashboard",
    hold_reason: null,
    confidence: 1,
    preserved_fact_keys: Object.keys(draft.sourceFacts),
  };
}

function deterministicNarration(draft: InsightDraft): InsightNarratorOutput {
  return {
    title: draft.title,
    body: draft.body,
    evidence_text: draft.evidenceText,
    action_label: actionLabel(draft),
    confidence: 1,
    preserved_fact_keys: Object.keys(draft.sourceFacts),
  };
}

function actionLabel(draft: InsightDraft): string | null {
  if (!draft.action) return null;
  if (draft.action.type === "assign_account") return "Asignar cuentas";
  if (draft.action.type === "watch_category") return "Vigilar categoria";
  if (draft.action.type === "view_movements") return "Ver movimientos";
  if (draft.action.type === "review_debt") return "Ver deuda";
  if (draft.action.type === "confirm_recurring") return "Revisar patron";
  if (draft.action.type === "view_money") return "Ver mi dinero";
  return null;
}

function insightPayload(input: {
  userId: string;
  draft: InsightDraft;
  narration: InsightNarratorOutput;
  experience: InsightExperienceOutput;
  status: InsightStatus;
  now: Date;
  traceId: string;
}) {
  return {
    user_id: input.userId,
    type: input.draft.type,
    fingerprint: input.draft.fingerprint,
    status: input.status,
    period_start: input.draft.periodStart,
    period_end: input.draft.periodEnd,
    confidence: input.draft.confidence,
    quality_score: input.draft.qualityScore,
    rank_score: input.draft.rankScore,
    risk_level: input.draft.riskLevel,
    title: input.narration.title,
    body: input.narration.body,
    evidence_text: input.narration.evidence_text,
    evidence: toJson(input.draft.evidence),
    source_facts: toJson(input.draft.sourceFacts),
    source_entity_ids: input.draft.sourceEntityIds,
    action: input.draft.action ? toJson(input.draft.action) : null,
    expires_at: input.draft.expiresAt,
    narrated_at: input.status === "narrated" ? input.now.toISOString() : null,
    metadata: toJson({
      ...input.draft.metadata,
      trace_id: input.traceId,
      experience: input.experience,
      narration_confidence: input.narration.confidence,
      action_label: input.narration.action_label,
      facts_locked: true,
    }),
  };
}

async function insertInsight(
  client: Client,
  payload: ReturnType<typeof insightPayload>,
): Promise<InsightCandidate> {
  const { data, error } = await client
    .from("insight_candidates")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as InsightCandidate;
}

async function updateInsight(
  client: Client,
  insightId: string,
  userId: string,
  payload: ReturnType<typeof insightPayload>,
): Promise<InsightCandidate> {
  const { data, error } = await client
    .from("insight_candidates")
    .update(payload)
    .eq("id", insightId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as InsightCandidate;
}

async function markInsightTerminal(
  client: Client,
  candidate: InsightCandidate,
  status: "outdated" | "expired",
  now: Date,
  traceId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from("insight_candidates")
    .update({
      status,
      outdated_at: status === "outdated" ? now.toISOString() : candidate.outdated_at,
      metadata: toJson({
        ...asRecord(candidate.metadata),
        ...metadata,
        terminal_at: now.toISOString(),
        trace_id: traceId,
      }),
    })
    .eq("id", candidate.id)
    .eq("user_id", candidate.user_id);
  if (error) throw error;
}

async function getInsightCandidate(
  client: Client,
  userId: string,
  insightId: string,
): Promise<InsightCandidate | null> {
  const { data, error } = await client
    .from("insight_candidates")
    .select("*")
    .eq("user_id", userId)
    .eq("id", insightId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as InsightCandidate | null) ?? null;
}

async function updateInsightLifecycle(
  client: Client,
  candidate: InsightCandidate,
  status: InsightStatus,
  changes: Record<string, unknown>,
): Promise<InsightCandidate> {
  const { data, error } = await client
    .from("insight_candidates")
    .update({ status, ...changes })
    .eq("id", candidate.id)
    .eq("user_id", candidate.user_id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as InsightCandidate;
}

async function upsertDashboardInsightDelivery(
  client: Client,
  candidate: InsightCandidate,
  input: {
    status: "delivered" | "seen";
    deliveredAt: string;
    seenAt: string | null;
    traceId?: string;
  },
): Promise<void> {
  const { data: rows, error } = await client
    .from("insight_deliveries")
    .select("id,metadata")
    .eq("user_id", candidate.user_id)
    .eq("insight_candidate_id", candidate.id)
    .eq("channel", "dashboard")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;

  const existing = rows?.[0];
  const metadata = toJson({
    ...(existing ? asRecord(existing.metadata) : {}),
    surface: "insights",
    ...(input.traceId ? { trace_id: input.traceId } : {}),
  });
  if (existing) {
    const { error: updateError } = await client
      .from("insight_deliveries")
      .update({
        status: input.status,
        delivered_at: input.deliveredAt,
        seen_at: input.seenAt,
        metadata,
      })
      .eq("id", existing.id)
      .eq("user_id", candidate.user_id);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await client.from("insight_deliveries").insert({
    user_id: candidate.user_id,
    insight_candidate_id: candidate.id,
    channel: "dashboard",
    status: input.status,
    delivered_at: input.deliveredAt,
    seen_at: input.seenAt,
    metadata,
  });
  if (insertError) throw insertError;
}

async function recordInsightTerminalFeedback(
  client: Client,
  userId: string,
  insightId: string,
  status: "dismissed" | "acted",
  options: {
    now?: Date;
    traceId?: string;
    feedback: Record<string, unknown>;
  },
): Promise<InsightCandidate | null> {
  const existing = await getInsightCandidate(client, userId, insightId);
  if (!existing) return null;
  if (["dismissed", "acted"].includes(existing.status)) return existing;

  const nowIso = (options.now ?? new Date()).toISOString();
  const saved = await updateInsightLifecycle(client, existing, status, {
    metadata: toJson({
      ...asRecord(existing.metadata),
      feedback: options.feedback,
      feedback_at: nowIso,
      feedback_status: status,
      ...(options.traceId ? { trace_id: options.traceId } : {}),
    }),
  });

  const { data: linkedNudges, error: linkedNudgesError } = await client
    .from("nudge_candidates")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("source_entity_type", "insight_candidate")
    .eq("source_entity_id", insightId)
    .in("status", ["candidate", "approved", "deferred", "scheduled"]);
  if (linkedNudgesError) throw linkedNudgesError;

  for (const linkedNudge of linkedNudges ?? []) {
    const { error } = await client
      .from("nudge_candidates")
      .update({
        status: status === "acted" ? "acted" : "dismissed",
        metadata: toJson({
          ...asRecord(linkedNudge.metadata),
          terminal_from: "insight_feedback",
          terminal_at: nowIso,
          insight_candidate_id: insightId,
          ...(options.traceId ? { trace_id: options.traceId } : {}),
        }),
      })
      .eq("id", linkedNudge.id)
      .eq("user_id", userId);
    if (error) throw error;
  }
  return saved;
}

function hasSameSourceFacts(candidate: InsightCandidate, draft: InsightDraft): boolean {
  return stableStringify(candidate.source_facts) === stableStringify(draft.sourceFacts);
}

export function isInsightPastExpiry(
  candidate: Pick<InsightCandidate, "expires_at">,
  now: Date,
): boolean {
  if (!candidate.expires_at) return false;
  const expiresAt = Date.parse(candidate.expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

export function shouldSuppressInsightDraft(
  draft: InsightDraft,
  feedback: InsightCandidate[],
  now: Date,
): boolean {
  const ninetyDaysAgo = now.getTime() - 90 * 86_400_000;
  const sevenDaysAgo = now.getTime() - 7 * 86_400_000;
  const sameFingerprint = feedback.filter(
    (candidate) => candidate.fingerprint === draft.fingerprint,
  );

  for (const candidate of sameFingerprint) {
    const updatedAt = Date.parse(candidate.updated_at);
    if (candidate.status === "acted" && hasSameFeedbackFacts(candidate, draft)) {
      return true;
    }
    if (candidate.status === "dismissed") {
      if (hasSameFeedbackFacts(candidate, draft)) return true;
      if (!hasMaterialSourceChange(candidate.source_facts, draft.sourceFacts)) {
        return true;
      }
    }
    if (
      candidate.status === "ignored" &&
      Number.isFinite(updatedAt) &&
      updatedAt >= sevenDaysAgo &&
      !hasMaterialSourceChange(candidate.source_facts, draft.sourceFacts)
    ) {
      return true;
    }
  }

  const recentDismissals = feedback.filter((candidate) => {
    const updatedAt = Date.parse(candidate.updated_at);
    return (
      candidate.status === "dismissed" &&
      Number.isFinite(updatedAt) &&
      updatedAt >= ninetyDaysAgo
    );
  }).length;
  return recentDismissals >= 2 && draft.rankScore < 90;
}

export function applyInsightFeedbackPenalty(
  draft: InsightDraft,
  feedback: InsightCandidate[],
  now: Date,
): InsightDraft {
  const ninetyDaysAgo = now.getTime() - 90 * 86_400_000;
  const recentDismissals = feedback.filter((candidate) => {
    const updatedAt = Date.parse(candidate.updated_at);
    return (
      candidate.status === "dismissed" &&
      Number.isFinite(updatedAt) &&
      updatedAt >= ninetyDaysAgo
    );
  }).length;
  const penalty = Math.min(30, recentDismissals * 12);
  if (penalty === 0) return draft;

  return {
    ...draft,
    rankScore: Math.max(0, draft.rankScore - penalty),
    metadata: {
      ...draft.metadata,
      feedback_penalty: penalty,
      recent_type_dismissals: recentDismissals,
    },
  };
}

function hasSameFeedbackFacts(candidate: InsightCandidate, draft: InsightDraft): boolean {
  return stableStringify(candidate.source_facts) === stableStringify(draft.sourceFacts);
}

function hasMaterialSourceChange(
  previousValue: unknown,
  nextValue: unknown,
): boolean {
  const previous = asRecord(previousValue);
  const next = asRecord(nextValue);
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);

  for (const key of keys) {
    const left = previous[key];
    const right = next[key];
    if (typeof left === "number" && typeof right === "number") {
      const baseline = Math.max(Math.abs(left), 1);
      if (Math.abs(right - left) / baseline >= 0.2) return true;
      continue;
    }
    if (Array.isArray(left) || Array.isArray(right)) {
      if (stableStringify(left) !== stableStringify(right)) return true;
      continue;
    }
    if (left == null || right == null) {
      if (left !== right) return true;
      continue;
    }
    if (typeof left !== "object" && typeof right !== "object" && left !== right) {
      return true;
    }
  }
  return false;
}

function insightDraftKey(draft: InsightDraft): string {
  return `${draft.type}:${draft.fingerprint}`;
}

function insightCandidateKey(candidate: InsightCandidate): string {
  return `${candidate.type}:${candidate.fingerprint}`;
}

function compareInsights(left: InsightCandidate, right: InsightCandidate): number {
  if (right.rank_score !== left.rank_score) return right.rank_score - left.rank_score;
  return right.quality_score - left.quality_score;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function extractNumbers(value: string): string[] {
  return (value.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((number) =>
    number.replace(",", ".").replace(/\.0+$/, ""),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toJson(value: Record<string, unknown>): Json {
  return value as Json;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
