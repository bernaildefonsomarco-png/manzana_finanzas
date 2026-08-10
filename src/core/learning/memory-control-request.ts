import type { MemoryControlRequest } from "@/agents/conversational-executive-agent/types";
import type { MemoryControlCommand } from "./memory-control-from-text";

/**
 * `RUL-MEM-16`: convierte lo que el ejecutivo entendio en una orden tipada de
 * memoria, o en `null` cuando este turno no habla de memoria.
 *
 * Aqui vive el criterio duro que el modelo no decide solo, igual que en
 * `compileStructureProposal`:
 *
 *  - si el modelo declaro una duda, el turno **pregunta** con los codigos en
 *    vez de actuar;
 *  - si la confianza no llega al minimo de esa accion, tampoco actua;
 *  - el modelo nunca elige el recuerdo: solo repite las palabras con las que el
 *    usuario lo senalo. Quien desambigua es el nucleo, contra los recuerdos
 *    reales.
 *
 * Nada de esto ejecuta: `forget` y `correct` son nivel `tarjeta` en el catalogo
 * y terminan en una propuesta que el usuario confirma en el turno siguiente.
 */

/** Ver, apagar el aprendizaje o preguntar: barato equivocarse, se deshace solo. */
const MIN_MEMORY_CONFIDENCE = 0.6;

/**
 * Olvidar, corregir y **volver a encender el aprendizaje** exigen mas.
 *
 * Los dos primeros por destructivos. El tercero por consentimiento: apagar de
 * mas solo cuesta que el asistente recuerde menos, pero encender de mas
 * reanudaria un tratamiento de datos que el usuario no pidio, y eso no se
 * repara con un `/undo`.
 */
const MIN_SENSITIVE_MEMORY_CONFIDENCE = 0.75;

export function compileMemoryControlRequest(
  request: MemoryControlRequest | null | undefined,
): MemoryControlCommand | null {
  if (!request || request.intent === "none") return null;

  // Una duda declarada no se resuelve adivinando: se muestra la lista con sus
  // codigos y se deja que el usuario senale.
  if (request.ambiguities.length > 0) return { action: "clarify" };

  const minConfidence =
    request.intent === "forget" ||
    request.intent === "correct" ||
    request.intent === "enable"
      ? MIN_SENSITIVE_MEMORY_CONFIDENCE
      : MIN_MEMORY_CONFIDENCE;
  if (request.confidence < minConfidence) {
    // Con poca confianza en un `forget_all` no se ofrece la via de pantalla
    // como si el usuario la hubiera pedido: se pregunta.
    return { action: "clarify" };
  }

  if (request.intent === "list") return { action: "list" };
  if (request.intent === "enable") return { action: "enable" };
  if (request.intent === "disable") return { action: "disable" };
  if (request.intent === "forget_all") return { action: "forget_all" };
  if (request.intent === "forget") {
    return { action: "forget", query: request.target.trim() };
  }
  return {
    action: "correct",
    query: request.target.trim(),
    summary: request.replacement.trim(),
  };
}
