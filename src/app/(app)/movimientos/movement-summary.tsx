import Link from "next/link";
import { Badge } from "@/ui/primitivas/badge";
import { MoneyText } from "@/ui/primitivas/money";
import { formatRelativeLimaDate } from "@/shared/dates/lima";
import { movementTypeLabels } from "@/features/movements/movement-view-model";
import type { Movement } from "@/shared/types/domain";
import { buildImpactExplanation, statusLabel } from "./movement-detail-helpers";

/** Encabezado del detalle: fecha, titulo, tipo, monto e impacto
 * (`AC-MOV-16`), mas el aviso de movimiento especializado (`26` §19 caso
 * rescatado 16). */
export function MovementSummary({ movement, isSpecialized }: { movement: Movement; isSpecialized: boolean }) {
  const isDeleted = movement.deleted_at !== null;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-text-muted">
            {formatRelativeLimaDate(movement.occurred_at.slice(0, 10))}
          </p>
          <h1 className="mt-1 font-heading text-xl font-semibold text-text">
            {movement.merchant ?? movement.description ?? movementTypeLabels[movement.type]}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{movementTypeLabels[movement.type]}</p>
        </div>
        <Badge tone={isDeleted ? "neutral" : movement.status === "needs_review" ? "warning" : "success"}>
          {statusLabel(movement.status, isDeleted)}
        </Badge>
      </div>

      <MoneyText value={movement.amount} sign={isDeleted ? "none" : "auto"} className="mt-4 text-2xl" />
      <p className="mt-3 text-sm text-text-secondary">{buildImpactExplanation(movement)}</p>
      {movement.description && movement.merchant ? <p className="mt-2 text-sm text-text">{movement.description}</p> : null}

      {isSpecialized ? (
        <p className="mt-4 rounded-md bg-bg-surface px-3 py-2 text-xs text-text-secondary">
          Este movimiento está vinculado a una deuda o a un pago recurrente. Se edita y elimina desde{" "}
          <Link href="/deudas" className="font-medium text-brand hover:text-brand-hover">
            Deudas
          </Link>{" "}
          o{" "}
          <Link href="/pagos-que-vienen" className="font-medium text-brand hover:text-brand-hover">
            Pagos que vienen
          </Link>
          .
        </p>
      ) : null}
    </>
  );
}
