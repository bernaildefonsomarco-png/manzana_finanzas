"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, SectionHeader } from "@/ui/primitivas/card";
import { Badge } from "@/ui/primitivas/badge";
import { LoadingBlock } from "@/ui/primitivas/states";
import { formatRelativeLimaDate } from "@/shared/dates/lima";
import { queryKeys } from "@/shared/data/query-keys";
import type { Movement } from "@/shared/types/domain";

/** Parte de SCR-CUENTAS-02: movimientos recientes de la cuenta. */
export function AccountRecentMovements({ accountId }: { accountId: string }) {
  const movementsQuery = useQuery({
    queryKey: queryKeys.movements.list({ account_id: accountId }),
    queryFn: async () => {
      const response = await fetch(`/api/v1/movements?account_id=${accountId}&limit=8`, {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("No pude cargar los movimientos.");
      const body = (await response.json()) as { data: { movements: Movement[] } };
      return body.data.movements;
    },
  });

  return (
    <Card className="p-5">
      <SectionHeader
        title="Movimientos recientes"
        action={
          <Link href="/movimientos" className="text-sm font-medium text-brand hover:text-brand-hover">
            Ver todos
          </Link>
        }
      />
      {movementsQuery.isLoading ? (
        <LoadingBlock label="Cargando movimientos" className="mt-3 min-h-32 py-6" />
      ) : !movementsQuery.data || movementsQuery.data.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">Sin movimientos todavia.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {movementsQuery.data.map((movement) => (
            <li key={movement.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-text">{movement.description ?? "Sin descripcion"}</p>
                <p className="text-xs text-text-muted">
                  {formatRelativeLimaDate(movement.occurred_at.slice(0, 10))}
                </p>
              </div>
              <Badge tone="neutral">{movement.type}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
