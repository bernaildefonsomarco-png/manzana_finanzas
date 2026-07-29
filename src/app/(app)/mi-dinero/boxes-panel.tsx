"use client";

import Link from "next/link";
import { Plus, ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { Card, SectionHeader } from "@/ui/primitivas/card";
import { Button } from "@/ui/primitivas/button";
import { MoneyText } from "@/ui/primitivas/money";
import { Progress } from "@/ui/primitivas/progress";
import type { BoxMoneySummary } from "@/shared/api/money-types";

/** Parte de SCR-CUENTAS-01: lista de cajas con sus acciones. */
export function BoxesPanel({
  boxes,
  hasAccounts,
  onCreate,
  onEdit,
  onDelete,
  onMove,
}: {
  boxes: BoxMoneySummary[];
  hasAccounts: boolean;
  onCreate: () => void;
  onEdit: (box: BoxMoneySummary) => void;
  onDelete: (box: BoxMoneySummary) => void;
  onMove: (box: BoxMoneySummary) => void;
}) {
  return (
    <Card className="p-5">
      <SectionHeader
        title="Cajas"
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={onCreate}
            disabled={!hasAccounts}
          >
            Nueva
          </Button>
        }
      />
      {boxes.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm text-text-secondary">
            Todavia no tienes cajas. Puedes separar dinero para alquiler, cuotas, emergencia u
            objetivos sin duplicar saldos.
          </p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={onCreate} disabled={!hasAccounts}>
            Separar dinero
          </Button>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {boxes.map((box) => (
            <li key={box.id} className="flex items-center justify-between gap-3 py-3">
              <Link href={`/mi-dinero/cajas/${box.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-text">{box.name}</p>
                <p className="truncate text-xs text-text-muted">{box.account_name}</p>
                {box.target_amount ? (
                  <Progress
                    value={box.current_balance}
                    max={box.target_amount}
                    aria-label={`${box.name}, ${box.current_balance.toFixed(0)} de ${box.target_amount.toFixed(0)} soles`}
                    className="mt-1 h-1.5 w-32"
                  />
                ) : null}
              </Link>
              <div className="flex items-center gap-2">
                <MoneyText value={box.current_balance} className="w-24 text-right" />
                <Button
                  size="icon"
                  variant="ghost"
                  title={`Mover dinero de ${box.name}`}
                  aria-label={`Mover dinero de ${box.name}`}
                  onClick={() => onMove(box)}
                >
                  <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title={`Editar caja ${box.name}`}
                  aria-label={`Editar caja ${box.name}`}
                  onClick={() => onEdit(box)}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title={`Eliminar caja ${box.name}`}
                  aria-label={`Eliminar caja ${box.name}`}
                  onClick={() => onDelete(box)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
