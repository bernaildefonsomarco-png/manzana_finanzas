"use client";

import { History, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/ui/primitivas/button";

/** `ACT-MOV-02/04/05/08`: la barra de acciones del detalle, ocultando lo que
 * no aplica segun estado (`RUL-MOV-05` a `08`). */
export function MovementDetailActions({
  isDeleted,
  isSpecialized,
  editing,
  showHistory,
  busy,
  onToggleEdit,
  onDelete,
  onRestore,
  onToggleHistory,
}: {
  isDeleted: boolean;
  isSpecialized: boolean;
  editing: boolean;
  showHistory: boolean;
  busy: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onToggleHistory: () => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {!isDeleted && !isSpecialized ? (
        <Button variant="secondary" size="sm" onClick={onToggleEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {editing ? "Cancelar edición" : "Editar"}
        </Button>
      ) : null}
      {!isDeleted && !isSpecialized ? (
        <Button variant="secondary" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Eliminar
        </Button>
      ) : null}
      {isDeleted ? (
        <Button variant="secondary" size="sm" onClick={onRestore} disabled={busy}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Restaurar
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" onClick={onToggleHistory}>
        <History className="h-4 w-4" aria-hidden="true" />
        {showHistory ? "Ocultar historial" : "Ver historial"}
      </Button>
    </div>
  );
}
