"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, X } from "lucide-react";
import { Card, SectionHeader } from "@/ui/primitivas/card";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { queryKeys } from "@/shared/data/query-keys";
import { getCategories, listSubcategories } from "@/shared/api/categories";
import { RenameSubcategoryDialog } from "./rename-subcategory-dialog";
import { ArchiveSubcategoryDialog } from "./archive-subcategory-dialog";
import { MergeSubcategoryDialog } from "./merge-subcategory-dialog";
import { SubcategoryRow } from "./subcategory-row";
import type { UserSubcategory } from "@/shared/types/domain";

type DetailDialogState =
  | { kind: "none" }
  | { kind: "rename"; subcategory: UserSubcategory }
  | { kind: "archive"; subcategory: UserSubcategory }
  | { kind: "merge"; subcategory: UserSubcategory };

/** SCR-CAT-02: subcategorias de una categoria, renombrar y archivar (WEB-D190: fusion diferida a W-13). */
export function CategoryDetailView({ categoryId }: { categoryId: string }) {
  const [dialog, setDialog] = useState<DetailDialogState>({ kind: "none" });
  const [feedback, setFeedback] = useState<string | null>(null);

  const categoriesQuery = useQuery({ queryKey: queryKeys.categories, queryFn: getCategories });
  const subcategoriesQuery = useQuery({
    queryKey: queryKeys.subcategories.list(categoryId),
    queryFn: () => listSubcategories(categoryId),
  });

  function onDone(message: string) {
    setDialog({ kind: "none" });
    setFeedback(message);
  }

  if (categoriesQuery.isLoading || subcategoriesQuery.isLoading) {
    return <LoadingBlock label="Cargando categoria" />;
  }

  if (categoriesQuery.isError || subcategoriesQuery.isError || !categoriesQuery.data) {
    return (
      <ErrorState
        title="No pude cargar la categoria"
        description="Intenta de nuevo en un momento."
        onRetry={() => {
          void categoriesQuery.refetch();
          void subcategoriesQuery.refetch();
        }}
      />
    );
  }

  const category = categoriesQuery.data.categories.find((c) => c.id === categoryId);
  if (!category) {
    return <ErrorState title="Categoria no encontrada" description="Puede que el enlace este mal escrito." />;
  }

  const subcategories = subcategoriesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/configuracion/categorias" className="text-sm text-text-secondary hover:text-text">
          Categorias
        </Link>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold text-text">{category.label}</h1>
          {/* WEB-D200: cierra el enlace pendiente de WEB-D194 ahora que el
              listado de movimientos de W-09 acepta `categoria` de verdad. */}
          <Link
            href={`/movimientos?categoria=${category.id}`}
            className="text-sm font-medium text-brand hover:text-brand-hover"
          >
            Ver movimientos de esta categoría
          </Link>
        </div>
      </div>

      {feedback ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-success-subtle bg-success-subtle/40 px-4 py-3 text-sm text-success-on-subtle"
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
          <button type="button" aria-label="Cerrar mensaje" onClick={() => setFeedback(null)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <Card className="p-5">
        <SectionHeader title="Subcategorias" />
        {subcategories.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">Todavia no tienes subcategorias aqui.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {subcategories.map((subcategory) => (
              <SubcategoryRow
                key={subcategory.id}
                subcategory={subcategory}
                onRename={() => setDialog({ kind: "rename", subcategory })}
                onArchive={() => setDialog({ kind: "archive", subcategory })}
                onMerge={() => setDialog({ kind: "merge", subcategory })}
              />
            ))}
          </ul>
        )}
      </Card>

      {dialog.kind === "rename" ? (
        <RenameSubcategoryDialog
          subcategory={dialog.subcategory}
          open
          onOpenChange={(next) => !next && setDialog({ kind: "none" })}
          onDone={onDone}
        />
      ) : null}
      {dialog.kind === "archive" ? (
        <ArchiveSubcategoryDialog
          subcategory={dialog.subcategory}
          open
          onOpenChange={(next) => !next && setDialog({ kind: "none" })}
          onDone={onDone}
        />
      ) : null}
      {dialog.kind === "merge" ? (
        <MergeSubcategoryDialog
          source={dialog.subcategory}
          candidates={subcategories.filter((subcategory) => subcategory.id !== dialog.subcategory.id)}
          open
          onOpenChange={(next) => !next && setDialog({ kind: "none" })}
          onDone={(message) => {
            setFeedback(message);
            void subcategoriesQuery.refetch();
          }}
        />
      ) : null}
    </div>
  );
}
