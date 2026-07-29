import type { Category, UserSubcategory } from "@/shared/types/domain";

export type CategoryWithTotal = Category & {
  total_this_period: number;
  movement_count_this_period: number;
};

export type UnclassifiedSummary = {
  total: number;
  movement_count: number;
};

/** `GET /api/v1/categories` (25 §10). */
export type CategoriesListResponse = {
  categories: CategoryWithTotal[];
  unclassified: UnclassifiedSummary;
};

export type SubcategoryWithCount = UserSubcategory & {
  movement_count: number;
};
