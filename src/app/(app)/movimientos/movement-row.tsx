"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { MoneyText } from "@/ui/primitivas/money";
import { Badge } from "@/ui/primitivas/badge";
import { toMovementViewItem } from "@/features/movements/movement-view-model";
import type { Movement } from "@/shared/types/domain";

const NEGATIVE_TYPES = new Set(["gasto", "pago_deuda", "prestamo_dado", "pago_recurrente"]);
const POSITIVE_TYPES = new Set(["ingreso", "prestamo_recibido", "devolucion_recibida"]);

function signFor(type: Movement["type"]): "negative" | "positive" | "none" | "auto" {
  if (type === "ajuste") return "auto";
  if (NEGATIVE_TYPES.has(type)) return "negative";
  if (POSITIVE_TYPES.has(type)) return "positive";
  return "none";
}

/** `SCR-MOV-01`: cada fila indica su origen y estado sin depender solo del
 * color (`AC-MOV-20`) — el nombre accesible incluye tipo, comercio, fecha y
 * monto con signo. */
export function MovementRow({ movement }: { movement: Movement }) {
  const view = toMovementViewItem(movement);
  const isDeleted = movement.deleted_at !== null;
  const accessibleName = `${view.typeLabel}, ${view.title}, ${view.description}, ${
    view.amount === 0 ? "cero soles" : `${signFor(movement.type) === "negative" ? "menos " : ""}${view.amount} soles`
  }`;

  return (
    <Link
      href={`/movimientos/${movement.id}`}
      aria-label={accessibleName}
      className="flex items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-text">{view.title}</p>
          {movement.status === "needs_review" ? (
            <Badge tone="warning" className="shrink-0">
              <AlertCircle className="mr-1 h-3 w-3" aria-hidden="true" />
              Por revisar
            </Badge>
          ) : null}
          {isDeleted ? (
            <Badge tone="neutral" className="shrink-0">
              Eliminado
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-text-secondary">
          {view.description} · {view.typeLabel}
          {view.categoryLabel !== "Sin categoría" ? ` · ${view.categoryLabel}` : ""}
        </p>
      </div>
      <MoneyText value={view.amount} sign={signFor(movement.type)} className="shrink-0 text-sm font-semibold" />
    </Link>
  );
}
