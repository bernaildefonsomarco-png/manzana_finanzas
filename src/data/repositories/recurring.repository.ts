import type { SupabaseClient } from "@supabase/supabase-js";
import { RecurringSignalAgent } from "@/agents/recurring-signal-agent";
import {
  detectRecurringCandidates,
  normalizeRecurringMerchantKey,
  type RecurringDetectorMovement,
  type RecurringCandidateSuggestion,
} from "@/core/recurring/recurring-detector";
import {
  enrichRecurringCandidate,
  type RecurringAgentEnrichment,
} from "@/core/recurring/recurring-candidate-enricher";
import type { OutboxEventDraft } from "@/core/events/domain-events";
import type { MovementCommitPayload } from "@/core/finance/repository";
import type { Database, Json } from "@/data/supabase/types";
import {
  CATEGORY_IDS,
  RECURRING_AMOUNT_VARIABILITIES,
  RECURRING_FREQUENCIES,
  type CategoryId,
  type Movement,
  type PendingItem,
  type RecurringAmountVariability,
  type RecurringCandidate,
  type RecurringFrequency,
  type RecurringOccurrence,
  type RecurringOccurrenceStatus,
  type RecurringRule,
  type RecurringStatus,
} from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type RecurringRuleWithOccurrences = RecurringRule & {
  occurrences: RecurringOccurrence[];
};

export type RecurringDashboardData = {
  rules: RecurringRuleWithOccurrences[];
  candidates: RecurringCandidate[];
};

export type RecurringPaymentCommitResult = {
  movement: Movement;
  recurring_rule: RecurringRule;
  occurrence: RecurringOccurrence;
  idempotent: boolean;
};

export type UpcomingCommitmentSummary = {
  id: string;
  title: string;
  amount: number;
  currency: "PEN" | "USD";
  due_at: string;
  kind: "recurring" | "debt";
  linked_box_id: string | null;
};

const openOccurrenceStatuses: RecurringOccurrenceStatus[] = [
  "expected",
  "due_soon",
  "pending_confirmation",
  "overdue",
];

const displayOccurrenceStatuses: RecurringOccurrenceStatus[] = [
  ...openOccurrenceStatuses,
  "paid",
];
const openCandidateStatuses = ["candidate", "ready_to_suggest", "suggested"] as const;

export type RecurringCandidateDetectionResult = {
  detected: number;
  ready_to_suggest: number;
  inserted: number;
  updated: number;
  stored: number;
  candidates: RecurringCandidate[];
};

export type RecurringCandidateConfirmOverrides = {
  name?: string;
  expectedAmount?: number;
  amountVariability?: RecurringAmountVariability;
  currency?: "PEN" | "USD";
  frequency?: RecurringFrequency;
  nextExpectedDate?: string;
  categoryId?: CategoryId | null;
  defaultAccountId?: string | null;
};

export type RecurringCandidateRuleDefaults = {
  name: string;
  expectedAmount: number;
  amountVariability: RecurringAmountVariability;
  currency: "PEN" | "USD";
  frequency: RecurringFrequency;
  nextExpectedDate: string;
  dayOfMonth: number | null;
  dateWindowStartDay: number | null;
  dateWindowEndDay: number | null;
  categoryId: CategoryId | null;
  defaultAccountId: string | null;
  merchantPattern: string;
  confidence: number;
};

export type RecurringCandidateConfirmResult = {
  candidate: RecurringCandidate;
  recurring_rule: RecurringRuleWithOccurrences;
};

export async function listRecurringDashboard(
  client: Client,
  userId: string,
  statuses: RecurringStatus[] = ["active", "suggested", "paused"]
): Promise<RecurringDashboardData> {
  const { data: rulesData, error: rulesError } = await client
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", statuses)
    .order("next_expected_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (rulesError) {
    logger.error("recurring.list_rules_failed", { error: rulesError, user_id: userId });
    throw rulesError;
  }

  const rules = (rulesData ?? []) as RecurringRule[];
  const ruleIds = rules.map((rule) => rule.id);
  const [occurrences, candidates] = await Promise.all([
    ruleIds.length > 0
      ? listOpenOccurrencesForRules(client, userId, ruleIds)
      : Promise.resolve([]),
    listSuggestedCandidates(client, userId),
  ]);
  const occurrencesByRule = groupOccurrencesByRule(occurrences);

  return {
    rules: rules.map((rule) => ({
      ...rule,
      occurrences: occurrencesByRule.get(rule.id) ?? [],
    })),
    candidates,
  };
}

export async function createRecurringRule(
  client: Client,
  params: {
    userId: string;
    name: string;
    expectedAmount: number;
    amountVariability: RecurringAmountVariability;
    currency: "PEN" | "USD";
    frequency: RecurringFrequency;
    nextExpectedDate: string;
    dayOfMonth?: number | null;
    dateWindowStartDay?: number | null;
    dateWindowEndDay?: number | null;
    categoryId?: CategoryId | null;
    defaultAccountId?: string | null;
    merchantPattern?: string | null;
    source?: string;
    confidence?: number | null;
    metadata?: Json;
  }
): Promise<RecurringRuleWithOccurrences> {
  const { data: ruleData, error: ruleError } = await client
    .from("recurring_rules")
    .insert({
      user_id: params.userId,
      status: "active",
      name: params.name,
      merchant_pattern: params.merchantPattern ?? null,
      expected_amount: params.expectedAmount,
      amount_variability: params.amountVariability,
      currency: params.currency,
      frequency: params.frequency,
      day_of_month: params.dayOfMonth ?? dateDay(params.nextExpectedDate),
      date_window_start_day: params.dateWindowStartDay ?? null,
      date_window_end_day: params.dateWindowEndDay ?? null,
      next_expected_date: params.nextExpectedDate,
      category_id: params.categoryId ?? null,
      default_account_id: params.defaultAccountId ?? null,
      source: params.source ?? "dashboard_manual",
      confidence: params.confidence ?? 1,
      requires_confirmation_for_payment: true,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (ruleError) {
    logger.error("recurring.create_rule_failed", {
      error: ruleError,
      user_id: params.userId,
    });
    throw ruleError;
  }

  const rule = ruleData as RecurringRule;
  const occurrence = await ensureOccurrence(client, {
    userId: params.userId,
    recurringRuleId: rule.id,
    expectedDate: params.nextExpectedDate,
    expectedAmount: params.expectedAmount,
    metadata: {
      created_from: "dashboard_recurring_create",
    },
  });

  return {
    ...rule,
    occurrences: [occurrence],
  };
}

export async function getRecurringRuleById(
  client: Client,
  userId: string,
  ruleId: string
): Promise<RecurringRuleWithOccurrences | null> {
  const { data, error } = await client
    .from("recurring_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logger.error("recurring.get_rule_failed", {
      error,
      user_id: userId,
      recurring_rule_id: ruleId,
    });
    throw error;
  }

  if (!data) return null;

  const occurrences = await listOpenOccurrencesForRules(client, userId, [ruleId]);
  return {
    ...(data as RecurringRule),
    occurrences,
  };
}

export async function getRecurringOccurrenceById(
  client: Client,
  userId: string,
  occurrenceId: string
): Promise<RecurringOccurrence | null> {
  const { data, error } = await client
    .from("recurring_occurrences")
    .select("*")
    .eq("id", occurrenceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("recurring.get_occurrence_failed", {
      error,
      user_id: userId,
      occurrence_id: occurrenceId,
    });
    throw error;
  }

  return (data as RecurringOccurrence | null) ?? null;
}

export async function updateRecurringRule(
  client: Client,
  userId: string,
  ruleId: string,
  updates: {
    name?: string;
    expectedAmount?: number;
    amountVariability?: RecurringAmountVariability;
    frequency?: RecurringFrequency;
    nextExpectedDate?: string;
    categoryId?: CategoryId | null;
    defaultAccountId?: string | null;
    status?: RecurringStatus;
    metadata?: Json;
  }
): Promise<RecurringRuleWithOccurrences> {
  const patch: Database["public"]["Tables"]["recurring_rules"]["Update"] = {};

  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.expectedAmount !== undefined) patch.expected_amount = updates.expectedAmount;
  if (updates.amountVariability !== undefined) {
    patch.amount_variability = updates.amountVariability;
  }
  if (updates.frequency !== undefined) patch.frequency = updates.frequency;
  if (updates.nextExpectedDate !== undefined) {
    patch.next_expected_date = updates.nextExpectedDate;
    patch.day_of_month = dateDay(updates.nextExpectedDate);
  }
  if (updates.categoryId !== undefined) patch.category_id = updates.categoryId;
  if (updates.defaultAccountId !== undefined) {
    patch.default_account_id = updates.defaultAccountId;
  }
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.metadata !== undefined) patch.metadata = updates.metadata;

  const { data, error } = await client
    .from("recurring_rules")
    .update(patch)
    .eq("id", ruleId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    logger.error("recurring.update_rule_failed", {
      error,
      user_id: userId,
      recurring_rule_id: ruleId,
    });
    throw error;
  }

  const rule = data as RecurringRule;
  if (updates.nextExpectedDate && rule.status === "active") {
    await ensureOccurrence(client, {
      userId,
      recurringRuleId: rule.id,
      expectedDate: updates.nextExpectedDate,
      expectedAmount: rule.expected_amount,
      metadata: {
        created_from: "dashboard_recurring_update",
      },
    });
  }

  const occurrences = await listOpenOccurrencesForRules(client, userId, [ruleId]);
  return { ...rule, occurrences };
}

export async function cancelRecurringRule(
  client: Client,
  userId: string,
  ruleId: string,
  traceId: string
): Promise<RecurringRule> {
  const { data, error } = await client
    .from("recurring_rules")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      metadata: {
        cancelled_from: "dashboard_recurring",
        trace_id: traceId,
      },
    })
    .eq("id", ruleId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    logger.error("recurring.cancel_rule_failed", {
      error,
      user_id: userId,
      recurring_rule_id: ruleId,
    });
    throw error;
  }

  return data as RecurringRule;
}

export async function listUpcomingCommitments(
  client: Client,
  userId: string,
  horizonDays = 31
): Promise<UpcomingCommitmentSummary[]> {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + horizonDays);

  const { rules } = await listRecurringDashboard(client, userId, ["active"]);
  return rules
    .map<UpcomingCommitmentSummary | null>((rule) => {
      const occurrence = pickNextOccurrence(rule);
      const dueAt = occurrence?.expected_date ?? rule.next_expected_date;
      const amount = occurrence?.expected_amount ?? rule.expected_amount;

      if (!dueAt || typeof amount !== "number") return null;
      if (new Date(`${dueAt}T00:00:00`).getTime() > horizon.getTime()) return null;

      return {
        id: occurrence?.id ?? rule.id,
        title: rule.name,
        amount: roundMoney(amount),
        currency: rule.currency,
        due_at: dueAt,
        kind: "recurring" as const,
        linked_box_id: rule.linked_box_id,
      };
    })
    .filter((item): item is UpcomingCommitmentSummary => item !== null)
    .sort((left, right) => left.due_at.localeCompare(right.due_at));
}

export async function runRecurringCandidateDetection(
  client: Client,
  userId: string,
  options: {
    lookbackDays?: number;
    limit?: number;
    traceId?: string;
    now?: Date;
    signalAgent?: RecurringSignalAgent;
  } = {}
): Promise<RecurringCandidateDetectionResult> {
  const now = options.now ?? new Date();
  const lookbackDays = clampInteger(options.lookbackDays ?? 180, 30, 730);
  const limit = clampInteger(options.limit ?? 500, 20, 1000);
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - lookbackDays);

  const [{ data: movementData, error: movementsError }, existingMerchantKeys] =
    await Promise.all([
      client
        .from("movements")
        .select(
          "id,type,status,amount,currency,occurred_at,description,merchant,category_id,debt_id,recurring_rule_id,recurring_occurrence_id,deleted_at"
        )
        .eq("user_id", userId)
        .eq("status", "confirmed")
        .is("deleted_at", null)
        .gte("occurred_at", since.toISOString())
        .order("occurred_at", { ascending: false })
        .limit(limit),
      listExistingRecurringMerchantKeys(client, userId),
    ]);

  if (movementsError) {
    logger.error("recurring.detect_movements_failed", {
      error: movementsError,
      user_id: userId,
    });
    throw movementsError;
  }

  const suggestions = detectRecurringCandidates({
    movements: (movementData ?? []) as RecurringDetectorMovement[],
    existingMerchantKeys,
    now,
  });
  const signalAgent = options.signalAgent ?? new RecurringSignalAgent();
  const enrichedSuggestions = await Promise.all(
    suggestions.map((suggestion, index) =>
      enrichRecurringCandidate(suggestion, {
        agent: signalAgent,
        traceId:
          options.traceId ??
          `recurring-detect:${userId}:${now.getTime()}:${index}`,
      }),
    ),
  );

  let inserted = 0;
  let updated = 0;
  const candidates: RecurringCandidate[] = [];

  for (const { suggestion, enrichment } of enrichedSuggestions) {
    const result = await upsertRecurringCandidate(client, userId, suggestion, {
      now,
      traceId: options.traceId,
      agentEnrichment: enrichment,
    });
    candidates.push(result.candidate);
    if (result.action === "inserted") inserted += 1;
    if (result.action === "updated") updated += 1;
  }

  return {
    detected: enrichedSuggestions.length,
    ready_to_suggest: enrichedSuggestions.filter(
      ({ suggestion }) => suggestion.status === "ready_to_suggest"
    ).length,
    inserted,
    updated,
    stored: candidates.length,
    candidates,
  };
}

export async function getRecurringCandidateById(
  client: Client,
  userId: string,
  candidateId: string
): Promise<RecurringCandidate | null> {
  const { data, error } = await client
    .from("recurring_candidates")
    .select("*")
    .eq("id", candidateId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error("recurring.get_candidate_failed", {
      error,
      user_id: userId,
      recurring_candidate_id: candidateId,
    });
    throw error;
  }

  return (data as RecurringCandidate | null) ?? null;
}

export function buildRecurringRuleDefaultsFromCandidate(
  candidate: RecurringCandidate,
  overrides: RecurringCandidateConfirmOverrides = {}
): RecurringCandidateRuleDefaults {
  const evidence = asRecord(candidate.evidence);
  const evidenceAmount = getRecordNumber(evidence, "inferred_amount");
  const evidenceFrequency = asRecurringFrequency(
    getRecordString(evidence, "inferred_frequency")
  );
  const evidenceVariability = asAmountVariability(
    getRecordString(evidence, "amount_variability")
  );
  const evidenceCurrency = asCurrency(getRecordString(evidence, "currency"));
  const evidenceDate = getRecordString(evidence, "next_expected_date");
  const evidenceName = getRecordString(evidence, "display_name");
  const evidenceDay = getRecordInteger(evidence, "day_of_month");
  const evidenceWindowStart = getRecordInteger(evidence, "date_window_start_day");
  const evidenceWindowEnd = getRecordInteger(evidence, "date_window_end_day");
  const evidenceCategory =
    asCategoryId(getRecordString(evidence, "category_id")) ?? candidate.category_id;

  const name = (overrides.name ?? evidenceName ?? toDisplayName(candidate.merchant_key)).trim();
  const expectedAmount = overrides.expectedAmount ?? evidenceAmount;
  const frequency = overrides.frequency ?? evidenceFrequency;
  const nextExpectedDate = overrides.nextExpectedDate ?? evidenceDate;

  if (name.length < 2) {
    throw new Error("RECURRING_CANDIDATE_INCOMPLETE_NAME");
  }

  if (!expectedAmount || expectedAmount <= 0) {
    throw new Error("RECURRING_CANDIDATE_INCOMPLETE_AMOUNT");
  }

  if (!frequency) {
    throw new Error("RECURRING_CANDIDATE_INCOMPLETE_FREQUENCY");
  }

  if (!nextExpectedDate || !isIsoDate(nextExpectedDate)) {
    throw new Error("RECURRING_CANDIDATE_INCOMPLETE_DATE");
  }

  return {
    name,
    expectedAmount: roundMoney(expectedAmount),
    amountVariability:
      overrides.amountVariability ?? evidenceVariability ?? "estimated",
    currency: overrides.currency ?? evidenceCurrency ?? "PEN",
    frequency,
    nextExpectedDate,
    dayOfMonth: overrides.nextExpectedDate
      ? dateDay(overrides.nextExpectedDate)
      : evidenceDay ?? dateDay(nextExpectedDate),
    dateWindowStartDay: evidenceWindowStart,
    dateWindowEndDay: evidenceWindowEnd,
    categoryId:
      overrides.categoryId === undefined ? evidenceCategory ?? null : overrides.categoryId,
    defaultAccountId: overrides.defaultAccountId ?? null,
    merchantPattern: candidate.merchant_key,
    confidence: candidate.confidence,
  };
}

export async function confirmRecurringCandidate(
  client: Client,
  userId: string,
  candidateId: string,
  overrides: RecurringCandidateConfirmOverrides,
  traceId: string
): Promise<RecurringCandidateConfirmResult | null> {
  const candidate = await getRecurringCandidateById(client, userId, candidateId);
  if (!candidate) return null;

  if (!openCandidateStatuses.includes(candidate.status as (typeof openCandidateStatuses)[number])) {
    throw new Error("RECURRING_CANDIDATE_NOT_OPEN");
  }

  const existingRule = await findRuleConfirmedFromCandidate(client, userId, candidate.id);
  if (existingRule) {
    const updatedCandidate = await updateCandidateStatus(client, candidate, "confirmed", {
      confirmed_rule_id: existingRule.id,
      confirmed_at: new Date().toISOString(),
      trace_id: traceId,
    });
    return { candidate: updatedCandidate, recurring_rule: existingRule };
  }

  const defaults = buildRecurringRuleDefaultsFromCandidate(candidate, overrides);
  const recurring_rule = await createRecurringRule(client, {
    userId,
    name: defaults.name,
    expectedAmount: defaults.expectedAmount,
    amountVariability: defaults.amountVariability,
    currency: defaults.currency,
    frequency: defaults.frequency,
    nextExpectedDate: defaults.nextExpectedDate,
    dayOfMonth: defaults.dayOfMonth,
    dateWindowStartDay: defaults.dateWindowStartDay,
    dateWindowEndDay: defaults.dateWindowEndDay,
    categoryId: defaults.categoryId,
    defaultAccountId: defaults.defaultAccountId,
    merchantPattern: defaults.merchantPattern,
    source: "pattern_detection",
    confidence: defaults.confidence,
    metadata: toJson({
      created_from: "recurring_candidate_confirm",
      recurring_candidate_id: candidate.id,
      candidate_evidence: candidate.evidence,
      trace_id: traceId,
      note: "Detected recurrence activates an expected payment only; balances move only when paid through Core.",
    }),
  });
  const updatedCandidate = await updateCandidateStatus(client, candidate, "confirmed", {
    confirmed_rule_id: recurring_rule.id,
    confirmed_at: new Date().toISOString(),
    trace_id: traceId,
  });

  return { candidate: updatedCandidate, recurring_rule };
}

export async function discardRecurringCandidate(
  client: Client,
  userId: string,
  candidateId: string,
  traceId: string
): Promise<RecurringCandidate | null> {
  const candidate = await getRecurringCandidateById(client, userId, candidateId);
  if (!candidate) return null;

  if (candidate.status === "confirmed") {
    throw new Error("RECURRING_CANDIDATE_ALREADY_CONFIRMED");
  }

  if (candidate.status === "dismissed") return candidate;

  return updateCandidateStatus(client, candidate, "dismissed", {
    dismissed_at: new Date().toISOString(),
    trace_id: traceId,
  });
}

export async function commitRecurringPayment(
  client: Client,
  params: {
    recurringRuleId: string;
    occurrenceId: string;
    movementCommit: MovementCommitPayload;
    recurringOutboxEvents: OutboxEventDraft[];
  }
): Promise<RecurringPaymentCommitResult> {
  const { data, error } = await client.rpc("commit_recurring_payment", {
    p_recurring_rule_id: params.recurringRuleId,
    p_occurrence_id: params.occurrenceId,
    p_movement: toJson(params.movementCommit.movement),
    p_audit_logs: toJson(params.movementCommit.auditLogs),
    p_account_deltas: toJson(params.movementCommit.accountDeltas),
    p_box_deltas: toJson(params.movementCommit.boxDeltas),
    p_movement_outbox_events: toJson(params.movementCommit.outboxEvents),
    p_recurring_outbox_events: toJson(params.recurringOutboxEvents),
  });

  if (error || !data) {
    logger.error("recurring.payment_commit_failed", {
      error,
      recurring_rule_id: params.recurringRuleId,
      occurrence_id: params.occurrenceId,
    });
    throw error;
  }

  return data as unknown as RecurringPaymentCommitResult;
}

export async function commitPendingRecurringPayment(
  client: Client,
  params: {
    pendingItemId: string;
    actorId: string;
    traceId: string;
    recurringRuleId: string;
    occurrenceId: string;
    movementCommit: MovementCommitPayload;
    recurringOutboxEvents: OutboxEventDraft[];
  },
): Promise<
  RecurringPaymentCommitResult & { pending_item: PendingItem }
> {
  const { data, error } = await client.rpc(
    "commit_pending_recurring_payment",
    {
      p_pending_id: params.pendingItemId,
      p_actor_id: params.actorId,
      p_trace_id: params.traceId,
      p_recurring_rule_id: params.recurringRuleId,
      p_occurrence_id: params.occurrenceId,
      p_movement: toJson(params.movementCommit.movement),
      p_audit_logs: toJson(params.movementCommit.auditLogs),
      p_account_deltas: toJson(params.movementCommit.accountDeltas),
      p_box_deltas: toJson(params.movementCommit.boxDeltas),
      p_movement_outbox_events: toJson(params.movementCommit.outboxEvents),
      p_recurring_outbox_events: toJson(params.recurringOutboxEvents),
    },
  );

  if (error || !data) {
    logger.error("recurring.pending_payment_commit_failed", {
      error,
      recurring_rule_id: params.recurringRuleId,
      occurrence_id: params.occurrenceId,
      pending_item_id: params.pendingItemId,
    });
    throw error;
  }

  return data as unknown as RecurringPaymentCommitResult & {
    pending_item: PendingItem;
  };
}

async function listExistingRecurringMerchantKeys(
  client: Client,
  userId: string
): Promise<string[]> {
  const { data, error } = await client
    .from("recurring_rules")
    .select("name,merchant_pattern")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["suggested", "active", "paused"]);

  if (error) {
    logger.error("recurring.list_existing_keys_failed", { error, user_id: userId });
    throw error;
  }

  return (data ?? [])
    .flatMap((rule) => [rule.merchant_pattern, rule.name])
    .map((value) => normalizeRecurringMerchantKey(value))
    .filter((value): value is string => Boolean(value));
}

async function upsertRecurringCandidate(
  client: Client,
  userId: string,
  suggestion: RecurringCandidateSuggestion,
  options: {
    now: Date;
    traceId?: string;
    agentEnrichment?: RecurringAgentEnrichment | null;
  }
): Promise<{ action: "inserted" | "updated"; candidate: RecurringCandidate }> {
  const existing = await findOpenCandidateByMerchantKey(
    client,
    userId,
    suggestion.merchant_key
  );
  const detectedAt = options.now.toISOString();

  if (existing) {
    const metadata = {
      ...asRecord(existing.metadata),
      detector_version: "recurring-detector-v1",
      last_detected_at: detectedAt,
      ...(options.traceId ? { trace_id: options.traceId } : {}),
      ...(options.agentEnrichment
        ? { recurring_signal: options.agentEnrichment }
        : {}),
    };
    const { data, error } = await client
      .from("recurring_candidates")
      .update({
        category_id: suggestion.category_id,
        evidence: toJson(suggestion.evidence),
        confidence: suggestion.confidence,
        status:
          existing.status === "suggested" ? "suggested" : suggestion.status,
        metadata: toJson(metadata),
      })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("recurring.update_candidate_failed", {
        error,
        user_id: userId,
        merchant_key: suggestion.merchant_key,
      });
      throw error;
    }

    return { action: "updated", candidate: data as RecurringCandidate };
  }

  const metadata = {
    detector_version: "recurring-detector-v1",
    first_detected_at: detectedAt,
    last_detected_at: detectedAt,
    ...(options.traceId ? { trace_id: options.traceId } : {}),
    ...(options.agentEnrichment
      ? { recurring_signal: options.agentEnrichment }
      : {}),
  };
  const { data, error } = await client
    .from("recurring_candidates")
    .insert({
      user_id: userId,
      merchant_key: suggestion.merchant_key,
      category_id: suggestion.category_id,
      evidence: toJson(suggestion.evidence),
      confidence: suggestion.confidence,
      status: suggestion.status,
      metadata: toJson(metadata),
    })
    .select()
    .single();

  if (error) {
    logger.error("recurring.insert_candidate_failed", {
      error,
      user_id: userId,
      merchant_key: suggestion.merchant_key,
    });
    throw error;
  }

  return { action: "inserted", candidate: data as RecurringCandidate };
}

async function findOpenCandidateByMerchantKey(
  client: Client,
  userId: string,
  merchantKey: string
): Promise<RecurringCandidate | null> {
  const { data, error } = await client
    .from("recurring_candidates")
    .select("*")
    .eq("user_id", userId)
    .eq("merchant_key", merchantKey)
    .in("status", [...openCandidateStatuses])
    .order("confidence", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    logger.error("recurring.find_candidate_failed", {
      error,
      user_id: userId,
      merchant_key: merchantKey,
    });
    throw error;
  }

  return ((data ?? [])[0] as RecurringCandidate | undefined) ?? null;
}

async function findRuleConfirmedFromCandidate(
  client: Client,
  userId: string,
  candidateId: string
): Promise<RecurringRuleWithOccurrences | null> {
  const { data, error } = await client
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .contains("metadata", { recurring_candidate_id: candidateId })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    logger.error("recurring.find_candidate_rule_failed", {
      error,
      user_id: userId,
      recurring_candidate_id: candidateId,
    });
    throw error;
  }

  const rule = ((data ?? [])[0] as RecurringRule | undefined) ?? null;
  if (!rule) return null;

  const occurrences = await listOpenOccurrencesForRules(client, userId, [rule.id]);
  return { ...rule, occurrences };
}

async function updateCandidateStatus(
  client: Client,
  candidate: RecurringCandidate,
  status: RecurringCandidate["status"],
  metadataPatch: Record<string, unknown>
): Promise<RecurringCandidate> {
  const { data, error } = await client
    .from("recurring_candidates")
    .update({
      status,
      metadata: toJson({
        ...asRecord(candidate.metadata),
        ...metadataPatch,
      }),
    })
    .eq("id", candidate.id)
    .eq("user_id", candidate.user_id)
    .select()
    .single();

  if (error) {
    logger.error("recurring.update_candidate_status_failed", {
      error,
      user_id: candidate.user_id,
      recurring_candidate_id: candidate.id,
      status,
    });
    throw error;
  }

  return data as RecurringCandidate;
}

async function listOpenOccurrencesForRules(
  client: Client,
  userId: string,
  ruleIds: string[]
): Promise<RecurringOccurrence[]> {
  const { data, error } = await client
    .from("recurring_occurrences")
    .select("*")
    .eq("user_id", userId)
    .in("recurring_rule_id", ruleIds)
    .in("status", displayOccurrenceStatuses)
    .order("status", { ascending: true })
    .order("expected_date", { ascending: true })
    .limit(80);

  if (error) {
    logger.error("recurring.list_occurrences_failed", { error, user_id: userId });
    throw error;
  }

  return (data ?? []) as RecurringOccurrence[];
}

async function listSuggestedCandidates(
  client: Client,
  userId: string
): Promise<RecurringCandidate[]> {
  const { data, error } = await client
    .from("recurring_candidates")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["ready_to_suggest", "suggested"])
    .order("confidence", { ascending: false })
    .limit(20);

  if (error) {
    logger.error("recurring.list_candidates_failed", { error, user_id: userId });
    throw error;
  }

  return (data ?? []) as RecurringCandidate[];
}

async function ensureOccurrence(
  client: Client,
  params: {
    userId: string;
    recurringRuleId: string;
    expectedDate: string;
    expectedAmount: number | null;
    metadata?: Json;
  }
): Promise<RecurringOccurrence> {
  const { data, error } = await client
    .from("recurring_occurrences")
    .upsert(
      {
        user_id: params.userId,
        recurring_rule_id: params.recurringRuleId,
        expected_date: params.expectedDate,
        expected_amount: params.expectedAmount,
        status: "expected",
        metadata: params.metadata ?? {},
      },
      { onConflict: "recurring_rule_id,expected_date" }
    )
    .select()
    .single();

  if (error) {
    logger.error("recurring.ensure_occurrence_failed", {
      error,
      user_id: params.userId,
      recurring_rule_id: params.recurringRuleId,
    });
    throw error;
  }

  return data as RecurringOccurrence;
}

function groupOccurrencesByRule(occurrences: RecurringOccurrence[]) {
  const map = new Map<string, RecurringOccurrence[]>();
  for (const occurrence of occurrences) {
    const current = map.get(occurrence.recurring_rule_id) ?? [];
    current.push(occurrence);
    map.set(occurrence.recurring_rule_id, current);
  }

  return map;
}

function pickNextOccurrence(
  rule: RecurringRuleWithOccurrences
): RecurringOccurrence | null {
  return (
    rule.occurrences
      .filter((occurrence) => openOccurrenceStatuses.includes(occurrence.status))
      .sort((left, right) => left.expected_date.localeCompare(right.expected_date))[0] ??
    null
  );
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getRecordString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRecordNumber(
  record: Record<string, unknown>,
  key: string
): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRecordInteger(
  record: Record<string, unknown>,
  key: string
): number | null {
  const value = getRecordNumber(record, key);
  return value !== null && Number.isInteger(value) ? value : null;
}

function asRecurringFrequency(value: string | null): RecurringFrequency | null {
  return value && RECURRING_FREQUENCIES.includes(value as RecurringFrequency)
    ? (value as RecurringFrequency)
    : null;
}

function asAmountVariability(
  value: string | null
): RecurringAmountVariability | null {
  return value &&
    RECURRING_AMOUNT_VARIABILITIES.includes(
      value as RecurringAmountVariability
    )
    ? (value as RecurringAmountVariability)
    : null;
}

function asCurrency(value: string | null): "PEN" | "USD" | null {
  return value === "PEN" || value === "USD" ? value : null;
}

function asCategoryId(value: string | null): CategoryId | null {
  return value && CATEGORY_IDS.includes(value as CategoryId)
    ? (value as CategoryId)
    : null;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDisplayName(merchantKey: string): string {
  return merchantKey
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dateDay(value: string): number | null {
  const day = Number(value.slice(8, 10));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toJson(value: unknown): Json {
  return value as Json;
}
