"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/data/query-keys";
import { getAssistantProposal } from "./assistant-api";

/** El pending item correlacionado de un bloque `propuesta`/`previsualizacion` (`buildWebPresentTurn`, `WEB-D263`). */
export function useAssistantPendingItem(pendingItemId: string | null) {
  return useQuery({
    queryKey: queryKeys.pending.detail(pendingItemId ?? "ninguno"),
    queryFn: () => getAssistantProposal(pendingItemId as string),
    enabled: pendingItemId !== null,
  });
}
