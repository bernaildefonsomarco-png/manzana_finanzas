"use client";

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
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { deleteBox } from "@/shared/api/money";
import { ApiClientError } from "@/shared/api/http-client";
import type { BoxMoneySummary } from "@/shared/api/money-types";

/** RUL-CUENTAS-14: eliminar caja devuelve el saldo a libre. Nunca se pierde dinero. */
export function DeleteBoxDialog({
  box,
  open,
  onOpenChange,
  onDone,
}: {
  box: BoxMoneySummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const mutation = useOptimisticMutation<string, { released_amount: number }>({
    mutation: "box.upsert",
    mutationFn: (boxId) => deleteBox(boxId),
  });

  const hasBalance = box.current_balance > 0;

  async function handleConfirm() {
    try {
      const result = await mutation.mutateAsync(box.id);
      onOpenChange(false);
      onDone(
        result.released_amount > 0
          ? "Caja eliminada. El monto separado volvio a tu dinero libre."
          : "Caja eliminada."
      );
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar {box.name}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasBalance
              ? "Al eliminarla, Manzana libera este monto con una asignacion interna auditada. Tu saldo de cuenta no cambia; tu dinero libre aumenta."
              : "Esta caja no tiene saldo. Se eliminara sin crear movimientos."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-baseline justify-between rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm">
          <span className="text-text-secondary">Saldo en la caja</span>
          <MoneyText value={box.current_balance} />
        </div>
        {mutation.error ? (
          <p role="alert" className="mt-3 text-sm text-error">
            {mutation.error instanceof ApiClientError
              ? mutation.error.message
              : "No pude completar la accion. Intenta otra vez en un momento."}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending}>
            Eliminar caja
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
