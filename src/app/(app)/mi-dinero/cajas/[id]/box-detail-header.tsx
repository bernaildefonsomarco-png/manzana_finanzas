import Link from "next/link";
import { ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/ui/primitivas/button";
import { boxTypeLabels } from "@/shared/copy/money-copy";
import type { Box } from "@/shared/types/domain";

/** Titulo + acciones de SCR-CUENTAS-03. */
export function BoxDetailHeader({
  box,
  accountName,
  accountId,
  onMove,
  onEdit,
  onDelete,
}: {
  box: Box;
  accountName?: string;
  accountId?: string;
  onMove: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-text-muted">{boxTypeLabels[box.type]}</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-text">{box.name}</h1>
        {accountId ? (
          <Link href={`/mi-dinero/cuentas/${accountId}`} className="text-sm text-brand hover:text-brand-hover">
            {accountName}
          </Link>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          size="icon"
          variant="ghost"
          title={`Mover dinero de ${box.name}`}
          aria-label={`Mover dinero de ${box.name}`}
          onClick={onMove}
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title={`Editar caja ${box.name}`}
          aria-label={`Editar caja ${box.name}`}
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title={`Eliminar caja ${box.name}`}
          aria-label={`Eliminar caja ${box.name}`}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
