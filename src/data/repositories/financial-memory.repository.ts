import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createMemoryEmbedding,
  toVectorLiteral,
} from "@/agents/runtime/openai-embeddings";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";
import { createSemanticRecallAvailability } from "./semantic-recall-availability";

type Client = SupabaseClient<Database>;

/**
 * Columnas explicitas en vez de `*`: desde
 * `070_financial_memory_semantic_recall.sql` la tabla tiene un `vector(1536)`
 * que PostgREST serializa como texto. Traerlo en cada turno serian cientos de
 * kilobytes por nada —el vector solo sirve dentro de Postgres, para ordenar—.
 */
const MEMORY_COLUMNS =
  "id,user_id,kind,canonical_key,summary,search_terms,evidence_source,evidence_ref,confidence,confirmation_status,lifecycle_status,sensitivity,valid_until,superseded_at,positive_evidence_refs,negative_evidence_refs,positive_evidence_count,negative_evidence_count,explanation,review_at,last_used_at,suspended_at,revoked_at,revoked_reason,sensitive_confirmed_at,source_candidate_id,supersedes_memory_id,created_at,updated_at,metadata";

/** Las cuatro columnas de `070` que nunca viajan al proceso: son indice, no dato. */
const EMBEDDING_COLUMNS = [
  "embedding",
  "embedding_model",
  "embedding_input_hash",
  "embedding_generated_at",
] as const;

/**
 * Fila tal como la ve este modulo: sin las columnas del vector. Las RPC de
 * `044` devuelven la fila entera como `json`, asi que el vector podria colarse
 * en un objeto que despues viaja al Context Pack del modelo.
 */
export type FinancialMemoryRow = Omit<
  Database["public"]["Tables"]["financial_memory_items"]["Row"],
  (typeof EMBEDDING_COLUMNS)[number]
>;

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

/**
 * `RUL-MEM-15`: la memoria se recupera por significado, no por letra.
 *
 * Hasta aqui el unico criterio era coincidencia literal de tokens, asi que un
 * recuerdo guardado como "el usuario prefiere respuestas cortas" no aparecia
 * nunca ante "no te enrolles tanto": no comparten ni una palabra. La memoria
 * estaba bien construida y mal recuperada.
 *
 * El orden de las capas es deliberado y **no cambia**:
 *   1. consentimiento (`getLearningPreferences`) — si el aprendizaje esta
 *      apagado no se recupera nada, igual que antes;
 *   2. gobierno (`confirmation_status`, `lifecycle_status`, `superseded_at`,
 *      `valid_until`) — la misma consulta de siempre, con los mismos filtros;
 *   3. relevancia — aqui, y solo aqui, entra el vector.
 *
 * El ranking semantico decide *cuales* de los recuerdos ya autorizados se
 * miran, nunca *si* estan autorizados. Si el vector no esta disponible por el
 * motivo que sea —migracion sin aplicar, recuerdos sin embebir todavia, la API
 * de embeddings caida o apagada— la busqueda cae al emparejamiento por tokens
 * de siempre en vez de quedarse muda.
 */
export async function searchConfirmedFinancialMemory(
  client: Client,
  input: { userId: string; queryText: string; limit?: number; now?: string }
): Promise<FinancialMemoryItem[]> {
  try {
    const now = input.now ?? new Date().toISOString();
    const limit = input.limit ?? 12;
    const preferences = await getLearningPreferences(client, input.userId);
    if (!preferences.enabled) return [];

    const ranking = await resolveSemanticRanking(client, {
      userId: input.userId,
      queryText: input.queryText,
      now,
      limit,
    });

    const governed = client
      .from("financial_memory_items")
      .select(MEMORY_COLUMNS)
      .eq("user_id", input.userId)
      .eq("confirmation_status", "confirmed")
      .eq("lifecycle_status", "confirmed")
      .is("superseded_at", null)
      .or(`valid_until.is.null,valid_until.gt.${now}`);

    // Con ranking se leen exactamente los candidatos semanticos, ya filtrados
    // por gobierno. Sin ranking se conserva la ventana historica de siempre.
    const { data, error } = ranking
      ? await governed.in("id", [...ranking.keys()])
      : await governed.order("updated_at", { ascending: false }).limit(100);

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
      .map((item) => ({
        item,
        score: ranking
          ? (ranking.get(item.id) ?? 0)
          : scoreItem(item, tokens),
      }))
      .filter(({ score }) =>
        ranking ? true : tokens.length === 0 || score > 0,
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ item }) => item);
  } catch (error) {
    logger.warn("financial_memory.search_failed", {
      error,
      user_id: input.userId,
    });
    return [];
  }
}

/**
 * `070_financial_memory_semantic_recall.sql` puede no estar aplicada cuando el
 * codigo ya esta desplegado, y tambien al reves. Este modulo funciona en los
 * dos ordenes: mientras la funcion no exista se anota `absent`, se deja de
 * preguntar por un rato y la busqueda sigue por tokens.
 *
 * Degradar aqui es seguro porque el ranking semantico no autoriza nada: el
 * consentimiento y el gobierno se evaluan igual con vector o sin el.
 */
const semanticRecall = createSemanticRecallAvailability({
  functionName: "search_financial_memory_semantic",
  migration: "070_financial_memory_semantic_recall.sql",
});

/** Solo para pruebas: vuelve a preguntar si la busqueda semantica existe. */
export function resetFinancialMemorySemanticRecallCache(): void {
  semanticRecall.reset();
}

export function isFinancialMemorySemanticRecallAvailable(): boolean {
  return semanticRecall.isAvailable();
}

/**
 * Piso de similitud coseno. Sin el, el vecino mas cercano siempre existe y
 * cualquier turno arrastraria recuerdos sin relacion: el fallo opuesto al que
 * esto viene a arreglar. Con `text-embedding-3-small` dos frases en español sin
 * relacion quedan bastante por debajo de este valor y una parafrasis real
 * queda holgadamente por encima.
 */
const MIN_SEMANTIC_SIMILARITY = 0.25;

/**
 * Devuelve `id -> similitud` para los candidatos semanticos, o `null` cuando no
 * hay camino semantico disponible y hay que caer al emparejamiento por tokens.
 */
async function resolveSemanticRanking(
  client: Client,
  input: { userId: string; queryText: string; now: string; limit: number },
): Promise<Map<string, number> | null> {
  if (!isFinancialMemorySemanticRecallAvailable()) return null;
  const queryText = input.queryText.trim();
  // Sin texto no hay nada que parecerse: es el resumen de contexto del usuario,
  // que pide los recuerdos mas recientes y no una busqueda.
  if (!queryText) return null;

  const embedding = await createMemoryEmbedding(queryText);
  if (!embedding) return null;

  const { data, error } = await client.rpc(
    "search_financial_memory_semantic",
    {
      p_user_id: input.userId,
      p_query_embedding: toVectorLiteral(embedding.vector),
      p_now: input.now,
      // Se piden mas candidatos que los que se devuelven: los filtros de
      // consentimiento (narrativa y sensibilidad) todavia pueden descartar
      // varios y no queremos quedarnos cortos por eso.
      p_limit: Math.min(Math.max(input.limit * 2, 12), 100),
    },
  );

  if (error) {
    if (!semanticRecall.markAbsentIfMissing(error)) {
      logger.warn("financial_memory.semantic_ranking_failed", {
        error,
        user_id: input.userId,
      });
    }
    return null;
  }

  semanticRecall.markPresent();
  const ranked = (data ?? []).filter(
    (row) => Number(row.similarity) >= MIN_SEMANTIC_SIMILARITY,
  );
  // Sin candidatos vectoriales (nadie embebido todavia, o nada parecido) la
  // busqueda por tokens sigue siendo mejor que devolver vacio.
  if (ranked.length === 0) return null;
  return new Map(ranked.map((row) => [row.id, Number(row.similarity)]));
}

/**
 * Texto que se embebe. `summary` lleva el significado; `canonical_key` ancla el
 * tema aunque el resumen este redactado de forma indirecta; y `search_terms`
 * son las parafrasis que el propio agente de aprendizaje eligio, que es
 * exactamente lo que una busqueda por significado quiere ver.
 */
export function buildEmbeddingInput(memory: {
  summary: string;
  canonical_key: string;
  search_terms: string[];
}): string {
  return [
    memory.summary,
    memory.canonical_key,
    ...(memory.search_terms ?? []),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

/**
 * Calcula y guarda el vector de un recuerdo recien creado o corregido. Nunca
 * lanza y nunca es condicion de exito de la escritura del recuerdo: un
 * recuerdo sin vector sigue siendo un recuerdo valido, solo se recupera por
 * tokens hasta que el backfill lo alcance.
 */
export async function rememberFinancialMemoryEmbedding(
  client: Client,
  memory: FinancialMemoryItem,
): Promise<boolean> {
  if (!isFinancialMemorySemanticRecallAvailable()) return false;
  try {
    const text = buildEmbeddingInput(memory);
    if (!text) return false;
    const embedding = await createMemoryEmbedding(text);
    if (!embedding) return false;

    const { data, error } = await client
      .from("financial_memory_items")
      .update({
        embedding: toVectorLiteral(embedding.vector),
        embedding_model: embedding.model,
        embedding_input_hash: hashEmbeddingInput(text),
        embedding_generated_at: new Date().toISOString(),
      })
      .eq("id", memory.id)
      .eq("user_id", memory.user_id)
      .select("id");

    if (error) {
      if (semanticRecall.markAbsentIfMissing(error)) return false;
      throw error;
    }
    if (!data || data.length === 0) {
      // El cliente no tiene permiso de escritura sobre la tabla (RLS la cierra
      // para `authenticated`). No es un fallo del turno, pero sin esto el
      // recuerdo se queda sin vector para siempre y nadie se entera.
      logger.warn("financial_memory.embedding_not_written", {
        user_id: memory.user_id,
        memory_id: memory.id,
      });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("financial_memory.embedding_write_failed", {
      error,
      user_id: memory.user_id,
      memory_id: memory.id,
    });
    return false;
  }
}

/**
 * FNV-1a. Detecta que el texto del recuerdo cambio, no protege nada: no hace
 * falta traer `node:crypto` a un modulo que tambien se empaqueta para runtimes
 * sin el.
 */
export function hashEmbeddingInput(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
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
    .select(MEMORY_COLUMNS)
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
  const result: ManageFinancialMemoryResult = {
    memory: normalizeItem(
      data.memory as Database["public"]["Tables"]["financial_memory_items"]["Row"],
    ),
    replacement: data.replacement
      ? normalizeItem(
          data.replacement as Database["public"]["Tables"]["financial_memory_items"]["Row"],
        )
      : null,
  };

  // `RUL-MEM-15`: corregir un recuerdo cambia su significado, asi que su vector
  // viejo deja de servir. El reemplazo nace sin vector y hay que darselo aqui,
  // o queda invisible para la busqueda semantica hasta el proximo backfill.
  if (input.action === "correct" && result.replacement) {
    await rememberFinancialMemoryEmbedding(client, result.replacement);
  }
  return result;
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

function normalizeItem(row: FinancialMemoryRow): FinancialMemoryItem {
  return {
    ...withoutEmbeddingColumns(row),
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

/**
 * Una fila que llega por RPC trae el vector aunque el tipo no lo declare. Se
 * quita antes de que el objeto exista, no despues.
 */
export function withoutEmbeddingColumns<T extends object>(row: T): T {
  const copy = { ...row } as Record<string, unknown>;
  for (const column of EMBEDDING_COLUMNS) delete copy[column];
  return copy as T;
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
