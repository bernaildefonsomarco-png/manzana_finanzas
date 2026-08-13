import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { AgentConversationTurn } from "@/agents/runtime/types";
import type { AssistantMessage } from "@/data/repositories/assistant.repository";
import {
  listRecentAssistantMessages,
  readAssistantMessageText,
} from "@/data/repositories/assistant.repository";
import { recallOlderThreadMessages } from "@/data/repositories/assistant-message-recall.repository";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

/**
 * Cuantos mensajes del hilo se reconstruyen. Se leen mas de los que se
 * entregan porque el mensaje del turno actual y los de `sistema` se
 * descartan despues de leer.
 */
const HISTORY_READ_LIMIT = 30;
const HISTORY_TURN_LIMIT = 20;

/** Cuantos fragmentos viejos se recuperan por significado (`077`). */
const RECALL_LIMIT = 6;

/**
 * Reconstruye la conversacion previa de un hilo para que el motor la reciba
 * como turnos con autor.
 *
 * El historial siempre estuvo persistido en `assistant_messages` — lo lee la
 * pantalla del asistente — pero nunca llegaba al modelo: cada turno se
 * armaba como un Context Pack aislado. Esto es solo la lectura; quien decide
 * que hacer con ella es el orquestador.
 *
 * Devuelve dos cosas en una sola lista, en este orden:
 *
 *   1. fragmentos viejos recuperados por significado, marcados `recalled`;
 *   2. los ultimos turnos textuales, tal cual se dijeron.
 *
 * La ventana textual no crece: mandar un hilo largo entero es caro, lento y
 * ademas peor, porque el modelo se pierde. Lo que se recupera de mas alla de
 * esa ventana son unos pocos pedazos que se parecen a lo que la persona acaba
 * de escribir (`077_assistant_message_semantic_recall.sql`).
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
  /**
   * Lo que la persona acaba de escribir. Sin esto no hay contra que buscar
   * parecido y solo se devuelve la ventana textual.
   */
  queryText?: string;
}): Promise<AgentConversationTurn[]> {
  if (!input.threadId) return [];

  let messages: AssistantMessage[];
  try {
    messages = await listRecentAssistantMessages(
      input.client,
      input.userId,
      input.threadId,
      { limit: HISTORY_READ_LIMIT }
    );
  } catch (error) {
    logger.warn("assistant.conversation_history_unavailable", {
      error,
      thread_id: input.threadId,
      trace_id: input.excludeTraceId,
    });
    return [];
  }

  const conversational = messages
    .filter((message) => message.trace_id !== input.excludeTraceId)
    .flatMap(toConversationTurn);
  const recent = conversational.slice(-HISTORY_TURN_LIMIT);

  const recalled = await readRecalledTurns(
    input,
    messages,
    conversational,
    recent
  );

  return [...recalled, ...recent.map(({ turn }) => turn)];
}

type DatedTurn = { turn: AgentConversationTurn; createdAt: string };

/**
 * Los fragmentos viejos, o nada. Cualquier fallo de aqui —migracion sin
 * aplicar, mensajes sin vector todavia, API de embeddings caida— deja el turno
 * exactamente como estaba antes de `077`: los ultimos 20 turnos y nada mas.
 */
async function readRecalledTurns(
  input: {
    client: Client;
    userId: string;
    threadId: string | null;
    queryText?: string;
  },
  messages: AssistantMessage[],
  conversational: DatedTurn[],
  recent: DatedTurn[]
): Promise<AgentConversationTurn[]> {
  const queryText = input.queryText?.trim();
  if (!input.threadId || !queryText) return [];

  // El corte: solo se recupera lo anterior al mensaje mas viejo que ya viaja
  // textual. Sin el, la busqueda devolveria turnos que el modelo ya esta
  // leyendo.
  const oldestDelivered = recent[0]?.createdAt;
  if (!oldestDelivered) return [];

  // Y si no quedo nada afuera, no hay nada que recuperar: ni una llamada de
  // embeddings se gasta en un hilo corto, que es la mayoria de los hilos.
  const droppedTurns = conversational.length > recent.length;
  const mayHaveOlderMessages = messages.length >= HISTORY_READ_LIMIT;
  if (!droppedTurns && !mayHaveOlderMessages) return [];

  const recalled = await recallOlderThreadMessages(input.client, {
    userId: input.userId,
    threadId: input.threadId,
    queryText,
    before: oldestDelivered,
    limit: RECALL_LIMIT,
  });

  return recalled.map((message) => ({
    role: message.role === "usuario" ? ("user" as const) : ("assistant" as const),
    text: message.text,
    recalled: true,
    said_at: message.created_at,
  }));
}

function toConversationTurn(message: AssistantMessage): DatedTurn[] {
  // Un mensaje de `sistema` no es algo que nadie dijo en el hilo: no forma
  // parte de la conversacion que el modelo tiene que recordar.
  if (message.role !== "usuario" && message.role !== "asistente") return [];

  const text = readAssistantMessageText(message.content);
  if (!text) return [];

  return [
    {
      turn: {
        role: message.role === "usuario" ? "user" : "assistant",
        text,
      },
      createdAt: message.created_at,
    },
  ];
}
