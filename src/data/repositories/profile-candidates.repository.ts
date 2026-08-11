import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/data/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * Lado de datos del perfil conversacional (`075`). Todo pasa por RPC de
 * `service_role` y no por escrituras sueltas, por una razon concreta: observar
 * un hecho no es un `insert`. Hay que mirar la lapida, el hecho ya vigente y el
 * candidato ya decidido en la misma transaccion en que se escribe, o el motor
 * pisa lo que el usuario acaba de decidir en `/configuracion/memoria`.
 *
 * Ninguna funcion de aqui crea un hecho de perfil. `user_profile_facts` solo se
 * escribe desde `resolve_profile_candidate`, que exige una decision del usuario
 * (`AC-MEM-03`, `WEB-D023`).
 */

export type ProfileCandidateRow = {
  id: string;
  subject_key: string;
  statement: string;
  status: string;
  ask_count: number;
  evidence_refs: string[];
  last_asked_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Por que la observacion no abrio candidato. Nunca se le muestra al usuario. */
export type ProfileObservationReason =
  | "created"
  | "reinforced"
  | "tombstoned"
  | "fact_already_known"
  | "already_resolved";

export type ProfileObservationResult = {
  candidate: ProfileCandidateRow | null;
  reason: ProfileObservationReason;
};

export async function recordProfileCandidateObservation(
  client: Client,
  input: {
    userId: string;
    subjectKey: string;
    statement: string;
    evidenceRef: string;
    metadata: Record<string, unknown>;
    now?: string;
  },
): Promise<ProfileObservationResult> {
  const { data, error } = await callRpc(
    client,
    "record_profile_candidate_observation",
    {
      p_user_id: input.userId,
      p_subject_key: input.subjectKey,
      p_statement: input.statement,
      p_evidence_ref: input.evidenceRef,
      p_metadata: input.metadata,
      p_now: input.now ?? new Date().toISOString(),
    },
  );
  if (error) throw new Error(error.message);
  return readObservationResult(data);
}

/**
 * Candidatos que todavia pueden preguntarse, mas viejo primero. El orden lo fija
 * aqui quien lee y no el gate: `decidirConfirmacionDePerfil` documenta que
 * `candidatos` ya viene ordenado por quien llama, y el desempate estable es el
 * orden de llegada.
 */
export async function listOpenProfileCandidates(
  client: Client,
  input: { userId: string; limit?: number },
): Promise<ProfileCandidateRow[]> {
  const { data, error } = await client
    .from("user_profile_candidates")
    .select(
      "id,subject_key,statement,status,ask_count,evidence_refs,last_asked_at,metadata,created_at",
    )
    .eq("user_id", input.userId)
    .in("status", ["observado", "pending_confirmation"])
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(input.limit ?? 20, 1), 100));
  if (error) throw error;
  return (data ?? []).map(normalizeCandidate);
}

export type ProfileFactRow = {
  id: string;
  subject_key: string;
  statement: string;
  origin: string;
  status: string;
  validity: string;
  last_confirmed_at: string | null;
};

/**
 * Los hechos que el usuario ya confirmo, mas los que quedaron en duda. Es lo
 * unico del perfil que puede usarse para razonar (`AC-MEM-04`); los candidatos
 * se leen aparte justamente para que no se confundan.
 */
export async function listActiveProfileFacts(
  client: Client,
  input: { userId: string; limit?: number },
): Promise<ProfileFactRow[]> {
  const { data, error } = await client
    .from("user_profile_facts")
    .select("id,subject_key,statement,origin,status,validity,last_confirmed_at")
    .eq("user_id", input.userId)
    .in("status", ["vigente", "en_duda"])
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 40, 1), 100));
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    subject_key: String(row.subject_key),
    statement: String(row.statement),
    origin: String(row.origin),
    status: String(row.status),
    validity: String(row.validity),
    last_confirmed_at:
      typeof row.last_confirmed_at === "string" ? row.last_confirmed_at : null,
  }));
}

export async function markProfileCandidateAsked(
  client: Client,
  input: {
    userId: string;
    candidateId: string;
    /**
     * `id` de `conversation_memory_state`. Es lo que hace cumplible "una sola
     * confirmacion por conversacion" (`AC-PERF-02`) sin un contador aparte: la
     * conversacion **es** esa fila.
     */
    conversationStateId: string;
    now?: string;
  },
): Promise<ProfileCandidateRow | null> {
  const { data, error } = await callRpc(
    client,
    "mark_profile_candidate_asked",
    {
      p_user_id: input.userId,
      p_candidate_id: input.candidateId,
      p_conversation_state_id: input.conversationStateId,
      p_now: input.now ?? new Date().toISOString(),
    },
  );
  if (error) throw new Error(error.message);
  return readObservationResult(data).candidate;
}

export type ProfileCandidateResolution = "confirm" | "reject" | "never_ask";

/**
 * `AC-PERF-02`: promueve, rechaza o silencia un candidato desde el motor
 * conversacional, que corre con el cliente de servicio y no tiene sesion. La
 * logica de confirmacion sigue siendo la de `resolve_profile_candidate`; esta
 * variante solo le presta el `user_id`.
 */
export async function resolveProfileCandidateForUser(
  client: Client,
  input: {
    userId: string;
    candidateId: string;
    resolution: ProfileCandidateResolution;
    statement?: string;
    idempotencyKey: string;
  },
): Promise<{ resolved: boolean; promotedFactId: string | null }> {
  const { data, error } = await callRpc(
    client,
    "resolve_profile_candidate_for_user",
    {
      p_user_id: input.userId,
      p_candidate_id: input.candidateId,
      p_resolution: input.resolution,
      p_statement: input.statement ?? "",
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error) throw new Error(error.message);
  const record = asRecord(data);
  const fact = record.fact ? asRecord(record.fact) : null;
  return {
    resolved: true,
    promotedFactId: fact && typeof fact.id === "string" ? fact.id : null,
  };
}

/**
 * Los RPC de `075` son nuevos y todavia no estan en los tipos generados de
 * Supabase. Mismo puente que usa `memory.repository.ts` para
 * `commit_profile_memory_operation`: se llama por nombre y se valida la
 * respuesta al leerla, en vez de mentirle al tipo generado.
 */
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

function readObservationResult(data: unknown): ProfileObservationResult {
  const record = asRecord(data);
  const candidate = record.candidate ? asRecord(record.candidate) : null;
  return {
    candidate: candidate ? normalizeCandidate(candidate) : null,
    reason: (record.reason as ProfileObservationReason) ?? "already_resolved",
  };
}

function normalizeCandidate(row: Record<string, unknown>): ProfileCandidateRow {
  return {
    id: String(row.id),
    subject_key: String(row.subject_key),
    statement: String(row.statement),
    status: String(row.status),
    ask_count: Number(row.ask_count ?? 0),
    evidence_refs: Array.isArray(row.evidence_refs)
      ? row.evidence_refs.map((value) => String(value))
      : [],
    last_asked_at:
      typeof row.last_asked_at === "string" ? row.last_asked_at : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
