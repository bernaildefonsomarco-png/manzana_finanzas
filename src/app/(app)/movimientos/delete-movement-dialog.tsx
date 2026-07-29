"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/ui/primitivas/alert-dialog";
import { formatRelativeLimaDate } from "@/shared/dates/lima";
import { movementTypeLabels } from "@/features/movements/movement-view-model";
import type { Movement } from "@/shared/types/domain";

/** `SCR-MOV-05`: nombra el movimiento concreto; el botón nombra la accion
 * real, nunca "Aceptar" (`AlertDialogAction` ya lo exige en desarrollo). */
export function DeleteMovementDialog({
  movement,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  movement: Movement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Eliminar movimiento</AlertDialogTitle>
        <AlertDialogDescription>
          {`Eliminar ${movementTypeLabels[movement.type].toLowerCase()} de ${
            movement.merchant ?? movement.description ?? "este movimiento"
          }, S/${movement.amount.toFixed(2)} del ${formatRelativeLimaDate(movement.occurred_at.slice(0, 10))}.`}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={busy}>
            Eliminar movimiento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
