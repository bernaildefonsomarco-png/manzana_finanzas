"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/ui/primitivas/card";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { queryKeys } from "@/shared/data/query-keys";
import { invalidateForMutation } from "@/shared/data/invalidation";
import { ApiClientError, deleteMovement, getMovement, getMovementHistory, restoreMovement } from "@/shared/api/movements";
import { EditMovementFields } from "./movement-edit-fields";
import { MovementHistoryList } from "./movement-history-list";
import { MovementDetailActions } from "./movement-detail-actions";
import { DeleteMovementDialog } from "./delete-movement-dialog";
import { MovementSummary } from "./movement-summary";
import { ClassificationWhyPanel } from "./classification-why-panel";

/**
 * Piloto de `12` §6: contenido único que consumen tanto el panel
 * interceptado (`@panel/(.)[id]/page.tsx`) como la pantalla completa
 * (`[id]/page.tsx`). Vive fuera de `src/features/movements/` (`REEMPLAZAR`,
 * `WEB-D164`). `SCR-MOV-02`: editar, eliminar, restaurar, ver historial e
 * impacto.
 */
export function MovementDetailView({ movementId }: { movementId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.movements.detail(movementId),
    queryFn: () => getMovement(movementId),
  });
  const historyQuery = useQuery({
    queryKey: [...queryKeys.movements.detail(movementId), "historial"],
    queryFn: () => getMovementHistory(movementId),
    enabled: showHistory,
  });

  if (query.isLoading) return <LoadingBlock label="Cargando movimiento…" />;

  if (query.isError || !query.data) {
    const notFound = query.error instanceof ApiClientError && query.error.status === 404;
    return (
      <ErrorState
        title={notFound ? "No encontré ese movimiento" : "No pude cargar este movimiento"}
        description={
          notFound
            ? "Puede que ya no exista o que sea de otra cuenta."
            : "Puede que haya un problema temporal. Tus datos siguen guardados."
        }
        onRetry={notFound ? undefined : () => query.refetch()}
      />
    );
  }

  const movement = query.data;
  // `assertStandaloneMovementMutation` en el Core bloquea editar/eliminar un
  // movimiento vinculado a una deuda o a una ocurrencia recurrente.
  const isSpecialized = Boolean(movement.debt_id || movement.recurring_rule_id || movement.recurring_occurrence_id);
  const isDeleted = movement.deleted_at !== null;

  async function handleDelete() {
    setBusy(true);
    setActionError(null);
    try {
      await deleteMovement(movementId, "user_deleted_from_detail");
      await invalidateForMutation(queryClient, "movement.delete");
      setConfirmingDelete(false);
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : "No pude eliminar el movimiento.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    setActionError(null);
    try {
      await restoreMovement(movementId, "user_restored_from_detail");
      await invalidateForMutation(queryClient, "movement.edit");
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : "No pude restaurar el movimiento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card elevated className="p-5">
        <MovementSummary movement={movement} isSpecialized={isSpecialized} />

        {actionError ? <p className="mt-3 text-sm text-error">{actionError}</p> : null}

        <MovementDetailActions
          isDeleted={isDeleted}
          isSpecialized={isSpecialized}
          editing={mode === "edit"}
          showHistory={showHistory}
          busy={busy}
          onToggleEdit={() => setMode(mode === "edit" ? "view" : "edit")}
          onDelete={() => setConfirmingDelete(true)}
          onRestore={() => void handleRestore()}
          onToggleHistory={() => setShowHistory((v) => !v)}
        />

        {mode === "edit" ? (
          <EditMovementFields
            movement={movement}
            onCancel={() => setMode("view")}
            onSaved={() => {
              setMode("view");
              void invalidateForMutation(queryClient, "movement.edit");
            }}
          />
        ) : null}

        {showHistory ? <MovementHistoryList entries={historyQuery.data?.history} loading={historyQuery.isLoading} /> : null}

        {!isDeleted && !isSpecialized ? <ClassificationWhyPanel movementId={movementId} /> : null}

        <Link href="/movimientos" className="mt-5 inline-flex text-sm font-medium text-brand hover:text-brand-hover">
          Volver a movimientos
        </Link>
      </Card>

      <DeleteMovementDialog
        movement={movement}
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onConfirm={() => void handleDelete()}
        busy={busy}
      />
    </div>
  );
}
