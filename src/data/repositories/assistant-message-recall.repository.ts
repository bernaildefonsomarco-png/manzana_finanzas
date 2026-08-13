import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createMemoryEmbedding,
  toVectorLiteral,
} from "@/agents/runtime/openai-embeddings";
import type { Database } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";
import {
  readAssistantMessageText,
  type AssistantMessageRole,
} from "./assistant.repository";
import { createSemanticRecallAvailability } from "./semantic-recall-availability";

type Client = SupabaseClient<Database>;

/**
 * Memoria semantica del hilo (`077_assistant_message_semantic_recall.sql`).
 *
 * Al modelo solo le llegan los ultimos 20 turnos. Todo lo anterior seguia
 * escrito en `assistant_messages` —la pantalla lo muestra— pero para el
 * asistente no existia: una conversacion larga se comportaba como si la persona
 * nunca hubiera explicado nada. Este modulo recupera, por significado, los
 * pedazos del hilo que quedaron fuera de esa ventana.
 *
 * Dos propiedades que hay que conservar si esto se toca:
 *
 * 1. **Nunca autoriza nada.** Un fragmento recuperado es contexto de lo que se
 *    dijo, no una confirmacion vigente. Toda escritura sigue exigiendo su
 *    propia confirmacion dentro del turno, con su vigencia y su hilo.
 * 2. **Nunca tumba el turno.** Sin migracion aplicada, sin vectores todavia,
 *    con la API de embeddings caida o apagada, esto devuelve vacio y el
 *    asistente se comporta como antes: los ultimos 20 turnos y nada mas.
 */

const semanticRecall = createSemanticRecallAvailability({
  functionName: "search_assistant_messages_semantic",
  migration: "077_assistant_message_semantic_recall.sql",
});

/** Solo para pruebas: vuelve a preguntar si la recuperacion del hilo existe. */
export function resetAssistantMessageRecallCache(): void {
  semanticRecall.reset();
}

export function isAssistantMessageRecallAvailable(): boolean {
  return semanticRecall.isAvailable();
}

/**
 * Piso de similitud coseno, mas alto que el de la memoria confirmada (0.25).
 *
 * Ahi el vecino mas cercano compite contra un catalogo chico de recuerdos que
 * el usuario ya autorizo; aqui compite contra el hilo entero, donde siempre hay
 * *algo* que se parece un poco. Con el piso bajo, cada turno arrastraria charla
 * vieja sin relacion y el modelo la leeria como contexto — el fallo opuesto al
 * que esto viene a arreglar.
 */
const MIN_SIMILARITY = 0.4;

export type RecalledThreadMessage = {
  id: string;
  role: Exclude<AssistantMessageRole, "sistema">;
  text: string;
  created_at: string;
  similarity: number;
};

/**
 * Fragmentos anteriores del mismo hilo, ordenados como se dijeron.
 *
 * `before` es el corte que evita repetirse: es la fecha del mensaje mas viejo
 * que ya viaja textual en la ventana reciente, asi que esto solo mira lo que
 * quedo antes. Sin ese corte, la recuperacion devolveria turnos que el modelo
 * ya esta leyendo y gastaria contexto en duplicarlos.
 */
export async function recallOlderThreadMessages(
  client: Client,
  input: {
    userId: string;
    threadId: string;
    /** Mensaje del turno en curso: es contra esto que se busca parecido. */
    queryText: string;
    /** Solo se recupera lo anterior a esta fecha. */
    before: string;
    limit?: number;
  },
): Promise<RecalledThreadMessage[]> {
  if (!semanticRecall.isAvailable()) return [];

  const queryText = input.queryText.trim();
  if (!queryText) return [];
  const limit = input.limit ?? 6;

  try {
    const embedding = await createMemoryEmbedding(queryText);
    if (!embedding) return [];

    const { data, error } = await client.rpc(
      "search_assistant_messages_semantic",
      {
        p_user_id: input.userId,
        p_thread_id: input.threadId,
        p_query_embedding: toVectorLiteral(embedding.vector),
        p_before: input.before,
        // Se piden mas candidatos que los que se devuelven porque el piso de
        // similitud todavia puede descartar varios.
        p_limit: Math.min(Math.max(limit * 2, 8), 50),
      },
    );

    if (error) {
      if (!semanticRecall.markAbsentIfMissing(error)) {
        logger.warn("assistant_recall.ranking_failed", {
          error,
          user_id: input.userId,
          thread_id: input.threadId,
        });
      }
      return [];
    }

    semanticRecall.markPresent();
    const ranked = new Map(
      (data ?? [])
        .filter((row) => Number(row.similarity) >= MIN_SIMILARITY)
        .slice(0, limit)
        .map((row) => [row.id, Number(row.similarity)] as const),
    );
    if (ranked.size === 0) return [];

    // El ranking devuelve `(id, similitud)` y nada mas: los mensajes se
    // vuelven a leer aqui, con el filtro por usuario e hilo repetido, para que
    // ninguna fila entre al contexto del modelo por la puerta de la RPC.
    const { data: messages, error: readError } = await client
      .from("assistant_messages")
      .select("id,role,content,created_at")
      .eq("user_id", input.userId)
      .eq("thread_id", input.threadId)
      .in("id", [...ranked.keys()]);

    if (readError) throw readError;

    return (messages ?? [])
      .flatMap((message) => {
        if (message.role !== "usuario" && message.role !== "asistente") return [];
        const text = readAssistantMessageText(message.content);
        if (!text) return [];
        return [
          {
            id: message.id,
            role: message.role,
            text,
            created_at: message.created_at,
            similarity: ranked.get(message.id) ?? 0,
          },
        ];
      })
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
  } catch (error) {
    logger.warn("assistant_recall.failed", {
      error,
      user_id: input.userId,
      thread_id: input.threadId,
    });
    return [];
  }
}

/**
 * Vectoriza los mensajes de un turno ya resuelto (el de la persona y el del
 * asistente) para que un turno futuro pueda encontrarlos cuando salgan de la
 * ventana reciente.
 *
 * Se llama **despues** de responder, nunca antes: un embedding no puede
 * meterse en el camino de la respuesta que la persona esta esperando. Y no es
 * condicion de exito de nada — un mensaje sin vector sigue siendo un mensaje
 * valido, solo queda invisible para la recuperacion hasta que lo alcance el
 * backfill.
 */
export async function rememberThreadTurnEmbeddings(
  client: Client,
  input: { userId: string; threadId: string; traceId: string },
): Promise<number> {
  if (!semanticRecall.isAvailable()) return 0;

  try {
    const { data, error } = await client
      .from("assistant_messages")
      .select("id,role,content")
      .eq("user_id", input.userId)
      .eq("thread_id", input.threadId)
      .eq("trace_id", input.traceId)
      .is("embedding", null);

    if (error) {
      if (semanticRecall.markAbsentIfMissing(error)) return 0;
      throw error;
    }

    let written = 0;
    for (const message of data ?? []) {
      if (message.role !== "usuario" && message.role !== "asistente") continue;
      const text = readAssistantMessageText(message.content);
      if (!text) continue;

      const embedding = await createMemoryEmbedding(text);
      if (!embedding) return written;

      const { data: updated, error: writeError } = await client
        .from("assistant_messages")
        .update({
          embedding: toVectorLiteral(embedding.vector),
          embedding_model: embedding.model,
          embedding_input_hash: hashAssistantMessageText(text),
          embedding_generated_at: new Date().toISOString(),
        })
        .eq("id", message.id)
        .eq("user_id", input.userId)
        .select("id");

      if (writeError) {
        if (semanticRecall.markAbsentIfMissing(writeError)) return written;
        throw writeError;
      }
      if (!updated || updated.length === 0) {
        // El cliente no tiene permiso de escritura sobre la fila. No rompe el
        // turno, pero sin este aviso el mensaje se queda sin vector para
        // siempre y nadie se entera.
        logger.warn("assistant_recall.embedding_not_written", {
          user_id: input.userId,
          message_id: message.id,
        });
        continue;
      }
      written += 1;
    }
    return written;
  } catch (error) {
    logger.warn("assistant_recall.embedding_write_failed", {
      error,
      user_id: input.userId,
      thread_id: input.threadId,
      trace_id: input.traceId,
    });
    return 0;
  }
}

/**
 * FNV-1a. Detecta que el texto del mensaje cambio, no protege nada: es el mismo
 * hash que usa la memoria confirmada, y por el mismo motivo (no traer
 * `node:crypto` a un modulo que tambien se empaqueta para runtimes sin el).
 */
export function hashAssistantMessageText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
