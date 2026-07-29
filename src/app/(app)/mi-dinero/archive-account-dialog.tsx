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
import { archiveAccount } from "@/shared/api/money";
import { ApiClientError } from "@/shared/api/http-client";
import type { AccountMoneySummary } from "@/shared/api/money-types";

/** ACT-CUENTAS-03: archivar cuenta, en cascada con sus cajas (24 S5.1). */
export function ArchiveAccountDialog({
  account,
  open,
  onOpenChange,
  onDone,
}: {
  account: AccountMoneySummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const mutation = useOptimisticMutation<string, { archived_box_count: number }>({
    mutation: "account.upsert",
    mutationFn: (accountId) => archiveAccount(accountId),
  });

  if (!account) return null;

  const hasBalance = Math.abs(account.current_balance) > 0.00001;

  async function handleConfirm() {
    if (!account) return;
    try {
      const result = await mutation.mutateAsync(account.id);
      onOpenChange(false);
      onDone(
        result.archived_box_count > 0
          ? `Cuenta archivada junto con ${result.archived_box_count} caja${result.archived_box_count === 1 ? "" : "s"}. El dinero sigue contabilizado, pero deja de sumar al total.`
          : "Cuenta archivada."
      );
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archivar {account.name}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasBalance || account.box_count > 0 ? (
              <>
                Esta cuenta y sus cajas se archivan juntas. El dinero sigue contabilizado, pero
                deja de sumar al total mientras este archivada. Puedes restaurarla cuando quieras.
              </>
            ) : (
              "Esta cuenta no tiene saldo ni cajas. Se archivara sin crear movimientos."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-baseline justify-between rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm">
          <span className="text-text-secondary">Saldo actual</span>
          <MoneyText value={account.current_balance} />
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
            Archivar cuenta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
