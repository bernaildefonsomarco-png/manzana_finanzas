import { randomUUID } from "crypto";

/**
 * Genera un trace_id único para rastrear una operación de extremo a extremo.
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Contexto de traza para pasar entre capas.
 */
export type TraceContext = {
  traceId: string;
  userId?: string;
  operation?: string;
  startedAt: number;
};

/**
 * Crea un nuevo contexto de traza.
 */
export function createTrace(
  operation: string,
  userId?: string
): TraceContext {
  return {
    traceId: generateTraceId(),
    userId,
    operation,
    startedAt: Date.now(),
  };
}

/**
 * Devuelve la duración en ms desde que se creó el trace.
 */
export function traceElapsedMs(trace: TraceContext): number {
  return Date.now() - trace.startedAt;
}
