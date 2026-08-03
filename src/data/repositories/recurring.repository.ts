import { createHash } from "node:crypto";
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
import {
  addCalendarDays,
  isoDateInLima,
  planRecurringOccurrenceHorizon,
  recurringDuePresentation,
  RECURRING_OCCURRENCE_HORIZON_DAYS,
} from "@/core/recurring/recurring-occurrence-scheduler";
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
  type RecurringCandidateStatus,
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
  linked_debt_id?: string | null;
  recurring_rule_id?: string;
  occurrence_id?: string | null;
  presentation_state?: "upcoming" | "pending_confirmation" | "overdue";
  presentation_label?: "Próximo" | "Pago pendiente" | "Vencido";
  days_late?: number;
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
  expectedAmount?: number | null;
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
  statuses: RecurringStatus[] = ["active", "suggested", "paused"],
  options: { limit?: number; cursorFilter?: string } = {}
): Promise<RecurringDashboardData> {
  // Clave de paginacion: `created_at desc, id desc`, no `next_expected_date`
  // (admite null, no compara de forma estable contra un cursor — mismo
  // razonamiento que `debts.repository.ts::listDebts`). El orden de negocio
  // (vencimiento mas proximo primero) se reaplica en el llamador
  // (`route.ts`) sobre la pagina ya recortada.
  let rulesBuilder = client
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (options.cursorFilter) rulesBuilder = rulesBuilder.or(options.cursorFilter);
  if (options.limit !== undefined) rulesBuilder = rulesBuilder.limit(options.limit);

  const { data: rulesData, error: rulesError } = await rulesBuilder;

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
    listRecurringCandidates(client, userId, [
      "ready_to_suggest",
      "suggested",
    ]),
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

/** Orden de negocio (vencimiento mas proximo primero) para mostrar; se
 * aplica DESPUES de paginar (`route.ts`), nunca antes — ver el comentario en
 * `listRecurringDashboard` sobre por que la clave de cursor es otra. */
export function sortRecurringRulesByNextExpectedDate<
  T extends { next_expected_date: string | null }
>(rules: T[]): T[] {
  return [...rules].sort((left, right) => {
    if (!left.next_expected_date && !right.next_expected_date) return 0;
    if (!left.next_expected_date) return 1;
    if (!right.next_expected_date) return -1;
    return left.next_expected_date.localeCompare(right.next_expected_date);
  });
}

export async function createRecurringRule(
  client: Client,
  params: {
    userId: string;
    name: string;
    expectedAmount: number | null;
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
    idempotencyKey?: string;
    metadata?: Json;
  }
): Promise<RecurringRuleWithOccurrences> {
  const creationRequestHash = params.idempotencyKey
    ? recurringCreationRequestHash(params)
    : null;
  if (params.idempotencyKey && creationRequestHash) {
    const existing = await findRecurringRuleByCreationKey(
      client,
      params.userId,
      params.idempotencyKey
    );
    if (existing) {
      assertSameRecurringCreation(existing, creationRequestHash);
      return { ...existing, occurrences: [] };
    }
  }
  if (params.nextExpectedDate < isoDateInLima()) {
    throw new Error("RECURRING_RULE_NEXT_DATE_IN_PAST");
  }

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
      creation_idempotency_key: params.idempotencyKey ?? null,
      creation_request_hash: creationRequestHash,
      requires_confirmation_for_payment: true,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (ruleError) {
    if (params.idempotencyKey && creationRequestHash && isUniqueViolation(ruleError)) {
      const existing = await findRecurringRuleByCreationKey(
        client,
        params.userId,
        params.idempotencyKey
      );
      if (existing) {
        assertSameRecurringCreation(existing, creationRequestHash);
        return { ...existing, occurrences: [] };
      }
    }
    if (isRecurringActiveNameViolation(ruleError)) {
      throw new Error("RECURRING_RULE_NAME_CONFLICT");
    }
    logger.error("recurring.create_rule_failed", {
      error: ruleError,
      user_id: params.userId,
    });
    throw ruleError;
  }

  return {
    ...(ruleData as RecurringRule),
    occurrences: [],
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

export async function listRecurringOccurrences(
  client: Client,
  userId: string,
  recurringRuleId: string,
  options: {
    statuses?: RecurringOccurrenceStatus[];
    fromDate?: string;
    toDate?: string;
    limit?: number;
    cursorFilter?: string;
  } = {}
): Promise<RecurringOccurrence[]> {
  let builder = client
    .from("recurring_occurrences")
    .select("*")
    .eq("user_id", userId)
    .eq("recurring_rule_id", recurringRuleId);

  if (options.statuses?.length) {
    builder = builder.in("status", options.statuses);
  }
  if (options.fromDate) builder = builder.gte("expected_date", options.fromDate);
  if (options.toDate) builder = builder.lte("expected_date", options.toDate);
  if (options.cursorFilter) builder = builder.or(options.cursorFilter);

  builder = builder
    .order("expected_date", { ascending: false })
    .order("id", { ascending: false });
  if (options.limit !== undefined) builder = builder.limit(options.limit);

  const { data, error } = await builder;
  if (error) {
    logger.error("recurring.list_occurrences_history_failed", {
      error,
      user_id: userId,
      recurring_rule_id: recurringRuleId,
    });
    throw error;
  }

  return (data ?? []) as RecurringOccurrence[];
}

export async function updateRecurringRule(
  client: Client,
  userId: string,
  ruleId: string,
  updates: {
    name?: string;
    expectedAmount?: number | null;
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
    if (isRecurringActiveNameViolation(error)) {
      throw new Error("RECURRING_RULE_NAME_CONFLICT");
    }
    logger.error("recurring.update_rule_failed", {
      error,
      user_id: userId,
      recurring_rule_id: ruleId,
    });
    throw error;
  }

  const rule = data as RecurringRule;
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

export type RecurringOccurrenceSkipResult = {
  recurring_rule: RecurringRule;
  occurrence: RecurringOccurrence;
  idempotent: boolean;
};

export async function skipRecurringOccurrence(
  client: Client,
  params: {
    userId: string;
    recurringRuleId: string;
    occurrenceId: string;
    traceId: string;
  }
): Promise<RecurringOccurrenceSkipResult> {
  const { data, error } = await client.rpc(
    "commit_recurring_occurrence_skip",
    {
      p_user_id: params.userId,
      p_recurring_rule_id: params.recurringRuleId,
      p_occurrence_id: params.occurrenceId,
      p_trace_id: params.traceId,
    }
  );

  if (error) {
    logger.error("recurring.skip_occurrence_failed", {
      error,
      user_id: params.userId,
      recurring_rule_id: params.recurringRuleId,
      occurrence_id: params.occurrenceId,
    });
    throw error;
  }

  return data as unknown as RecurringOccurrenceSkipResult;
}

export async function listUpcomingCommitments(
  client: Client,
  userId: string,
  horizonDays = 30,
  now = new Date()
): Promise<UpcomingCommitmentSummary[]> {
  const today = isoDateInLima(now);
  const horizonDate = addCalendarDays(today, horizonDays);
  const { data: rulesData, error: rulesError } = await client
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .is("linked_debt_id", null)
    .order("next_expected_date", { ascending: true });

  if (rulesError) {
    logger.error("recurring.upcoming_rules_failed", {
      error: rulesError,
      user_id: userId,
    });
    throw rulesError;
  }

  const rules = (rulesData ?? []) as RecurringRule[];
  if (rules.length === 0) return [];

  const ruleIds = rules.map((rule) => rule.id);
  const { data: occurrencesData, error: occurrencesError } = await client
    .from("recurring_occurrences")
    .select("*")
    .eq("user_id", userId)
    .in("recurring_rule_id", ruleIds)
    .in("status", openOccurrenceStatuses)
    .lte("expected_date", horizonDate)
    .order("expected_date", { ascending: true });

  if (occurrencesError) {
    logger.error("recurring.upcoming_occurrences_failed", {
      error: occurrencesError,
      user_id: userId,
    });
    throw occurrencesError;
  }

  const occurrences = (occurrencesData ?? []) as RecurringOccurrence[];
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const commitments: UpcomingCommitmentSummary[] = [];
  const materializedKeys = new Set<string>();

  for (const occurrence of occurrences) {
    const rule = ruleById.get(occurrence.recurring_rule_id);
    const amount =
      rule?.amount_variability === "variable"
        ? rule.expected_amount
        : occurrence.expected_amount ?? rule?.expected_amount;
    if (!rule || typeof amount !== "number") continue;
    materializedKeys.add(`${rule.id}:${occurrence.expected_date}`);
    commitments.push(
      toUpcomingCommitment(rule, occurrence, amount, today)
    );
  }

  // Compatibilidad durante el despliegue del job: una regla activa que aún
  // no tenga su ocurrencia materializada sigue apareciendo una sola vez.
  for (const rule of rules) {
    if (
      !rule.next_expected_date ||
      typeof rule.expected_amount !== "number" ||
      rule.next_expected_date > horizonDate ||
      materializedKeys.has(`${rule.id}:${rule.next_expected_date}`)
    ) {
      continue;
    }
    commitments.push(
      toUpcomingCommitment(rule, null, rule.expected_amount, today)
    );
  }

  return commitments.sort((left, right) =>
    left.due_at.localeCompare(right.due_at)
  );
}

export type RecurringOccurrenceMaterializationResult = {
  as_of_date: string;
  horizon_days: number;
  rules_scanned: number;
  occurrences_scanned: number;
  occurrences_planned: number;
  occurrences_inserted: number;
  statuses_updated: number;
};

export async function listRecurringOccurrenceGenerationUserIds(
  client: Client,
  maxUsers?: number
): Promise<string[]> {
  const { data, error } = await client.rpc(
    "list_recurring_generation_user_ids",
    { p_limit: maxUsers ?? undefined }
  );

  if (error) throw error;
  return (data ?? []).map((row) => row.user_id);
}

export async function materializeRecurringOccurrenceHorizon(
  client: Client,
  userId: string,
  options: {
    asOfDate?: string;
    horizonDays?: number;
  } = {}
): Promise<RecurringOccurrenceMaterializationResult> {
  const asOfDate = options.asOfDate ?? isoDateInLima();
  const horizonDays =
    options.horizonDays ?? RECURRING_OCCURRENCE_HORIZON_DAYS;
  const horizonDate = addCalendarDays(asOfDate, horizonDays);
  const { data: rulesData, error: rulesError } = await client
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("id", { ascending: true });

  if (rulesError) throw rulesError;
  const rules = (rulesData ?? []) as RecurringRule[];
  if (rules.length === 0) {
    return {
      as_of_date: asOfDate,
      horizon_days: horizonDays,
      rules_scanned: 0,
      occurrences_scanned: 0,
      occurrences_planned: 0,
      occurrences_inserted: 0,
      statuses_updated: 0,
    };
  }

  const { data: occurrencesData, error: occurrencesError } = await client
    .from("recurring_occurrences")
    .select("*")
    .eq("user_id", userId)
    .in(
      "recurring_rule_id",
      rules.map((rule) => rule.id)
    )
    .in("status", openOccurrenceStatuses)
    .lte("expected_date", horizonDate)
    .order("expected_date", { ascending: true });

  if (occurrencesError) throw occurrencesError;
  const occurrences = (occurrencesData ?? []) as RecurringOccurrence[];
  const plan = planRecurringOccurrenceHorizon({
    rules,
    occurrences,
    asOfDate,
    horizonDays,
  });

  let inserted = 0;
  if (plan.inserts.length > 0) {
    const { data, error } = await client
      .from("recurring_occurrences")
      .upsert(plan.inserts, {
        onConflict: "recurring_rule_id,expected_date",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw error;
    inserted = data?.length ?? 0;
  }

  let statusesUpdated = 0;
  for (const status of ["pending_confirmation", "overdue"] as const) {
    const ids = plan.status_updates
      .filter((update) => update.status === status)
      .map((update) => update.id);
    if (ids.length === 0) continue;
    const { error } = await client
      .from("recurring_occurrences")
      .update({ status })
      .eq("user_id", userId)
      .in("id", ids);
    if (error) throw error;
    statusesUpdated += ids.length;
  }

  return {
    as_of_date: asOfDate,
    horizon_days: horizonDays,
    rules_scanned: rules.length,
    occurrences_scanned: occurrences.length,
    occurrences_planned: plan.inserts.length,
    occurrences_inserted: inserted,
    statuses_updated: statusesUpdated,
  };
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

export async function listRecurringCandidates(
  client: Client,
  userId: string,
  statuses: RecurringCandidateStatus[] = [
    "candidate",
    "ready_to_suggest",
    "suggested",
  ],
  options: { limit?: number } = {}
): Promise<RecurringCandidate[]> {
  let builder = client
    .from("recurring_candidates")
    .select("*")
    .eq("user_id", userId)
    .in("status", statuses)
    .order("confidence", { ascending: false })
    .order("created_at", { ascending: false });

  builder = builder.limit(options.limit ?? 20);
  const { data, error } = await builder;

  if (error) {
    logger.error("recurring.list_candidates_failed", { error, user_id: userId });
    throw error;
  }

  return (data ?? []) as RecurringCandidate[];
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

function toUpcomingCommitment(
  rule: RecurringRule,
  occurrence: RecurringOccurrence | null,
  amount: number,
  today: string
): UpcomingCommitmentSummary {
  const dueAt = occurrence?.expected_date ?? rule.next_expected_date;
  if (!dueAt) throw new Error("RECURRING_UPCOMING_DATE_REQUIRED");
  const presentation = recurringDuePresentation(dueAt, today);
  return {
    id: occurrence?.id ?? rule.id,
    title: rule.name,
    amount: roundMoney(amount),
    currency: rule.currency,
    due_at: dueAt,
    kind: "recurring",
    linked_box_id: rule.linked_box_id,
    linked_debt_id: rule.linked_debt_id,
    recurring_rule_id: rule.id,
    occurrence_id: occurrence?.id ?? null,
    presentation_state: presentation.state,
    presentation_label: presentation.label,
    days_late: presentation.days_late,
  };
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

async function findRecurringRuleByCreationKey(
  client: Client,
  userId: string,
  idempotencyKey: string
): Promise<RecurringRule | null> {
  const { data, error } = await client
    .from("recurring_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("creation_idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    logger.error("recurring.creation_idempotency_lookup_failed", {
      error,
      user_id: userId,
    });
    throw error;
  }
  return (data as RecurringRule | null) ?? null;
}

function recurringCreationRequestHash(params: {
  name: string;
  expectedAmount: number | null;
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
}): string {
  const canonical = JSON.stringify({
    name: params.name,
    expected_amount: params.expectedAmount,
    amount_variability: params.amountVariability,
    currency: params.currency,
    frequency: params.frequency,
    next_expected_date: params.nextExpectedDate,
    day_of_month: params.dayOfMonth ?? dateDay(params.nextExpectedDate),
    date_window_start_day: params.dateWindowStartDay ?? null,
    date_window_end_day: params.dateWindowEndDay ?? null,
    category_id: params.categoryId ?? null,
    default_account_id: params.defaultAccountId ?? null,
    merchant_pattern: params.merchantPattern ?? null,
    source: params.source ?? "dashboard_manual",
    confidence: params.confidence ?? 1,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function assertSameRecurringCreation(
  existing: RecurringRule,
  requestHash: string
): void {
  if (existing.creation_request_hash !== requestHash) {
    throw new Error("RECURRING_RULE_IDEMPOTENCY_CONFLICT");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505"
  );
}

function isRecurringActiveNameViolation(error: unknown): boolean {
  return (
    isUniqueViolation(error) &&
    JSON.stringify(error).includes("recurring_rules_user_active_name_unique")
  );
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
