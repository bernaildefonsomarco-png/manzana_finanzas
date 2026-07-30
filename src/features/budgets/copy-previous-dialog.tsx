"use client";

import type { BudgetPeriodKind } from "@/core/budgets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/primitivas/alert-dialog";
import { MoneyText } from "@/ui/primitivas/money";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { periodLabel } from "./budget-options";
import type { BudgetView } from "./budgets-types";

export function CopyPreviousDialog({
  open,
  periodKind,
  periodStart,
  periodEnd,
  budgets,
  loading,
  failed,
  saving,
  saveFailed,
  onOpenChange,
  onRetry,
  onCopy,
}: {
  open: boolean;
  periodKind: BudgetPeriodKind;
  periodStart: string;
  periodEnd: string;
  budgets: BudgetView[];
  loading: boolean;
  failed: boolean;
  saving: boolean;
  saveFailed: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onCopy: () => void;
}) {
  const total = budgets.reduce((sum, budget) => sum + budget.base_amount, 0);
  const canCopy = !loading && !failed && budgets.length > 0 && !saving;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Copiar periodo anterior</AlertDialogTitle>
          <AlertDialogDescription>
            Se crearán presupuestos para el periodo {periodLabel(periodKind)}
            con las mismas categorías, bases y reglas del periodo anterior.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {loading ? <LoadingBlock label="Preparando resumen" /> : null}
        {failed ? (
          <ErrorState
            description="No pude preparar el resumen. No se copió nada."
            onRetry={onRetry}
          />
        ) : null}
        {!loading && !failed && budgets.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No hay presupuestos entre {periodStart} y {periodEnd} para copiar.
          </p>
        ) : null}
        {!loading && !failed && budgets.length > 0 ? (
          <div className="rounded-lg bg-bg-surface p-4 text-sm">
            <p>
              Se copiarán <strong>{budgets.length}</strong>{" "}
              {budgets.length === 1 ? "presupuesto" : "presupuestos"}.
            </p>
            <p className="mt-2 text-text-secondary">
              Base total: <MoneyText value={total} /> · {periodStart} a{" "}
              {periodEnd}
            </p>
          </div>
        ) : null}
        {saveFailed ? (
          <p role="alert" className="text-sm text-error">
            No pude copiar los presupuestos. No se modificó el periodo actual.
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction disabled={!canCopy} onClick={onCopy}>
            Copiar presupuestos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
