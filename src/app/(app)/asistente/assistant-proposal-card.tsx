"use client";

import { useEffect } from "react";
import { Card } from "@/ui/primitivas/card";
import { ConfirmationCard } from "@/ui/domain/confirmation-card";
import { ApiClientError } from "@/shared/api/http-client";
import { useAssistantCategoryLabel } from "./use-assistant-categories";
import { useAssistantPendingItem } from "./use-assistant-pending-item";
import { useAssistantProposalActions } from "./use-assistant-proposal-actions";
import {
  buildConfirmAriaLabel,
  buildProposalFields,
  buildProposalTitle,
  resolveConfirmationLevel,
} from "./resolve-proposal-card";

// `AC-ASI-08`: confirmada o descartada, no desaparece ni se sustituye por
// un mensaje nuevo — se ve resuelta en el mismo sitio.
const RESOLVED_STATUSES = new Set(["user_confirmed", "auto_resolved_duplicate", "already_registered"]);
const DISCARDED_STATUSES = new Set(["discarded", "expired"]);

/** `RUL-ASI-22`: al confirmar o descartar, el foco vuelve al campo de entrada. */
function focusAssistantComposer(): void {
  document.querySelector<HTMLTextAreaElement>('[aria-label="Escribe un mensaje para Manzana"]')?.focus();
}

export function AssistantProposalCard({
  pendingItemId,
  threadId,
}: {
  pendingItemId: string;
  threadId: string | null;
}) {
  const { data: item, isLoading } = useAssistantPendingItem(pendingItemId);
  const resolveCategoryLabel = useAssistantCategoryLabel();
  const { confirm, dismiss, edit } = useAssistantProposalActions(threadId);

  useEffect(() => {
    if (confirm.isSuccess || dismiss.isSuccess) focusAssistantComposer();
  }, [confirm.isSuccess, dismiss.isSuccess]);

  if (isLoading || !item) {
    return (
      <Card className="space-y-3 p-5" aria-busy="true">
        <div className="h-4 w-2/3 animate-pulse rounded-sm bg-bg-surface" />
        <div className="h-4 w-full animate-pulse rounded-sm bg-bg-surface" />
      </Card>
    );
  }

  if (RESOLVED_STATUSES.has(item.status)) {
    const title = item.normalized_summary.title?.trim() || "Registrado";
    return <Card className="p-5 text-sm text-text">{title.replace(/^Voy a /i, "")}</Card>;
  }

  if (DISCARDED_STATUSES.has(item.status)) {
    return (
      <Card className="p-5 text-sm text-text-secondary">
        {item.status === "expired"
          ? "La operación que te propuse quedó pendiente. ¿La retomamos?"
          : "Descartado."}
      </Card>
    );
  }

  const level = resolveConfirmationLevel(item);

  return (
    <div className="space-y-2">
      <ConfirmationCard
        level={level}
        title={buildProposalTitle(item)}
        fields={buildProposalFields(item, resolveCategoryLabel)}
        confirmLabel={level === "riesgo" ? "Eliminar" : "Registrar"}
        confirmAriaLabel={buildConfirmAriaLabel(item)}
        onConfirm={() => confirm.mutate(pendingItemId)}
        onCancel={() => dismiss.mutate(pendingItemId)}
        onFieldChange={(key, value) =>
          edit.mutate({
            pendingItemId,
            patch: { [key]: key === "amount" ? Number(value) : value },
          })
        }
        loading={confirm.isPending || dismiss.isPending}
        undoNote={level === "riesgo" ? "Podrás deshacerlo durante 30 días." : undefined}
      />
      {/* `ERR-ASI-05`: se dice la causa concreta y la tarjeta sigue editable con lo que el usuario ya corrigió. */}
      {confirm.isError ? (
        <p role="alert" className="px-1 text-sm text-error">
          {confirm.error instanceof ApiClientError
            ? confirm.error.message
            : "No pude confirmar la propuesta. Los datos que corregiste siguen aquí."}
        </p>
      ) : null}
    </div>
  );
}
