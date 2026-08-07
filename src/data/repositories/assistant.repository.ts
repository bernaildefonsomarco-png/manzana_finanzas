import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type ThreadStatus = "activo" | "archivado";

export type AssistantThread = {
  id: string;
  user_id: string;
  title: string | null;
  channel: string;
  status: ThreadStatus;
  created_at: string;
  updated_at: string;
};

export type AssistantMessageRole = "usuario" | "asistente" | "sistema";
export type AssistantActionStatus =
  | "propuesta"
  | "confirmada"
  | "descartada"
  | "expirada";

export type AssistantMessage = {
  id: string;
  user_id: string;
  thread_id: string;
  role: AssistantMessageRole;
  content: unknown[];
  evidence_refs: string[];
  proposed_action: Record<string, unknown> | null;
  action_status: AssistantActionStatus | null;
  resulting_movement_id: string | null;
  trace_id: string | null;
  created_at: string;
};

export class AssistantRepositoryError extends Error {
  constructor(
    readonly code: "ASSISTANT_REPOSITORY_ERROR" | "THREAD_NOT_FOUND",
    message: string
  ) {
    super(message);
    this.name = "AssistantRepositoryError";
  }
}

/** `SCR-ASI-03`/`RUL-ASI-01`: un hilo nuevo cuando el turno no referencia uno existente. */
export async function createAssistantThread(
  client: Client,
  userId: string,
  title: string | null = null
): Promise<AssistantThread> {
  const { data, error } = await client
    .from("assistant_threads")
    .insert({ user_id: userId, title })
    .select("*")
    .single();

  if (error || !data) {
    logger.error("assistant_threads.create_failed", { error, user_id: userId });
    throw new AssistantRepositoryError(
      "ASSISTANT_REPOSITORY_ERROR",
      "No se pudo crear la conversacion"
    );
  }

  return data as AssistantThread;
}

export async function getAssistantThreadById(
  client: Client,
  userId: string,
  threadId: string
): Promise<AssistantThread | null> {
  const { data, error } = await client
    .from("assistant_threads")
    .select("*")
    .eq("user_id", userId)
    .eq("id", threadId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logger.error("assistant_threads.get_by_id_failed", {
      error,
      user_id: userId,
      thread_id: threadId,
    });
    throw new AssistantRepositoryError(
      "ASSISTANT_REPOSITORY_ERROR",
      "No se pudo leer la conversacion"
    );
  }

  return (data as AssistantThread | null) ?? null;
}

/** `SCR-ASI-04`: historial, mas reciente primero. Paginacion por cursor la aplica el llamador (ruta API). */
export async function listAssistantThreads(
  client: Client,
  userId: string,
  options: {
    limit: number;
    cursorFilter?: string;
    status?: ThreadStatus;
  }
): Promise<AssistantThread[]> {
  let query = client
    .from("assistant_threads")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(options.limit);

  if (options.status) query = query.eq("status", options.status);
  if (options.cursorFilter) query = query.or(options.cursorFilter);

  const { data, error } = await query;

  if (error) {
    logger.error("assistant_threads.list_failed", { error, user_id: userId });
    throw new AssistantRepositoryError(
      "ASSISTANT_REPOSITORY_ERROR",
      "No se pudieron leer las conversaciones"
    );
  }

  return (data ?? []) as AssistantThread[];
}

/** `ACT-ASI-10`: archivar, unica transicion de estado que expone la API. */
export async function archiveAssistantThread(
  client: Client,
  userId: string,
  threadId: string
): Promise<AssistantThread> {
  const existing = await getAssistantThreadById(client, userId, threadId);
  if (!existing) {
    throw new AssistantRepositoryError("THREAD_NOT_FOUND", "Conversacion no encontrada");
  }

  const { data, error } = await client
    .from("assistant_threads")
    .update({ status: "archivado" })
    .eq("id", threadId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("assistant_threads.archive_failed", {
      error,
      user_id: userId,
      thread_id: threadId,
    });
    throw new AssistantRepositoryError(
      "ASSISTANT_REPOSITORY_ERROR",
      "No se pudo archivar la conversacion"
    );
  }

  return data as AssistantThread;
}

/** `SCR-ASI-03`: mensajes de un hilo, mas antiguo primero (orden de lectura). */
export async function listAssistantMessages(
  client: Client,
  userId: string,
  threadId: string,
  options: { limit: number; cursorFilter?: string }
): Promise<AssistantMessage[]> {
  let query = client
    .from("assistant_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(options.limit);

  if (options.cursorFilter) query = query.or(options.cursorFilter);

  const { data, error } = await query;

  if (error) {
    logger.error("assistant_messages.list_failed", {
      error,
      user_id: userId,
      thread_id: threadId,
    });
    throw new AssistantRepositoryError(
      "ASSISTANT_REPOSITORY_ERROR",
      "No se pudieron leer los mensajes"
    );
  }

  return (data ?? []) as AssistantMessage[];
}

/**
 * `SCR-ASI-03`: los ultimos mensajes del hilo, devueltos en orden de lectura
 * (mas antiguo primero). `listAssistantMessages` pagina desde el inicio del
 * hilo, que es lo que necesita la pantalla; para reconstruir el contexto
 * reciente de una conversacion hace falta la cola, no la cabeza.
 */
export async function listRecentAssistantMessages(
  client: Client,
  userId: string,
  threadId: string,
  options: { limit: number }
): Promise<AssistantMessage[]> {
  const { data, error } = await client
    .from("assistant_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(options.limit);

  if (error) {
    logger.error("assistant_messages.list_recent_failed", {
      error,
      user_id: userId,
      thread_id: threadId,
    });
    throw new AssistantRepositoryError(
      "ASSISTANT_REPOSITORY_ERROR",
      "No se pudieron leer los mensajes recientes"
    );
  }

  return ((data ?? []) as AssistantMessage[]).reverse();
}

export function toJsonContent(value: unknown): Json {
  return value as Json;
}
