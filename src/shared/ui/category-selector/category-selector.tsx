"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent } from "@/ui/primitivas/popover";
import { Button } from "@/ui/primitivas/button";
import { queryKeys } from "@/shared/data/query-keys";
import { getCategories, listSubcategories } from "@/shared/api/categories";
import { CategorySelectorGroup } from "./category-selector-group";

export type CategorySelectorValue =
  | { kind: "subcategory"; subcategoryId: string }
  | { kind: "unclassified" };

const UNCLASSIFIED_LABEL = "Sin clasificar";

/**
 * SCR-CAT-03: componente reutilizable (formulario de movimiento, edicion,
 * filtro de listados — `25` §8). Busca por texto, muestra las mas usadas
 * primero (orden que ya trae `listSubcategories`), permite crear una
 * subcategoria sin salir del selector, y deja "sin clasificar" explicito.
 */
export function CategorySelector({
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: CategorySelectorValue | null;
  onChange: (value: CategorySelectorValue) => void;
  "aria-label": string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const categoriesQuery = useQuery({ queryKey: queryKeys.categories, queryFn: getCategories });
  const subcategoriesQuery = useQuery({
    queryKey: queryKeys.subcategories.list(),
    queryFn: () => listSubcategories(),
  });

  const categories = categoriesQuery.data?.categories ?? [];
  const subcategories = subcategoriesQuery.data ?? [];
  const loading = categoriesQuery.isLoading || subcategoriesQuery.isLoading;

  function computeSelectedLabel(): string {
    if (!value) return "Elige una categoria";
    if (value.kind === "unclassified") return UNCLASSIFIED_LABEL;
    const subcategory = subcategories.find((s) => s.id === value.subcategoryId);
    if (!subcategory) return loading ? "Cargando…" : "Subcategoria archivada";
    const category = categories.find((c) => c.id === subcategory.category_id);
    return category ? `${category.label} › ${subcategory.label}` : subcategory.label;
  }
  const selectedLabel = computeSelectedLabel();

  const needle = query.trim().toLowerCase();
  const showUnclassified = !needle || UNCLASSIFIED_LABEL.toLowerCase().includes(needle);

  function select(next: CategorySelectorValue) {
    onChange(next);
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="secondary"
        className="w-full justify-between"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Button>
      <PopoverContent className="w-80 max-w-[90vw]">
        <input
          autoFocus
          className="mb-2 h-9 w-full rounded-md border border-border bg-bg-surface px-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-subtle"
          placeholder="Buscar categoria o subcategoria…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-auto">
          {showUnclassified ? (
            <li
              role="option"
              aria-selected={value?.kind === "unclassified"}
              className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-surface hover:text-text"
              onClick={() => select({ kind: "unclassified" })}
            >
              {UNCLASSIFIED_LABEL}
              {value?.kind === "unclassified" ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </li>
          ) : null}
          {loading ? (
            <li className="px-3 py-2 text-sm text-text-muted">Cargando…</li>
          ) : (
            categories.map((category) => (
              <CategorySelectorGroup
                key={category.id}
                category={category}
                subcategories={subcategories.filter((s) => s.category_id === category.id)}
                query={needle}
                selectedSubcategoryId={value?.kind === "subcategory" ? value.subcategoryId : null}
                onSelect={(subcategoryId) => select({ kind: "subcategory", subcategoryId })}
              />
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
