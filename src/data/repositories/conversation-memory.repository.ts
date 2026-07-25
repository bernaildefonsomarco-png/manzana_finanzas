import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConversationDateRange,
  ConversationQueryKind,
  ConversationReferencedMovement,
  ConversationWorkingSet,
} from "@/agents/conversation-agent";
import { ConversationWorkingSetSchema } from "@/agents/conversation-agent";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type ConversationMemoryChannel = "whatsapp" | "dashboard";

export type ConversationMemoryState = {
  id: string;
  user_id: string;
  channel: ConversationMemoryChannel;
  scope: string;
  last_intent: string | null;
  last_query_kind: ConversationQueryKind | null;
  last_query_text: string | null;
  last_query_date_range: ConversationDateRange | null;
  last_tool_name: string | null;
  last_result_summary: string | null;
  referenced_movements: ConversationReferencedMovement[];
  referenced_entities: Array<Record<string, unknown>>;
  continuity_hint: string | null;
  source_ref: string | null;
  expires_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  working_set: ConversationWorkingSet | null;
};

export type UpsertConversationMemoryStateInput = {
  userId: string;
  channel: ConversationMemoryChannel;
  scope?: string;
  lastIntent: string | null;
  lastQueryKind: ConversationQueryKind | null;
  lastQueryText: string | null;
  lastQueryDateRange: ConversationDateRange | null;
  lastToolName: string | null;
  lastResultSummary: string | null;
  referencedMovements: ConversationReferencedMovement[];
  referencedEntities?: Array<Record<string, unknown>>;
  continuityHint: string | null;
  sourceRef?: string | null;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

const DEFAULT_SCOPE = "default";
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_REFERENCED_MOVEMENTS = 10;

export async function getActiveConversationMemoryState(
  client: Client,
  input: {
    userId: string;
    channel: ConversationMemoryChannel;
    scope?: string;
    now?: string;
  }
): Promise<ConversationMemoryState | null> {
  try {
    const now = input.now ?? new Date().toISOString();
    const { data, error } = await client
      .from("conversation_memory_states")
      .select("*")
      .eq("user_id", input.userId)
      .eq("scope", input.scope ?? DEFAULT_SCOPE)
      .gt("expires_at", now)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeMemoryState(data) : null;
  } catch (error) {
    logger.warn("conversation_memory.read_failed", {
      error,
      user_id: input.userId,
      channel: input.channel,
    });
    return null;
  }
}

export async function upsertConversationMemoryState(
  client: Client,
  input: UpsertConversationMemoryStateInput
): Promise<ConversationMemoryState | null> {
  try {
    const expiresAt =
      input.expiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS).toISOString();
    const { data, error } = await client
      .from("conversation_memory_states")
      .upsert(
        {
          user_id: input.userId,
          channel: input.channel,
          scope: input.scope ?? DEFAULT_SCOPE,
          last_intent: input.lastIntent,
          last_query_kind: input.lastQueryKind,
          last_query_text: input.lastQueryText,
          last_query_date_range: input.lastQueryDateRange as unknown as Json,
          last_tool_name: input.lastToolName,
          last_result_summary: input.lastResultSummary,
          referenced_movements: input.referencedMovements
            .slice(0, MAX_REFERENCED_MOVEMENTS) as unknown as Json,
          referenced_entities: (input.referencedEntities ?? []) as unknown as Json,
          continuity_hint: input.continuityHint,
          source_ref: input.sourceRef ?? null,
          expires_at: expiresAt,
          metadata: (input.metadata ?? {}) as Json,
        },
        { onConflict: "user_id,scope" }
      )
      .select("*")
      .single();

    if (error) throw error;
    return normalizeMemoryState(data);
  } catch (error) {
    logger.warn("conversation_memory.write_failed", {
      error,
      user_id: input.userId,
      channel: input.channel,
    });
    return null;
  }
}

function normalizeMemoryState(
  row: Database["public"]["Tables"]["conversation_memory_states"]["Row"]
): ConversationMemoryState {
  return {
    id: row.id,
    user_id: row.user_id,
    channel: row.channel as ConversationMemoryChannel,
    scope: row.scope,
    last_intent: row.last_intent,
    last_query_kind: isConversationQueryKind(row.last_query_kind)
      ? row.last_query_kind
      : null,
    last_query_text: row.last_query_text,
    last_query_date_range: normalizeDateRange(row.last_query_date_range),
    last_tool_name: row.last_tool_name,
    last_result_summary: row.last_result_summary,
    referenced_movements: normalizeReferencedMovements(row.referenced_movements),
    referenced_entities: normalizeObjectArray(row.referenced_entities),
    continuity_hint: row.continuity_hint,
    source_ref: row.source_ref,
    expires_at: row.expires_at,
    updated_at: row.updated_at,
    metadata: normalizeObject(row.metadata),
    working_set: normalizeWorkingSet(row.metadata),
  };
}

function normalizeWorkingSet(value: Json): ConversationWorkingSet | null {
  const metadata = normalizeObject(value);
  const parsed = ConversationWorkingSetSchema.safeParse(metadata.working_set);
  return parsed.success ? parsed.data : null;
}

function isConversationQueryKind(
  value: unknown
): value is ConversationQueryKind {
  return (
    value === "balance_snapshot" ||
    value === "movement_search" ||
    value === "pending_summary" ||
    value === "debt_summary" ||
    value === "recurring_summary" ||
    value === "financial_memory_search" ||
    value === "unsupported"
  );
}

function normalizeDateRange(value: Json | null): ConversationDateRange | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.start !== "string" ||
    typeof record.end !== "string" ||
    typeof record.label !== "string"
  ) {
    return null;
  }

  return {
    start: record.start,
    end: record.end,
    label: record.label,
  };
}

function normalizeReferencedMovements(value: Json): ConversationReferencedMovement[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): ConversationReferencedMovement | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      if (typeof record.id !== "string") return null;
      return {
        id: record.id,
        type: typeof record.type === "string" ? record.type : "movimiento",
        amount: typeof record.amount === "number" ? record.amount : 0,
        currency: record.currency === "USD" ? "USD" : "PEN",
        description:
          typeof record.description === "string" ? record.description : null,
        merchant: typeof record.merchant === "string" ? record.merchant : null,
        category_id:
          typeof record.category_id === "string" ? record.category_id : null,
        category_label:
          typeof record.category_label === "string"
            ? record.category_label
            : null,
        occurred_at:
          typeof record.occurred_at === "string" ? record.occurred_at : null,
        source: typeof record.source === "string" ? record.source : null,
        source_ref:
          typeof record.source_ref === "string" ? record.source_ref : null,
        account_origin_id:
          typeof record.account_origin_id === "string"
            ? record.account_origin_id
            : null,
        account_origin_name:
          typeof record.account_origin_name === "string"
            ? record.account_origin_name
            : null,
        account_destination_id:
          typeof record.account_destination_id === "string"
            ? record.account_destination_id
            : null,
        account_destination_name:
          typeof record.account_destination_name === "string"
            ? record.account_destination_name
            : null,
        confidence:
          typeof record.confidence === "number" ? record.confidence : null,
        requires_review: record.requires_review === true,
      };
    })
    .filter((item): item is ConversationReferencedMovement => item !== null);
}

function normalizeObjectArray(value: Json): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(
    (item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && !Array.isArray(item))
  );
}

function normalizeObject(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
