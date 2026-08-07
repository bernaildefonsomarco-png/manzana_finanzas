import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { AgentConversationTurn } from "@/agents/runtime/types";
import type { AssistantMessage } from "@/data/repositories/assistant.repository";
import { listRecentAssistantMessages } from "@/data/repositories/assistant.repository";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

/**
 * Cuantos mensajes del hilo se reconstruyen. Se leen mas de los que se
 * entregan porque el mensaje del turno actual y los de `sistema` se
 * descartan despues de leer.
 */
const HISTORY_READ_LIMIT = 30;
const HISTORY_TURN_LIMIT = 20;

/**
 * Reconstruye la conversacion previa de un hilo para que el motor la reciba
 * como turnos con autor.
 *
 * El historial siempre estuvo persistido en `assistant_messages` — lo lee la
 * pantalla del asistente — pero nunca llegaba al modelo: cada turno se
 * armaba como un Context Pack aislado. Esto es solo la lectura; quien decide
 * que hacer con ella es el orquestador.
 *
 * Nunca lanza: un hilo sin historial legible degrada a "sin memoria de la
 * conversacion", que es exactamente el comportamiento actual, y jamas debe
 * tumbar el turno que el usuario esta esperando.
 */
export async function readThreadConversationHistory(input: {
  client: Client;
  userId: string;
  threadId: string | null;
  /** Trace del turno en curso: su mensaje ya viaja en el Context Pack. */
  excludeTraceId: string;
}): Promise<AgentConversationTurn[]> {
  if (!input.threadId) return [];

  try {
    const messages = await listRecentAssistantMessages(
      input.client,
      input.userId,
      input.threadId,
      { limit: HISTORY_READ_LIMIT }
    );

    return messages
      .filter((message) => message.trace_id !== input.excludeTraceId)
      .flatMap(toConversationTurn)
      .slice(-HISTORY_TURN_LIMIT);
  } catch (error) {
    logger.warn("assistant.conversation_history_unavailable", {
      error,
      thread_id: input.threadId,
      trace_id: input.excludeTraceId,
    });
    return [];
  }
}

function toConversationTurn(message: AssistantMessage): AgentConversationTurn[] {
  // Un mensaje de `sistema` no es algo que nadie dijo en el hilo: no forma
  // parte de la conversacion que el modelo tiene que recordar.
  if (message.role !== "usuario" && message.role !== "asistente") return [];

  const text = readBlocksText(message.content);
  if (!text) return [];

  return [
    {
      role: message.role === "usuario" ? "user" : "assistant",
      text,
    },
  ];
}

/**
 * `13` S7.5: el contenido persistido son bloques neutrales de canal, no
 * texto renderizado. Para el modelo se recupera lo legible — la misma regla
 * que ya usa el presentador web para resumir un turno.
 */
function readBlocksText(content: unknown[]): string {
  if (!Array.isArray(content)) return "";

  return content
    .map((block) =>
      block !== null &&
      typeof block === "object" &&
      "text" in block &&
      typeof (block as { text: unknown }).text === "string"
        ? (block as { text: string }).text.trim()
        : null
    )
    .filter((text): text is string => Boolean(text))
    .join("\n\n")
    .trim();
}
