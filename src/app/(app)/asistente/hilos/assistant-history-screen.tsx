"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/data/query-keys";
import { invalidateForMutation } from "@/shared/data/invalidation";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { archiveAssistantThread, listAssistantThreads } from "../assistant-api";
import { AssistantThreadRow } from "./assistant-thread-row";

/** `SCR-ASI-04`: historial de conversaciones, mas reciente primero. */
export function AssistantHistoryScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.assistant.threads,
    queryFn: () => listAssistantThreads(),
  });

  const archive = useMutation({
    mutationFn: (threadId: string) => archiveAssistantThread(threadId),
    onSuccess: (_result, threadId) =>
      invalidateForMutation(queryClient, "assistant.thread_updated", { threadId }),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) {
    return (
      <ErrorState
        description="No pude leer tus conversaciones."
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.data || query.data.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay conversaciones"
        description="Cuando le escribas algo a Manzana, aparecerá aquí."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {query.data.map((thread) => (
        <AssistantThreadRow
          key={thread.id}
          thread={thread}
          onArchive={(threadId) => archive.mutate(threadId)}
          archiving={archive.isPending && archive.variables === thread.id}
        />
      ))}
    </ul>
  );
}
