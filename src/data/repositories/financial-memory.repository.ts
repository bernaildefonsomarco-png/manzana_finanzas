import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type FinancialMemoryKind =
  | "preference"
  | "alias"
  | "person_context"
  | "correction_pattern"
  | "narrative_fact";

export type FinancialMemoryLifecycleStatus =
  | "confirmed"
  | "suspended"
  | "revoked"
  | "expired"
  | "superseded";

export type FinancialMemoryItem = {
  id: string;
  user_id: string;
  kind: FinancialMemoryKind;
  canonical_key: string;
  summary: string;
  search_terms: string[];
  evidence_source: string;
  evidence_ref: string;
  confidence: number;
  confirmation_status: "confirmed" | "revoked";
  lifecycle_status: FinancialMemoryLifecycleStatus;
  sensitivity: "normal" | "sensitive";
  valid_until: string | null;
  superseded_at: string | null;
  positive_evidence_refs: string[];
  negative_evidence_refs: string[];
  positive_evidence_count: number;
  negative_evidence_count: number;
  explanation: string | null;
  review_at: string | null;
  last_used_at: string | null;
  suspended_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  sensitive_confirmed_at: string | null;
  source_candidate_id: string | null;
  supersedes_memory_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export async function searchConfirmedFinancialMemory(
  client: Client,
  input: { userId: string; queryText: string; limit?: number; now?: string }
): Promise<FinancialMemoryItem[]> {
  try {
    const now = input.now ?? new Date().toISOString();
    const preferences = await getLearningPreferences(client, input.userId);
    if (!preferences.enabled) return [];
    const { data, error } = await client
      .from("financial_memory_items")
      .select("*")
      .eq("user_id", input.userId)
      .eq("confirmation_status", "confirmed")
      .eq("lifecycle_status", "confirmed")
      .is("superseded_at", null)
      .or(`valid_until.is.null,valid_until.gt.${now}`)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    const tokens = normalizeTerms(tokenize(input.queryText));
    return (data ?? [])
      .map(normalizeItem)
      .filter(
        (item) =>
          (preferences.allow_narrative_memory ||
            item.kind !== "narrative_fact") &&
          (preferences.allow_sensitive_memory ||
            item.sensitivity !== "sensitive"),
      )
      .map((item) => ({ item, score: scoreItem(item, tokens) }))
      .filter(({ score }) => tokens.length === 0 || score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.limit ?? 12)
      .map(({ item }) => item);
  } catch (error) {
    logger.warn("financial_memory.search_failed", {
      error,
      user_id: input.userId,
    });
    return [];
  }
}

export type LearningPreferences = {
  user_id: string;
  enabled: boolean;
  allow_narrative_memory: boolean;
  allow_sensitive_memory: boolean;
  consent_version: string;
  updated_by: "user" | "system" | "migration";
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export async function getLearningPreferences(
  client: Client,
  userId: string,
): Promise<LearningPreferences> {
  const { data, error } = await client
    .from("learning_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const now = new Date().toISOString();
    return {
      user_id: userId,
      enabled: true,
      allow_narrative_memory: true,
      allow_sensitive_memory: false,
      consent_version: "learning_v1",
      updated_by: "system",
      created_at: now,
      updated_at: now,
      metadata: {},
    };
  }
  return {
    ...data,
    updated_by: data.updated_by as LearningPreferences["updated_by"],
    metadata: normalizeObject(data.metadata),
  };
}

export async function setLearningPreferences(
  client: Client,
  input: {
    userId: string;
    enabled: boolean;
    allowNarrativeMemory: boolean;
    allowSensitiveMemory: boolean;
    consentVersion?: string;
    idempotencyKey: string;
  },
): Promise<LearningPreferences> {
  const { data, error } = await client.rpc("set_learning_preferences", {
    p_user_id: input.userId,
    p_enabled: input.enabled,
    p_allow_narrative_memory: input.allowNarrativeMemory,
    p_allow_sensitive_memory: input.allowSensitiveMemory,
    p_consent_version: input.consentVersion ?? "learning_v1",
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return {
    ...data,
    updated_by: data.updated_by as LearningPreferences["updated_by"],
    metadata: normalizeObject(data.metadata),
  };
}

export async function listFinancialMemory(
  client: Client,
  input: {
    userId: string;
    statuses?: FinancialMemoryLifecycleStatus[];
    limit?: number;
  },
): Promise<FinancialMemoryItem[]> {
  let query = client
    .from("financial_memory_items")
    .select("*")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 200));
  if (input.statuses?.length) {
    query = query.in("lifecycle_status", input.statuses);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeItem);
}

export type ManageFinancialMemoryResult = {
  memory: FinancialMemoryItem;
  replacement: FinancialMemoryItem | null;
};

export async function manageFinancialMemory(
  client: Client,
  input: {
    userId: string;
    memoryId: string;
    action: "forget" | "correct" | "suspend" | "confirm";
    summary?: string | null;
    reason?: string | null;
    idempotencyKey: string;
  },
): Promise<ManageFinancialMemoryResult> {
  const { data, error } = await client.rpc("manage_financial_memory", {
    p_user_id: input.userId,
    p_memory_id: input.memoryId,
    p_action: input.action,
    p_summary: input.summary ?? "",
    p_reason: input.reason ?? "",
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  if (!isManageResult(data)) {
    throw new Error("LEARNING_MEMORY_MANAGE_RESULT_INVALID");
  }
  return {
    memory: normalizeItem(
      data.memory as Database["public"]["Tables"]["financial_memory_items"]["Row"],
    ),
    replacement: data.replacement
      ? normalizeItem(
          data.replacement as Database["public"]["Tables"]["financial_memory_items"]["Row"],
        )
      : null,
  };
}

export async function expireFinancialLearning(
  client: Client,
  now?: string,
): Promise<{
  expired_candidates: number;
  expired_memories: number;
  processed_at: string;
}> {
  const { data, error } = await client.rpc("expire_financial_learning", {
    p_now: now ?? new Date().toISOString(),
  });
  if (error) throw error;
  if (!isRecord(data)) throw new Error("LEARNING_EXPIRY_RESULT_INVALID");
  return {
    expired_candidates: Number(data.expired_candidates ?? 0),
    expired_memories: Number(data.expired_memories ?? 0),
    processed_at: String(data.processed_at ?? now ?? new Date().toISOString()),
  };
}

export async function getLearningGovernanceMetrics(
  client: Client,
  days = 30,
): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc(
    "get_learning_governance_metrics",
    { p_days: days },
  );
  if (error) throw error;
  return isRecord(data) ? data : {};
}

function scoreItem(item: FinancialMemoryItem, tokens: string[]): number {
  const haystack = normalizeText(
    [item.summary, item.canonical_key, ...item.search_terms].join(" ")
  );
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return matches * 10 + Number(item.confidence);
}

function normalizeItem(
  row: Database["public"]["Tables"]["financial_memory_items"]["Row"]
): FinancialMemoryItem {
  return {
    ...row,
    kind: row.kind as FinancialMemoryKind,
    confidence: Number(row.confidence),
    confirmation_status: row.confirmation_status as "confirmed" | "revoked",
    lifecycle_status:
      row.lifecycle_status as FinancialMemoryLifecycleStatus,
    sensitivity: row.sensitivity as "normal" | "sensitive",
    search_terms: row.search_terms,
    metadata: normalizeObject(row.metadata),
  };
}

function isManageResult(
  value: unknown,
): value is {
  memory: Record<string, Json>;
  replacement: Record<string, Json> | null;
} {
  return Boolean(
    isRecord(value) &&
      isRecord(value.memory) &&
      (value.replacement === null || isRecord(value.replacement)),
  );
}

function isRecord(value: unknown): value is Record<string, Json> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTerms(values: string[]): string[] {
  return [...new Set(values.map(normalizeText).filter((value) => value.length > 1))]
    .slice(0, 30);
}

function tokenize(value: string): string[] {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeObject(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
