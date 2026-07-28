"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/ui/primitivas/card";
import { Badge } from "@/ui/primitivas/badge";
import { MoneyText } from "@/ui/primitivas/money";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { formatRelativeLimaDate } from "@/shared/dates/lima";
import { queryKeys } from "@/shared/data/query-keys";
import type { Movement } from "@/shared/types/domain";

/**
 * Piloto de `12` §6: contenido único que consumen tanto el panel
 * interceptado (`@panel/(.)[id]/page.tsx`) como la pantalla completa
 * (`[id]/page.tsx`) — la diferencia entre ambos casos es solo qué ruta de
 * Next.js los monta, no el contenido. Vive fuera de `src/features/movements/`
 * (`REEMPLAZAR`, `WEB-D164`): es infraestructura nueva de `W-07`, no una
 * reparación del componente condenado.
 */
export function MovementDetailView({ movementId }: { movementId: string }) {
  const query = useQuery({
    queryKey: queryKeys.movements.detail(movementId),
    queryFn: async () => {
      const response = await fetch(`/api/v1/movements/${movementId}`);
      if (!response.ok) {
        throw new Error(response.status === 404 ? "No encontrado" : "Error de red");
      }
      const body = (await response.json()) as { data: { movement: Movement } };
      return body.data.movement;
    },
  });

  if (query.isLoading) return <LoadingBlock label="Cargando movimiento…" />;

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No pude cargar este movimiento"
        description="Puede que ya no exista o que haya un problema temporal."
      />
    );
  }

  const movement = query.data;

  return (
    <Card elevated className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-text-muted">
            {formatRelativeLimaDate(movement.occurred_at.slice(0, 10))}
          </p>
          <h1 className="mt-1 font-heading text-xl font-semibold text-text">
            {movement.description ?? "Sin descripción"}
          </h1>
        </div>
        <Badge tone="neutral">{movement.status}</Badge>
      </div>
      <MoneyText value={movement.amount} className="mt-4 text-2xl" />
      <Link
        href="/movimientos"
        className="mt-5 inline-flex text-sm font-medium text-brand hover:text-brand-hover"
      >
        Volver a movimientos
      </Link>
    </Card>
  );
}
