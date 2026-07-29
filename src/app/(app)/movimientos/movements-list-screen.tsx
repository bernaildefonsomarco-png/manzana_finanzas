"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AppShell } from "@/features/app-shell/app-shell";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import { DialogTitle } from "@/ui/primitivas/dialog-parts";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { queryKeys } from "@/shared/data/query-keys";
import { listMovements } from "@/shared/api/movements";
import { MovementForm } from "./movement-form/movement-form";
import { MovementsFiltersBar } from "./movements-filters-bar";
import { MovementsResults } from "./movements-results";

/**
 * `SCR-MOV-01`: listado con paginación por cursor y filtros en servidor.
 * `AC-MOV-04`: "Cargar más" con manejador real y estado de carga.
 * `AC-MOV-05`: la búsqueda siempre está disponible, no solo si ya hay un
 * término en la URL (defecto que este corte corrige).
 */
export function MovementsListScreen({ openNewOnMount = false }: { openNewOnMount?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [newMovementOpen, setNewMovementOpen] = useState(openNewOnMount);

  const filters = {
    q: searchParams.get("q") ?? undefined,
    type: searchParams.get("tipo") ?? undefined,
    status: searchParams.get("estado") ?? undefined,
    category_id: searchParams.get("categoria") ?? undefined,
    from: searchParams.get("desde") ?? undefined,
    to: searchParams.get("hasta") ?? undefined,
  };
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const query = useInfiniteQuery({
    queryKey: queryKeys.movements.list(filters),
    queryFn: ({ pageParam }) => listMovements({ ...filters, cursor: pageParam, limit: 25 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.page.has_more ? lastPage.page.next_cursor ?? undefined : undefined),
  });
  const movements = query.data?.pages.flatMap((page) => page.movements) ?? [];

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/movimientos?${params.toString()}`);
  }

  function clearFilters() {
    setSearchInput("");
    router.replace("/movimientos");
  }

  function closeNewMovement() {
    setNewMovementOpen(false);
    if (openNewOnMount) router.replace("/movimientos");
  }

  return (
    <AppShell title="Movimientos" activeView="movements" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="mx-auto max-w-3xl space-y-4">
        <MovementsFiltersBar
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSubmitSearch={(event) => {
            event.preventDefault();
            updateFilter("q", searchInput.trim());
          }}
          typeFilter={filters.type ?? ""}
          statusFilter={filters.status ?? ""}
          onFilterChange={updateFilter}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          onNewMovement={() => setNewMovementOpen(true)}
        />
        <MovementsResults
          isLoading={query.isLoading}
          isError={query.isError}
          movements={movements}
          hasActiveFilters={hasActiveFilters}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onRetry={() => query.refetch()}
          onClearFilters={clearFilters}
          onNewMovement={() => setNewMovementOpen(true)}
          onFetchNextPage={() => query.fetchNextPage()}
        />
      </div>

      <Dialog open={newMovementOpen} onOpenChange={(open) => (open ? setNewMovementOpen(true) : closeNewMovement())}>
        <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
          <DialogTitle>Nuevo movimiento</DialogTitle>
          <MovementForm onSaved={closeNewMovement} onCancel={closeNewMovement} />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
