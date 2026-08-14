import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import type {
  Category,
  CategoryId,
  MovementType,
  RelatedPerson,
  Tag,
  UserSubcategory,
} from "@/shared/types/domain";
import {
  aggregateCategoryTotals,
  type CategoryTotal,
  type SubcategoryCount,
} from "@/core/classification/category-totals";
import { toIsoDate, todayInLima, limaLocalInputToUtcIso } from "@/shared/dates/lima";

type Client = SupabaseClient<Database>;

export type ClassificationCatalog = {
  version: "v1";
  categories: Category[];
  subcategories: UserSubcategory[];
  tags: Tag[];
  related_people: RelatedPerson[];
};

export function normalizeClassificationKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export async function getClassificationCatalog(
  client: Client,
  userId: string,
): Promise<ClassificationCatalog> {
  const [categories, subcategories, tags, relatedPeople] = await Promise.all([
    client.from("categories").select("*").order("sort_order"),
    client
      .from("user_subcategories")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("label"),
    client
      .from("tags")
      .select("*")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .is("deleted_at", null)
      .order("is_system", { ascending: false })
      .order("label"),
    client
      .from("related_persons")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  ]);

  for (const result of [categories, subcategories, tags, relatedPeople]) {
    if (result.error) throw result.error;
  }

  return {
    version: "v1",
    categories: (categories.data ?? []) as Category[],
    subcategories: (subcategories.data ?? []) as UserSubcategory[],
    tags: (tags.data ?? []) as Tag[],
    related_people: (relatedPeople.data ?? []) as RelatedPerson[],
  };
}

/** Rango `[inicio, fin)` del mes de calendario actual en `America/Lima`, en UTC. */
function currentLimaMonthRangeUtc(): { startUtc: string; endUtc: string } {
  const today = todayInLima();
  const nextMonth = today.month === 11 ? 0 : today.month + 1;
  const nextYear = today.month === 11 ? today.year + 1 : today.year;

  return {
    startUtc: limaLocalInputToUtcIso(`${toIsoDate(today.year, today.month, 1)}T00:00`),
    endUtc: limaLocalInputToUtcIso(`${toIsoDate(nextYear, nextMonth, 1)}T00:00`),
  };
}

/**
 * `25` §10 (`GET /categories`: "Las 12 con totales del periodo"), `09` §7
 * (periodo mensual por defecto). Excluye los tipos de `RUL-CAT-11` en
 * `aggregateCategoryTotals`, y separa `sin_clasificar` de `otros`.
 */
export async function getCategoryTotalsForCurrentPeriod(
  client: Client,
  userId: string
): Promise<CategoryTotal[]> {
  const { startUtc, endUtc } = currentLimaMonthRangeUtc();

  const { data, error } = await client
    .from("movements")
    .select("type, category_id, amount")
    .eq("user_id", userId)
    .in("status", ["confirmed", "needs_review", "corrected"])
    .gte("occurred_at", startUtc)
    .lt("occurred_at", endUtc);

  if (error) throw error;

  return aggregateCategoryTotals(
    (data ?? []).map((row) => ({
      type: row.type as MovementType,
      category_id: row.category_id as CategoryId | null,
      amount: Number(row.amount),
    }))
  );
}

/**
 * SCR-CAT-02/03: conteo de movimientos por subcategoría del usuario
 * (migración 050, `count_movements_by_subcategory`; RLS via `auth.uid()`
 * hace que el cliente deba ser el autenticado, nunca el de servicio).
 */
export async function getSubcategoryMovementCounts(client: Client): Promise<SubcategoryCount[]> {
  const { data, error } = await client.rpc("count_movements_by_subcategory");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    subcategory_id: row.subcategory_id,
    movement_count: Number(row.movement_count),
  }));
}

export async function insertSubcategory(
  client: Client,
  input: { userId: string; categoryId: CategoryId; label: string; createdBy: string },
): Promise<UserSubcategory> {
  const { data, error } = await client
    .from("user_subcategories")
    .insert({
      user_id: input.userId,
      category_id: input.categoryId,
      label: input.label.trim(),
      normalized_label: normalizeClassificationKey(input.label),
      created_by: input.createdBy,
      metadata: {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as UserSubcategory;
}

/**
 * Busca la subcategoria activa del usuario que ya ocupa esa etiqueta dentro de
 * esa categoria. Es la lectura previa de la escritura conversacional
 * (`RUL-ESTR-03`): la constraint `user_subcategories_unique_label` de `003` ya
 * impide el duplicado, pero solo sabe fallar. Preguntar antes permite
 * distinguir el reenvio del mismo boton —que es "eso ya estaba hecho"— de un
 * choque de verdad, que es otra cosa que contar.
 *
 * Compara por `normalized_label` y no por `label` porque esa es la columna que
 * la unicidad mira: "Animales", "animales" y "ANIMALES" son la misma.
 */
export async function findSubcategoryByLabel(
  client: Client,
  input: { userId: string; categoryId: CategoryId; label: string },
): Promise<UserSubcategory | null> {
  const { data, error } = await client
    .from("user_subcategories")
    .select("*")
    .eq("user_id", input.userId)
    .eq("category_id", input.categoryId)
    .eq("normalized_label", normalizeClassificationKey(input.label))
    .is("deleted_at", null)
    .limit(1);

  if (error) throw error;
  return ((data ?? []) as UserSubcategory[])[0] ?? null;
}

/** Una subcategoria activa del usuario por su id, o `null` si no es suya. */
export async function getSubcategoryById(
  client: Client,
  userId: string,
  id: string,
): Promise<UserSubcategory | null> {
  const { data, error } = await client
    .from("user_subcategories")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .is("deleted_at", null)
    .limit(1);

  if (error) throw error;
  return ((data ?? []) as UserSubcategory[])[0] ?? null;
}

export async function updateSubcategory(
  client: Client,
  input: { userId: string; id: string; label?: string; archive?: boolean },
): Promise<UserSubcategory> {
  const patch: Database["public"]["Tables"]["user_subcategories"]["Update"] = {};
  if (input.label) {
    patch.label = input.label.trim();
    patch.normalized_label = normalizeClassificationKey(input.label);
  }
  if (input.archive) patch.deleted_at = new Date().toISOString();
  const { data, error } = await client
    .from("user_subcategories")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) throw error;
  return data as UserSubcategory;
}

export async function insertTag(
  client: Client,
  input: { userId: string; label: string },
): Promise<Tag> {
  const { data, error } = await client
    .from("tags")
    .insert({
      user_id: input.userId,
      key: normalizeClassificationKey(input.label),
      label: input.label.trim(),
      type: "custom",
      is_system: false,
      metadata: {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Tag;
}

export async function updateTag(
  client: Client,
  input: { userId: string; id: string; label?: string; archive?: boolean },
): Promise<Tag> {
  const patch: Database["public"]["Tables"]["tags"]["Update"] = {};
  if (input.label) {
    patch.label = input.label.trim();
    patch.key = normalizeClassificationKey(input.label);
  }
  if (input.archive) patch.deleted_at = new Date().toISOString();
  const { data, error } = await client
    .from("tags")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .eq("is_system", false)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) throw error;
  return data as Tag;
}

export async function insertRelatedPerson(
  client: Client,
  input: {
    userId: string;
    displayName: string;
    kind: string;
    relationshipLabel: string | null;
  },
): Promise<RelatedPerson> {
  const { data, error } = await client
    .from("related_persons")
    .insert({
      user_id: input.userId,
      display_name: input.displayName.trim(),
      normalized_name: normalizeClassificationKey(input.displayName),
      kind: input.kind,
      relationship_label: input.relationshipLabel,
      metadata: {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as RelatedPerson;
}

export async function updateRelatedPerson(
  client: Client,
  input: {
    userId: string;
    id: string;
    displayName?: string;
    kind?: string;
    relationshipLabel?: string | null;
    archive?: boolean;
  },
): Promise<RelatedPerson> {
  const patch: Database["public"]["Tables"]["related_persons"]["Update"] = {};
  if (input.displayName) {
    patch.display_name = input.displayName.trim();
    patch.normalized_name = normalizeClassificationKey(input.displayName);
  }
  if (input.kind) patch.kind = input.kind;
  if (input.relationshipLabel !== undefined) {
    patch.relationship_label = input.relationshipLabel;
  }
  if (input.archive) patch.deleted_at = new Date().toISOString();
  const { data, error } = await client
    .from("related_persons")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) throw error;
  return data as RelatedPerson;
}

export async function validateMovementClassificationReferences(
  client: Client,
  input: {
    userId: string;
    subcategoryId: string | null;
    includeManuallyCorrected?: boolean;
    relatedPersonId: string | null;
    tagIds: string[];
  },
): Promise<void> {
  const checks: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];

  if (input.subcategoryId) {
    checks.push(
      client
        .from("user_subcategories")
        .select("id")
        .eq("id", input.subcategoryId)
        .eq("user_id", input.userId)
        .is("deleted_at", null)
        .single(),
    );
  }
  if (input.relatedPersonId) {
    checks.push(
      client
        .from("related_persons")
        .select("id")
        .eq("id", input.relatedPersonId)
        .eq("user_id", input.userId)
        .is("deleted_at", null)
        .single(),
    );
  }
  if (input.tagIds.length > 0) {
    const uniqueTagIds = [...new Set(input.tagIds)];
    const { data, error } = await client
      .from("tags")
      .select("id")
      .in("id", uniqueTagIds)
      .or(`user_id.is.null,user_id.eq.${input.userId}`)
      .is("deleted_at", null);
    if (error) throw error;
    if ((data ?? []).length !== uniqueTagIds.length) {
      throw new Error("Una o mas etiquetas no pertenecen al usuario.");
    }
  }

  const results = await Promise.all(checks);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function setMovementTags(
  client: Client,
  input: {
    userId: string;
    movementId: string;
    tagIds: string[];
    source: string;
  },
): Promise<{ id: string; movement_id: string; tag_ids: string[] }> {
  const { data: movement, error: movementError } = await client
    .from("movements")
    .select("id")
    .eq("id", input.movementId)
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .single();
  if (movementError) throw movementError;

  await validateMovementClassificationReferences(client, {
    userId: input.userId,
    subcategoryId: null,
    relatedPersonId: null,
    tagIds: input.tagIds,
  });

  const { error: deleteError } = await client
    .from("movement_tags")
    .delete()
    .eq("movement_id", movement.id);
  if (deleteError) throw deleteError;

  const uniqueTagIds = [...new Set(input.tagIds)];
  if (uniqueTagIds.length > 0) {
    const { error: insertError } = await client.from("movement_tags").insert(
      uniqueTagIds.map((tagId) => ({
        movement_id: movement.id,
        tag_id: tagId,
        source: input.source,
        confidence: 1,
        metadata: {},
      })),
    );
    if (insertError) throw insertError;
  }

  return { id: movement.id, movement_id: movement.id, tag_ids: uniqueTagIds };
}

export async function appendClassificationAudit(
  client: Client,
  input: {
    userId: string;
    entityType: string;
    entityId: string;
    action: "created" | "updated" | "deleted";
    actorType: "user" | "agent" | "system" | "worker";
    actorId: string | null;
    source: string;
    traceId: string;
    commandId: string;
    newValue: unknown;
    movementId?: string | null;
  },
): Promise<void> {
  const { error } = await client.from("movement_audit_log").insert({
    user_id: input.userId,
    movement_id: input.movementId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    field_name: null,
    old_value: null,
    new_value: input.newValue as Json,
    source: input.source,
    actor_type: input.actorType,
    actor_id: input.actorId,
    trace_id: input.traceId,
    metadata: { command_id: input.commandId },
  });
  if (error) throw error;
}

export type ClassificationOperationCode =
  | "MOVEMENT_NOT_FOUND"
  | "SUBCATEGORY_NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "CLASSIFICATION_BATCH_NOT_FOUND"
  | "CLASSIFICATION_BATCH_EMPTY"
  | "CLASSIFICATION_UNDO_EXPIRED"
  | "CLASSIFICATION_IDEMPOTENCY_CONFLICT"
  | "CLASSIFICATION_UNDO_ALREADY_APPLIED"
  | "SUBCATEGORY_MERGE_SELF"
  | "SUBCATEGORY_MERGE_CATEGORY_MISMATCH"
  | "SUBCATEGORY_UNDO_NAME_CONFLICT"
  | "MOVEMENT_TYPE_NOT_CLASSIFIABLE";

export class ClassificationOperationError extends Error {
  constructor(
    readonly code: ClassificationOperationCode,
    message: string,
  ) {
    super(message);
    this.name = "ClassificationOperationError";
  }
}

export type ClassificationBatchResult = {
  batch?: Record<string, unknown>;
  preview?: boolean;
  count?: number;
  sample?: Record<string, unknown> | null;
  movements?: Array<Record<string, unknown>>;
  excluded_count?: number;
  target_count_before?: number;
  target_count_after?: number;
  source?: Record<string, unknown>;
  target?: Record<string, unknown>;
  idempotent: boolean;
};

export async function classifyMovement(
  client: Client,
  input: {
    userId: string;
    movementId: string;
    categoryId: CategoryId | null;
    subcategoryId: string | null;
    idempotencyKey: string;
    traceId: string;
  },
): Promise<{ movement: Record<string, unknown>; idempotent: boolean }> {
  const { data, error } = await callUntypedRpc(client, "commit_movement_classification", {
    p_user_id: input.userId,
    p_movement_id: input.movementId,
    p_category_id: input.categoryId,
    p_subcategory_id: input.subcategoryId,
    p_idempotency_key: input.idempotencyKey,
    p_trace_id: input.traceId,
  });
  if (error) throw classificationOperationError(error);
  return asOperationResult(data) as { movement: Record<string, unknown>; idempotent: boolean };
}

export async function classifyMovementsInBulk(
  client: Client,
  input: {
    userId: string;
    movementIds: string[];
    excludedIds: string[];
    categoryId: CategoryId | null;
    subcategoryId: string | null;
    includeManuallyCorrected?: boolean;
    preview: boolean;
    idempotencyKey: string;
  },
): Promise<ClassificationBatchResult> {
  const { data, error } = await callUntypedRpc(client, "commit_classification_bulk", {
    p_user_id: input.userId,
    p_movement_ids: [...new Set(input.movementIds)],
    p_excluded_ids: [...new Set(input.excludedIds)],
    p_category_id: input.categoryId,
    p_subcategory_id: input.subcategoryId,
    p_include_manually_corrected: input.includeManuallyCorrected ?? false,
    p_preview: input.preview,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw classificationOperationError(error);
  return asOperationResult(data) as ClassificationBatchResult;
}

export async function undoClassificationBatch(
  client: Client,
  input: {
    userId: string;
    batchId: string;
    expectedKind: "bulk" | "merge";
    expectedSourceId?: string | null;
    idempotencyKey: string;
  },
): Promise<ClassificationBatchResult> {
  const { data, error } = await callUntypedRpc(client, "undo_classification_batch", {
    p_user_id: input.userId,
    p_batch_id: input.batchId,
    p_expected_kind: input.expectedKind,
    p_expected_source_id: input.expectedSourceId ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw classificationOperationError(error);
  return asOperationResult(data) as ClassificationBatchResult;
}

export async function mergeSubcategories(
  client: Client,
  input: {
    userId: string;
    sourceId: string;
    targetId: string;
    preview: boolean;
    idempotencyKey: string;
  },
): Promise<ClassificationBatchResult> {
  const { data, error } = await callUntypedRpc(client, "commit_subcategory_merge", {
    p_user_id: input.userId,
    p_source_id: input.sourceId,
    p_target_id: input.targetId,
    p_preview: input.preview,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw classificationOperationError(error);
  return asOperationResult(data) as ClassificationBatchResult;
}

export type ClassificationWhy = {
  movement: {
    id: string;
    category_id: string | null;
    subcategory_id: string | null;
  };
  explanation: string;
  evidence: Array<{
    polarity: "positive" | "negative";
    text: string;
    observed_at: string;
  }>;
  forget_targets: Array<{ memory_id: string; summary: string }>;
};

export async function getMovementClassificationWhy(
  client: Client,
  userId: string,
  movementId: string,
): Promise<ClassificationWhy | null> {
  const movementResult = await client
    .from("movements")
    .select("id,category_id,subcategory_id,description,merchant")
    .eq("user_id", userId)
    .eq("id", movementId)
    .is("deleted_at", null)
    .maybeSingle();
  if (movementResult.error) throw movementResult.error;
  if (!movementResult.data) return null;

  const evidenceResult = await client
    .from("learning_evidence")
    .select("candidate_id,polarity,source_type,observed_at,claim_value")
    .eq("user_id", userId)
    .eq("source_entity_type", "movement")
    .eq("source_entity_id", movementId)
    .order("observed_at", { ascending: false })
    .limit(20);
  if (evidenceResult.error) throw evidenceResult.error;

  const evidenceRows = evidenceResult.data ?? [];
  const candidateIds = [...new Set(
    evidenceRows
      .map((row) => row.candidate_id)
      .filter((value): value is string => Boolean(value)),
  )];
  const candidates = candidateIds.length === 0
    ? []
    : await readWhyCandidates(client, userId, candidateIds);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const memories = candidateIds.length === 0
    ? []
    : await readWhyMemories(client, userId, candidateIds);
  const subject = movementResult.data.merchant ?? movementResult.data.description ?? "este movimiento";
  const visibleEvidence = evidenceRows.map((row) => ({
    polarity: row.polarity as "positive" | "negative",
    text: row.polarity === "negative"
      ? `Corregiste una clasificacion anterior de ${subject}.`
      : `Elegiste esta clasificacion para ${subject}.`,
    observed_at: row.observed_at,
  }));
  const latestPositive = evidenceRows.find((row) => row.polarity === "positive");
  const latestCandidate = latestPositive?.candidate_id
    ? candidateById.get(latestPositive.candidate_id)
    : undefined;

  return {
    movement: {
      id: movementResult.data.id,
      category_id: movementResult.data.category_id,
      subcategory_id: movementResult.data.subcategory_id,
    },
    explanation: latestCandidate?.proposal_summary
      ?? (visibleEvidence.length > 0
        ? `Esta clasificacion viene de una correccion que confirmaste para ${subject}.`
        : "No encontre un aprendizaje aplicado: esta clasificacion pudo elegirse directamente."),
    evidence: visibleEvidence,
    forget_targets: memories
      .map((memory) => ({
        memory_id: memory.id,
        summary: memory.summary,
      })),
  };
}

async function readWhyCandidates(client: Client, userId: string, ids: string[]) {
  const { data, error } = await client
    .from("learning_candidates")
    .select("id,proposal_summary,status")
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

async function readWhyMemories(client: Client, userId: string, candidateIds: string[]) {
  const { data, error } = await client
    .from("financial_memory_items")
    .select("id,summary,source_candidate_id,lifecycle_status")
    .eq("user_id", userId)
    .eq("lifecycle_status", "confirmed")
    .in("source_candidate_id", candidateIds);
  if (error) throw error;
  return data ?? [];
}

function classificationOperationError(error: unknown): ClassificationOperationError {
  const haystack = error && typeof error === "object"
    ? JSON.stringify(error)
    : String(error);
  const mappings: Array<[string, ClassificationOperationCode, string]> = [
    ["CLASSIFICATION_RESOURCE_NOT_FOUND", "MOVEMENT_NOT_FOUND", "No encontre uno de esos movimientos."],
    ["MOVEMENT_NOT_FOUND", "MOVEMENT_NOT_FOUND", "No encontre ese movimiento."],
    ["SUBCATEGORY_NOT_FOUND", "SUBCATEGORY_NOT_FOUND", "No encontre esa subcategoria."],
    ["CATEGORY_NOT_FOUND", "CATEGORY_NOT_FOUND", "Esa categoria no existe."],
    ["CLASSIFICATION_BATCH_NOT_FOUND", "CLASSIFICATION_BATCH_NOT_FOUND", "No encontre ese lote."],
    ["CLASSIFICATION_BATCH_EMPTY", "CLASSIFICATION_BATCH_EMPTY", "No hay movimientos que coincidan con eso."],
    ["CLASSIFICATION_UNDO_EXPIRED", "CLASSIFICATION_UNDO_EXPIRED", "Ese cambio ya no se puede deshacer en bloque."],
    ["CLASSIFICATION_IDEMPOTENCY_CONFLICT", "CLASSIFICATION_IDEMPOTENCY_CONFLICT", "Esa Idempotency-Key ya se uso con otros datos."],
    ["CLASSIFICATION_UNDO_ALREADY_APPLIED", "CLASSIFICATION_UNDO_ALREADY_APPLIED", "Ese lote ya fue deshecho."],
    ["SUBCATEGORY_MERGE_SELF", "SUBCATEGORY_MERGE_SELF", "No puedo fusionar una subcategoria consigo misma."],
    ["SUBCATEGORY_MERGE_CATEGORY_MISMATCH", "SUBCATEGORY_MERGE_CATEGORY_MISMATCH", "Solo puedo fusionar subcategorias de la misma categoria."],
    ["SUBCATEGORY_UNDO_NAME_CONFLICT", "SUBCATEGORY_UNDO_NAME_CONFLICT", "Ya existe otra subcategoria con el nombre original. Resuelve ese duplicado y vuelve a intentar."],
    ["MOVEMENT_TYPE_NOT_CLASSIFIABLE", "MOVEMENT_TYPE_NOT_CLASSIFIABLE", "Ese tipo de movimiento no admite categoria."],
  ];
  const match = mappings.find(([token]) => haystack.includes(token));
  return match
    ? new ClassificationOperationError(match[1], match[2])
    : new ClassificationOperationError("CLASSIFICATION_BATCH_NOT_FOUND", "No pude completar la clasificacion.");
}

function asOperationResult(data: Json): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Respuesta invalida de la operacion de clasificacion.");
  }
  return data as Record<string, unknown>;
}

async function callUntypedRpc(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: Json; error: unknown }> {
  return await (client.rpc as unknown as (
    functionName: string,
    functionArgs: Record<string, unknown>,
  ) => Promise<{ data: Json; error: unknown }>)(name, args);
}
