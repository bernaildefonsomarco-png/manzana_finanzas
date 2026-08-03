"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/data/query-keys";
import { invalidateForMutation } from "@/shared/data/invalidation";
import { getAssistantThread, listAssistantThreads, postAssistantTurn } from "./assistant-api";

/**
 * `RUL-ASI-02`: no guarda el hilo ni los mensajes en memoria — solo
 * recuerda, mientras dura esta pestaña, cuál hilo activo se acaba de crear
 * (para no esperar a que el listado de hilos se refresque antes de poder
 * seguir escribiendo en el mismo). Recargar la pagina vuelve a resolverlo
 * desde el servidor (el hilo mas reciente y no archivado).
 */
export function useAssistantConversation(initialThreadId: string | null = null) {
  const queryClient = useQueryClient();
  const [threadIdOverride, setThreadIdOverride] = useState<string | null>(initialThreadId);

  const threadsQuery = useQuery({
    queryKey: queryKeys.assistant.threads,
    queryFn: () => listAssistantThreads("activo"),
  });

  const activeThreadId = threadIdOverride ?? threadsQuery.data?.[0]?.id ?? null;

  const threadQuery = useQuery({
    queryKey: queryKeys.assistant.thread(activeThreadId ?? "sin-hilo"),
    queryFn: () => getAssistantThread(activeThreadId as string),
    enabled: activeThreadId !== null,
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => postAssistantTurn({ threadId: activeThreadId, text }),
    onSuccess: async (data) => {
      setThreadIdOverride(data.thread_id);
      await invalidateForMutation(queryClient, "assistant.thread_updated", {
        threadId: data.thread_id,
      });
    },
  });

  return {
    threadId: activeThreadId,
    messages: threadQuery.data?.messages ?? [],
    isLoadingThread: activeThreadId !== null && threadQuery.isLoading,
    sendMessage: (text: string) => sendMutation.mutateAsync(text),
    isSending: sendMutation.isPending,
    sendError: sendMutation.error,
  };
}
