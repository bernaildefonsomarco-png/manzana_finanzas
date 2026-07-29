"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/ui/primitivas/button";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { createSubcategory } from "@/shared/api/categories";
import type { CategoryWithTotal, SubcategoryWithCount } from "@/shared/api/categories-types";

/** Un grupo de SCR-CAT-03: subcategorias de una categoria, con crear inline. */
export function CategorySelectorGroup({
  category,
  subcategories,
  query,
  selectedSubcategoryId,
  onSelect,
}: {
  category: CategoryWithTotal;
  subcategories: SubcategoryWithCount[];
  query: string;
  selectedSubcategoryId: string | null;
  onSelect: (subcategoryId: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const mutation = useOptimisticMutation<string, { id: string }>({
    mutation: "subcategory.edit",
    mutationFn: (label) => createSubcategory({ category_id: category.id, label }).then((s) => ({ id: s.id })),
  });

  const visible = query ? subcategories.filter((s) => s.label.toLowerCase().includes(query)) : subcategories;
  const categoryMatches = category.label.toLowerCase().includes(query);
  if (query && visible.length === 0 && !categoryMatches) return null;

  async function submitCreate() {
    const label = draft.trim();
    if (label.length < 2) return;
    try {
      const result = await mutation.mutateAsync(label);
      setCreating(false);
      setDraft("");
      onSelect(result.id);
    } catch {
      // El error queda en mutation.error, mostrado debajo del campo.
    }
  }

  return (
    <li>
      <p className="px-3 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">{category.label}</p>
      <ul>
        {visible.map((subcategory) => (
          <li
            key={subcategory.id}
            role="option"
            aria-selected={subcategory.id === selectedSubcategoryId}
            className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-surface hover:text-text"
            onClick={() => onSelect(subcategory.id)}
          >
            {subcategory.label}
            {subcategory.id === selectedSubcategoryId ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
          </li>
        ))}
      </ul>
      {creating ? (
        <div className="flex items-center gap-1 px-3 py-1.5">
          <input
            autoFocus
            className="h-8 flex-1 rounded-md border border-border bg-bg-surface-raised px-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand-subtle"
            placeholder="Nombre de la subcategoria"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitCreate();
              } else if (event.key === "Escape") {
                setCreating(false);
                setDraft("");
              }
            }}
          />
          <Button size="sm" variant="secondary" loading={mutation.isPending} onClick={submitCreate}>
            Crear
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand hover:text-brand-hover"
          onClick={() => {
            setCreating(true);
            setDraft(query);
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Nueva subcategoria
        </button>
      )}
      {mutation.error ? <p className="px-3 pb-1 text-xs text-error">No pude crear la subcategoria.</p> : null}
    </li>
  );
}
