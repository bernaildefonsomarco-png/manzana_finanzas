import type { Channel } from "@/core/channel/types";

/**
 * Clave de hilo del estado conversacional (`WEB-D096`, `23` §5b.1).
 *
 * El estado conversacional (`conversation_memory_states`) estaba indexado por
 * `(user_id, scope)`: un unico estado global por usuario, compartido por todas
 * las conversaciones. Eso hacia que una propuesta hecha en una conversacion
 * siguiera "esperando confirmacion" en cualquier otra, y que un "si" sobre un
 * tema distinto pudiera ejecutar una operacion vieja. En una app de dinero eso
 * es un peligro, no una molestia.
 *
 * La clave se deriva del turno, nunca del estado guardado:
 *  - si el evento externo trae `thread_id` (el asistente web lo pone en
 *    `handle-web-turn.ts`), el hilo es ese;
 *  - si el canal no tiene hilos todavia, la conversacion es una sola por
 *    canal, y la clave lo dice explicitamente en vez de fingir que no hay
 *    hilo.
 *
 * `LEGACY_THREAD_KEY` es el valor de los estados escritos antes de esta
 * separacion (y el `default` de la columna): nunca coincide con la clave de un
 * turno real, asi que un estado heredado no puede confirmarse por texto.
 */
export const LEGACY_THREAD_KEY = "";

export function resolveTurnThreadKey(input: {
  channel: Channel;
  metadata?: Record<string, unknown> | null;
}): string {
  const threadId = readThreadId(input.metadata);
  return threadId ? `hilo:${threadId}` : `canal:${input.channel}`;
}

function readThreadId(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const value = metadata?.thread_id;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 180) : null;
}
