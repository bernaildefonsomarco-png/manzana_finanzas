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
