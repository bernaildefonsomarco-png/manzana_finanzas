import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, CategoryId, UserSubcategory } from "@/shared/types/domain";
import type { Database } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

/** Retorna las 12 categorías canónicas ordenadas por sort_order. */
export async function getAllCategories(client: Client): Promise<Category[]> {
  const { data, error } = await client
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    logger.error("categories.get_all_failed", { error });
    throw error;
  }

  return (data ?? []) as Category[];
}

/** Retorna una categoría por ID. */
export async function getCategoryById(
  client: Client,
  id: CategoryId
): Promise<Category | null> {
  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    logger.error("categories.get_by_id_failed", { error, category_id: id });
    throw error;
  }

  return data as Category;
}

/** Retorna las subcategorías activas del usuario para una categoría. */
export async function getUserSubcategories(
  client: Client,
  userId: string,
  categoryId?: CategoryId
): Promise<UserSubcategory[]> {
  let query = client
    .from("user_subcategories")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("label", { ascending: true });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("categories.get_subcategories_failed", {
      error,
      user_id: userId,
    });
    throw error;
  }

  return (data ?? []) as UserSubcategory[];
}

// Crear/renombrar subcategorías pasa por `ClassificationCommandDispatcher`
// (`src/core/classification/classification-command-dispatcher.ts`) y
// `insertSubcategory`/`updateSubcategory` en `classification.repository.ts`,
// que normalizan con `normalizeClassificationKey` (NFD, sin tildes). Este
// archivo no reimplementa esa escritura.
