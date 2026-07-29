import type { UserSubcategory } from "@/shared/types/domain";
import { parseApiResponse } from "./http-client";
import type { CategoriesListResponse, SubcategoryWithCount } from "./categories-types";

export { ApiClientError } from "./http-client";

/** 25 §10: las 12 categorias con su total del periodo actual. */
export async function getCategories(): Promise<CategoriesListResponse> {
  const response = await fetch("/api/v1/categories", { credentials: "same-origin" });
  return parseApiResponse(response);
}

/** SCR-CAT-02/03: subcategorias del usuario, con conteo y ordenadas por uso. */
export async function listSubcategories(categoryId?: string): Promise<SubcategoryWithCount[]> {
  const query = categoryId ? `?category_id=${categoryId}` : "";
  const response = await fetch(`/api/v1/subcategories${query}`, { credentials: "same-origin" });
  const data = await parseApiResponse<{ subcategories: SubcategoryWithCount[] }>(response);
  return data.subcategories;
}

export async function createSubcategory(params: {
  category_id: string;
  label: string;
}): Promise<UserSubcategory> {
  const response = await fetch("/api/v1/subcategories", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await parseApiResponse<{ subcategory: UserSubcategory }>(response);
  return data.subcategory;
}

/** RUL-CAT §5: renombrar re-normaliza y detecta duplicados (409). */
export async function renameSubcategory(id: string, label: string): Promise<UserSubcategory> {
  const response = await fetch(`/api/v1/subcategories/${id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  const data = await parseApiResponse<{ subcategory: UserSubcategory }>(response);
  return data.subcategory;
}

/** Archivar no borra: los movimientos que la usaban conservan su referencia. */
export async function archiveSubcategory(id: string): Promise<void> {
  const response = await fetch(`/api/v1/subcategories/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  await parseApiResponse(response);
}
