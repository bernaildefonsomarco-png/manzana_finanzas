import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";

type Client = SupabaseClient<Database>;

export type MemoryScope = "classification" | "profile" | "preference";
type StoredScope = "clasificacion" | "perfil" | "preferencia";

export type PublicMemoryItem = {
  id: string;
  scope: MemoryScope;
  subject_key: string;
  statement: string;
  status: string;
  active: boolean;
  positive_evidence_refs: string[];
  negative_evidence_refs: string[];
  positive_evidence_count: number;
  negative_evidence_count: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  can_reactivate: boolean;
};

export type PublicMemoryEvent = {
  id: string;
  scope: MemoryScope;
  subject_id: string;
  action: string;
  actor: string;
  previous_status: string | null;
  next_status: string | null;
  created_at: string;
};

export type PublicProfileCandidate = {
  id: string;
  subject_key: string;
  statement: string;
  status: string;
  ask_count: number;
  evidence_refs: string[];
  created_at: string;
};

export class MemoryRepositoryError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "UNDO_EXPIRED"
      | "INVALID_OPERATION",
    message: string,
  ) {
    super(message);
    this.name = "MemoryRepositoryError";
  }
}

export async function listMemory(
  client: Client,
  input: {
    userId: string;
    scope?: MemoryScope;
    includeInactive?: boolean;
  },
): Promise<{
  profile: PublicMemoryItem[];
  classification: PublicMemoryItem[];
  preference: PublicMemoryItem[];
  inactive: PublicMemoryItem[];
}> {
  const lifecycle = await callRpc(client, "apply_user_memory_lifecycle", {
    p_user_id: input.userId,
    p_now: new Date().toISOString(),
  });
  if (lifecycle.error) throw lifecycle.error;
  const requested = input.scope;
  const [classificationRows, profileRows, preferenceRows] = await Promise.all([
    requested && requested !== "classification"
      ? Promise.resolve([])
      : readClassification(client, input.userId),
    requested && requested !== "profile"
      ? Promise.resolve([])
      : readProfile(client, input.userId),
    requested && requested !== "preference"
      ? Promise.resolve([])
      : readPreferences(client, input.userId),
  ]);
  const all = [...classificationRows, ...profileRows, ...preferenceRows];
  const inactive = all.filter((item) => !item.active);
  const visible = input.includeInactive ? all : all.filter((item) => item.active);
  return {
    profile: visible.filter((item) => item.scope === "profile"),
    classification: visible.filter((item) => item.scope === "classification"),
    preference: visible.filter((item) => item.scope === "preference"),
    inactive,
  };
}

export async function getMemoryDetail(
  client: Client,
  userId: string,
  id: string,
): Promise<{ memory: PublicMemoryItem; events: PublicMemoryEvent[] } | null> {
  const lifecycle = await callRpc(client, "apply_user_memory_lifecycle", {
    p_user_id: userId,
    p_now: new Date().toISOString(),
  });
  if (lifecycle.error) throw lifecycle.error;
  const [classification, profile, preference] = await Promise.all([
    client
      .from("financial_memory_items")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle(),
    client
      .from("user_profile_facts")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle(),
    client
      .from("learned_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle(),
  ]);
  const failed = [classification, profile, preference].find((result) => result.error);
  if (failed?.error) throw failed.error;
  const memory = classification.data
    ? presentClassification(classification.data)
    : profile.data
      ? presentProfile(profile.data)
      : preference.data
        ? presentPreference(preference.data)
        : null;
  if (!memory) return null;

  const events = await listMemoryEvents(client, {
    userId,
    subjectId: id,
    limit: 100,
  });
  if (memory.scope === "classification") {
    const { data, error } = await client
      .from("learning_memory_events")
      .select("id,memory_id,event_type,actor_type,previous_state,next_state,created_at")
      .eq("user_id", userId)
      .eq("memory_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    events.push(
      ...(data ?? []).map((event) => ({
        id: event.id,
        scope: "classification" as const,
        subject_id: event.memory_id ?? id,
        action: event.event_type,
        actor: event.actor_type,
        previous_status: readStatus(event.previous_state),
        next_status: readStatus(event.next_state),
        created_at: event.created_at,
      })),
    );
    events.sort((left, right) => right.created_at.localeCompare(left.created_at));
  }
  return { memory, events };
}

export async function listProfileCandidates(
  client: Client,
  input: { userId: string; includeResolved?: boolean; limit?: number },
): Promise<PublicProfileCandidate[]> {
  let query = client
    .from("user_profile_candidates")
    .select("id,subject_key,statement,status,ask_count,evidence_refs,created_at")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 1, 1), 100));
  if (!input.includeResolved) {
    query = query.in("status", ["observado", "pending_confirmation"]);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    subject_key: row.subject_key,
    statement: row.statement,
    status: row.status,
    ask_count: row.ask_count,
    evidence_refs: row.evidence_refs,
    created_at: row.created_at,
  }));
}

export async function listMemoryEvents(
  client: Client,
  input: { userId: string; subjectId?: string; cursor?: string; limit?: number },
): Promise<PublicMemoryEvent[]> {
  let query = client
    .from("memory_events")
    .select("id,scope,subject_id,action,actor,previous,next,created_at")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 50, 1), 100));
  if (input.subjectId) query = query.eq("subject_id", input.subjectId);
  if (input.cursor) query = query.lt("created_at", input.cursor);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((event) => ({
    id: event.id,
    scope: fromStoredScope(event.scope),
    subject_id: event.subject_id,
    action: event.action,
    actor: event.actor,
    previous_status: readStatus(event.previous),
    next_status: readStatus(event.next),
    created_at: event.created_at,
  }));
}

export async function commitMemoryOperation(
  client: Client,
  input: {
    userId: string;
    memoryId: string;
    scope: MemoryScope;
    operation: "view" | "correct" | "forget" | "undo" | "reactivate";
    statement?: string;
    value?: Json;
    reason?: string;
    idempotencyKey: string;
    now?: string;
  },
): Promise<{ memory: PublicMemoryItem; replacement: PublicMemoryItem | null; idempotent: boolean }> {
  const common = {
    p_idempotency_key: input.idempotencyKey,
    p_now: input.now ?? new Date().toISOString(),
    p_operation: input.operation,
    p_reason: input.reason ?? "dashboard_memory",
    p_user_id: input.userId,
  };
  const result = input.scope === "classification"
    ? await client.rpc("commit_financial_memory_operation", {
        ...common,
        p_memory_id: input.memoryId,
        p_summary: input.statement ?? "",
      })
    : input.scope === "profile"
      ? await callRpc(client, "commit_profile_memory_operation", {
          ...common,
          p_fact_id: input.memoryId,
          p_statement: input.statement ?? "",
        })
      : await callRpc(client, "commit_preference_memory_operation", {
          ...common,
          p_preference_id: input.memoryId,
          p_value: input.value ?? null,
        });
  if (result.error) throw mapOperationError(result.error.message);
  const record = asRecord(result.data);
  const rawMemory = asRecord(record.memory);
  const rawReplacement = record.replacement ? asRecord(record.replacement) : null;
  return {
    memory: presentByScope(input.scope, rawMemory),
    replacement: rawReplacement ? presentByScope(input.scope, rawReplacement) : null,
    idempotent: record.idempotent === true,
  };
}

export async function resolveProfileCandidate(
  client: Client,
  input: {
    userId: string;
    candidateId: string;
    resolution: "confirm" | "reject" | "never_ask";
    statement?: string;
    idempotencyKey: string;
  },
): Promise<{ candidate: PublicProfileCandidate; fact: PublicMemoryItem | null; idempotent: boolean }> {
  const { data, error } = await client.rpc("resolve_profile_candidate", {
    p_candidate_id: input.candidateId,
    p_idempotency_key: input.idempotencyKey,
    p_resolution: input.resolution,
    p_statement: input.statement ?? "",
    p_user_id: input.userId,
  });
  if (error) throw mapOperationError(error.message);
  const result = asRecord(data);
  const candidate = asRecord(result.candidate);
  return {
    candidate: {
      id: String(candidate.id),
      subject_key: String(candidate.subject_key),
      statement: String(candidate.statement),
      status: String(candidate.status),
      ask_count: Number(candidate.ask_count),
      evidence_refs: asStringArray(candidate.evidence_refs),
      created_at: String(candidate.created_at),
    },
    fact: result.fact ? presentProfile(asRecord(result.fact)) : null,
    idempotent: result.idempotent === true,
  };
}

export async function forgetAllMemory(
  client: Client,
  input: { userId: string; confirmation: string; idempotencyKey: string },
): Promise<{ deleted: Record<string, number>; idempotent: boolean }> {
  const { data, error } = await client.rpc("forget_all_user_memory", {
    p_confirmation: input.confirmation,
    p_idempotency_key: input.idempotencyKey,
    p_user_id: input.userId,
  });
  if (error) throw mapOperationError(error.message);
  const result = asRecord(data);
  const deleted = asRecord(result.deleted);
  return {
    deleted: Object.fromEntries(
      Object.entries(deleted).map(([key, value]) => [key, Number(value)]),
    ),
    idempotent: result.idempotent === true,
  };
}

async function readClassification(client: Client, userId: string) {
  const { data, error } = await client
    .from("financial_memory_items")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(presentClassification);
}

async function readProfile(client: Client, userId: string) {
  const { data, error } = await client
    .from("user_profile_facts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(presentProfile);
}

async function readPreferences(client: Client, userId: string) {
  const { data, error } = await client
    .from("learned_preferences")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(presentPreference);
}

function presentClassification(row: Record<string, unknown>): PublicMemoryItem {
  const status = String(row.lifecycle_status);
  return {
    id: String(row.id),
    scope: "classification",
    subject_key: String(row.canonical_key),
    statement: String(row.summary),
    status,
    active: status === "confirmed",
    positive_evidence_refs: asStringArray(row.positive_evidence_refs),
    negative_evidence_refs: asStringArray(row.negative_evidence_refs),
    positive_evidence_count: Number(row.positive_evidence_count ?? 0),
    negative_evidence_count: Number(row.negative_evidence_count ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    last_used_at: row.last_used_at ? String(row.last_used_at) : null,
    can_reactivate: status === "suspended" || status === "expired",
  };
}

function presentProfile(row: Record<string, unknown>): PublicMemoryItem {
  const status = String(row.status);
  return {
    id: String(row.id),
    scope: "profile",
    subject_key: String(row.subject_key),
    statement: String(row.statement),
    status,
    active: status === "vigente",
    positive_evidence_refs: asStringArray(row.positive_evidence_refs),
    negative_evidence_refs: asStringArray(row.negative_evidence_refs),
    positive_evidence_count: Number(row.positive_evidence_count ?? 0),
    negative_evidence_count: Number(row.negative_evidence_count ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    last_used_at: null,
    can_reactivate: status === "suspendido" || status === "caducado",
  };
}

function presentPreference(row: Record<string, unknown>): PublicMemoryItem {
  const status = String(row.status);
  return {
    id: String(row.id),
    scope: "preference",
    subject_key: String(row.key),
    statement: describePreference(row.key, row.value),
    status,
    active: status === "activa",
    positive_evidence_refs: asStringArray(row.positive_evidence_refs),
    negative_evidence_refs: asStringArray(row.negative_evidence_refs),
    positive_evidence_count: Number(row.positive_evidence_count ?? 0),
    negative_evidence_count: Number(row.negative_evidence_count ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    last_used_at: row.last_observed_at ? String(row.last_observed_at) : null,
    can_reactivate: false,
  };
}

function presentByScope(scope: MemoryScope, row: Record<string, unknown>) {
  if (scope === "classification") return presentClassification(row);
  if (scope === "profile") return presentProfile(row);
  return presentPreference(row);
}

function describePreference(key: unknown, value: unknown): string {
  const readableValue = typeof value === "string" ? value : JSON.stringify(value);
  return `${String(key)}: ${readableValue}`;
}

function fromStoredScope(scope: StoredScope): MemoryScope {
  if (scope === "clasificacion") return "classification";
  if (scope === "perfil") return "profile";
  return "preference";
}

function readStatus(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const status = record.lifecycle_status ?? record.status;
  return typeof status === "string" ? status : null;
}

function mapOperationError(message: string): MemoryRepositoryError {
  if (/NOT_FOUND/.test(message)) {
    return new MemoryRepositoryError("NOT_FOUND", "Eso ya no está en mi memoria.");
  }
  if (/IDEMPOTENCY_CONFLICT/.test(message)) {
    return new MemoryRepositoryError("CONFLICT", "La clave ya se usó con otros datos.");
  }
  if (/UNDO_WINDOW_EXPIRED/.test(message)) {
    return new MemoryRepositoryError(
      "UNDO_EXPIRED",
      "Ese cambio es de hace más de un mes y ya no puedo deshacerlo.",
    );
  }
  return new MemoryRepositoryError("INVALID_OPERATION", message);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MEMORY_OPERATION_RESULT_INVALID");
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function callRpc(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: { message: string } | null }> {
  const rpc = client.rpc as unknown as (
    functionName: string,
    functionArgs: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  return rpc(name, args);
}
