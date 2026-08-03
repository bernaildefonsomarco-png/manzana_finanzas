"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/data/query-keys";
import { listAssistantCategories } from "./assistant-api";

/** Resuelve `category_id` a un nombre legible para `ConfirmationCardField` (`resolve-proposal-card.ts`). */
export function useAssistantCategoryLabel(): (categoryId: string | null | undefined) => string | null {
  const query = useQuery({
    queryKey: queryKeys.categories,
    queryFn: listAssistantCategories,
    staleTime: 5 * 60_000,
  });

  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of query.data ?? []) map.set(category.id, category.name);
    return map;
  }, [query.data]);

  return useCallback(
    (categoryId: string | null | undefined) => (categoryId ? byId.get(categoryId) ?? null : null),
    [byId]
  );
}
