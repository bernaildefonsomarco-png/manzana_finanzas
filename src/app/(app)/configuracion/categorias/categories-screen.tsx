"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Card, SectionHeader } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { getCategories } from "@/shared/api/categories";
import { queryKeys } from "@/shared/data/query-keys";

/** SCR-CAT-01: gestion de categorias. Las 12 son fijas (RUL-CAT-01). */
export function CategoriesScreen() {
  const query = useQuery({
    queryKey: queryKeys.categories,
    queryFn: getCategories,
  });

  if (query.isLoading) return <LoadingBlock label="Cargando categorias" />;

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No pude cargar las categorias"
        description="Intenta de nuevo en un momento."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { categories, unclassified } = query.data;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-text">Categorias</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Las 12 categorias son fijas: no se pueden crear ni eliminar. Puedes organizar tus
          subcategorias dentro de cada una.
        </p>
      </div>

      {unclassified.movement_count > 0 ? (
        <Card className="flex items-center justify-between gap-3 border-warning-subtle bg-warning-subtle/30 p-4">
          <div className="flex items-center gap-2 text-sm text-warning-on-subtle">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Tienes {unclassified.movement_count} movimiento{unclassified.movement_count === 1 ? "" : "s"} por
              clasificar.
            </span>
          </div>
          <MoneyText value={unclassified.total} className="text-sm font-medium" />
        </Card>
      ) : null}

      <Card className="p-5">
        <SectionHeader title="Las 12 categorias" />
        <ul className="mt-3 divide-y divide-border">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/configuracion/categorias/${category.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:text-brand"
              >
                <span className="font-medium text-text">{category.label}</span>
                <MoneyText value={category.total_this_period} className="text-sm" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
