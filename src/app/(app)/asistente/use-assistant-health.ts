"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/data/query-keys";
import { getAssistantHealth } from "./assistant-api";

/** `41` S19: se consulta al abrir el panel, no en cada turno — `staleTime` evita repetirlo si se cierra y abre rapido. */
export function useAssistantHealth() {
  return useQuery({
    queryKey: queryKeys.assistant.health,
    queryFn: getAssistantHealth,
    staleTime: 60_000,
  });
}
