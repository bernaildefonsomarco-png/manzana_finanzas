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
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { archiveSubcategory } from "@/shared/api/categories";
import { DialogMutationError } from "@/shared/ui/dialog-mutation-error";
import type { UserSubcategory } from "@/shared/types/domain";

/** SCR-CAT-02: archivar no borra, los movimientos ya clasificados conservan su referencia. */
export function ArchiveSubcategoryDialog({
  subcategory,
  open,
  onOpenChange,
  onDone,
}: {
  subcategory: UserSubcategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const mutation = useOptimisticMutation<string, void>({
    mutation: "subcategory.edit",
    mutationFn: (id) => archiveSubcategory(id),
  });

  async function handleConfirm() {
    try {
      await mutation.mutateAsync(subcategory.id);
      onOpenChange(false);
      onDone(`${subcategory.label} archivada. Los movimientos ya clasificados no cambian.`);
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archivar {subcategory.label}</AlertDialogTitle>
          <AlertDialogDescription>
            Ya no podras elegirla para nuevos movimientos. Los movimientos que ya la usan conservan
            su referencia.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DialogMutationError error={mutation.error} />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending}>
            Archivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
