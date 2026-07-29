"use client";

import { Button } from "@/ui/primitivas/button";
import { EmptyState, ErrorState, SkeletonRow } from "@/ui/primitivas/states";
import type { Movement } from "@/shared/types/domain";
import { MovementRow } from "./movement-row";

/** `AC-MOV-14`: "vacio" (sin ningun movimiento) y "sin resultados" (el
 * filtro no coincide) son estados distintos, con mensaje y accion propios. */
export function MovementsResults({
  isLoading,
  isError,
  movements,
  hasActiveFilters,
  hasNextPage,
  isFetchingNextPage,
  onRetry,
  onClearFilters,
  onNewMovement,
  onFetchNextPage,
}: {
  isLoading: boolean;
  isError: boolean;
  movements: Movement[];
  hasActiveFilters: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
  onNewMovement: () => void;
  onFetchNextPage: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="No pude cargar tus movimientos"
        description="Tus datos siguen guardados. Intenta de nuevo."
        onRetry={onRetry}
      />
    );
  }

  if (movements.length === 0 && hasActiveFilters) {
    return (
      <EmptyState
        title="No encontré movimientos con esos filtros"
        description="Prueba con otros filtros o límpialos para ver todo."
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        }
      />
    );
  }

  if (movements.length === 0) {
    return (
      <EmptyState
        title="Cuando registres algo, aparecerá aquí"
        description="Registra tu primer movimiento para empezar a ver tu historial."
        action={<Button onClick={onNewMovement}>Nuevo movimiento</Button>}
      />
    );
  }

  return (
    <>
      <div className="divide-y divide-border rounded-xl border border-border bg-bg-surface-raised">
        {movements.map((movement) => (
          <MovementRow key={movement.id} movement={movement} />
        ))}
      </div>
      {hasNextPage ? (
        <div className="flex justify-center py-4">
          <Button variant="secondary" onClick={onFetchNextPage} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Cargando…" : "Cargar más"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
