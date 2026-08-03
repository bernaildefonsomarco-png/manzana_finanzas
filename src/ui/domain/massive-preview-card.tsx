"use client";

import { useId } from "react";
import { Card } from "@/ui/primitivas/card";
import { Button } from "@/ui/primitivas/button";
import { Checkbox } from "@/ui/primitivas/checkbox";
import { cn } from "@/ui/primitivas/cn";

export type MassivePreviewItem = {
  id: string;
  label: string;
  selected: boolean;
};

export type MassivePreviewCardProps = {
  /** "Voy a reclasificar 23 movimientos de "Rappi" a Alimentación" (41 §6). */
  title: string;
  /** El conteo real, resuelto por una consulta determinista (22 §7.1) — no una estimación. */
  totalCount: number;
  /** Muestra real, no un resumen; el resto se alcanza por `onViewAll`. */
  sampleItems: MassivePreviewItem[];
  onToggleItem: (id: string, selected: boolean) => void;
  onViewAll?: () => void;
  /** "No incluyo 2 que ya están en Alimentación." */
  exclusionsNote?: string;
  /** Nombra la accion sin el numero — el numero lo compone el propio componente (`AC-ASI-09`). */
  confirmActionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  className?: string;
};

/**
 * `41` §6, `SCR-ASI-06`. Cuatro elementos obligatorios: conteo en el
 * encabezado, muestra real, exclusiones explicadas, casillas para excluir
 * a mano — si falta uno el bloque no es valido. El deshacer opera sobre el
 * lote entero, no aqui (lo hace el modulo dueño tras confirmar).
 */
export function MassivePreviewCard({
  title,
  totalCount,
  sampleItems,
  onToggleItem,
  onViewAll,
  exclusionsNote,
  confirmActionLabel,
  onConfirm,
  onCancel,
  loading = false,
  className,
}: MassivePreviewCardProps) {
  const headingId = useId();
  const excludedFromSample = sampleItems.filter((item) => !item.selected).length;
  const liveCount = Math.max(totalCount - excludedFromSample, 0);
  const remainingCount = Math.max(totalCount - sampleItems.length, 0);
  const confirmLabel = `${confirmActionLabel} ${liveCount}`;

  return (
    <Card aria-labelledby={headingId} className={cn("space-y-4 p-5", className)}>
      <h3 id={headingId} className="font-heading text-base font-medium text-text">
        {title}
      </h3>

      <ul className="space-y-2">
        {sampleItems.map((item) => {
          const itemId = `${headingId}-${item.id}`;
          return (
            <li key={item.id} className="flex items-center gap-3">
              <Checkbox
                id={itemId}
                checked={item.selected}
                onCheckedChange={(checked) => onToggleItem(item.id, checked)}
              />
              <label htmlFor={itemId} className="text-sm text-text">
                {item.label}
              </label>
            </li>
          );
        })}
      </ul>

      {remainingCount > 0 ? (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>… y {remainingCount} más</span>
          {onViewAll ? (
            <Button type="button" variant="ghost" size="sm" onClick={onViewAll}>
              Ver todos
            </Button>
          ) : null}
        </div>
      ) : null}

      {exclusionsNote ? (
        <p className="text-sm text-text-secondary">{exclusionsNote}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onConfirm}
          loading={loading}
          disabled={liveCount === 0}
          aria-label={`${confirmLabel} movimientos`}
        >
          {confirmLabel}
        </Button>
      </div>
    </Card>
  );
}
