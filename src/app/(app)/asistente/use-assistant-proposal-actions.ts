"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PendingItem } from "@/shared/types/domain";
import { queryKeys } from "@/shared/data/query-keys";
import { invalidateForMutation } from "@/shared/data/invalidation";
import {
  confirmAssistantProposal,
  dismissAssistantProposal,
  editAssistantProposal,
} from "./assistant-api";

/**
 * `ACT-ASI-04`: confirmar ejecuta de verdad (mismo camino que
 * `/pending/[id]/confirm`), por eso invalida exactamente lo que
 * `"pending.confirm"` ya invalida en el resto de la app (movimientos,
 * resumen, presupuestos…) en vez de una entrada paralela que pudiera
 * divergir.
 */
export function useAssistantProposalActions(threadId: string | null) {
  const queryClient = useQueryClient();

  const confirm = useMutation({
    mutationFn: (pendingItemId: string) => confirmAssistantProposal(pendingItemId),
    onSuccess: async (_result, pendingItemId) => {
      await invalidateForMutation(queryClient, "pending.confirm");
      await queryClient.invalidateQueries({ queryKey: queryKeys.pending.detail(pendingItemId) });
      if (threadId) {
        await invalidateForMutation(queryClient, "assistant.thread_updated", { threadId });
      }
    },
  });

  const dismiss = useMutation({
    mutationFn: (pendingItemId: string) => dismissAssistantProposal(pendingItemId),
    onSuccess: async (_result, pendingItemId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pending.detail(pendingItemId) });
      if (threadId) {
        await invalidateForMutation(queryClient, "assistant.thread_updated", { threadId });
      }
    },
  });

  const edit = useMutation({
    mutationFn: (input: {
      pendingItemId: string;
      patch: Partial<PendingItem["normalized_summary"]>;
    }) => editAssistantProposal(input.pendingItemId, input.patch),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.pending.detail(variables.pendingItemId),
      });
    },
  });

  return { confirm, dismiss, edit };
}
