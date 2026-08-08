import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConversationStyleProfile } from "@/agents/conversation-agent";
import { writePersistentConversationStyle } from "@/core/conversation/conversation-style-preferences";
import { LearningEngine } from "@/core/learning/learning-engine";
import { formatConversationStyleInstruction } from "@/core/response/conversation-style-policy";
import {
  getLearningPreferences,
  listFinancialMemory,
  manageFinancialMemory,
} from "@/data/repositories/financial-memory.repository";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

const STYLE_KEY_PREFIX = "preference:conversation_style:";

/**
 * Confianza minima para que una preferencia declarada se acepte de inmediato.
 * Es el mismo umbral que aplica `evaluateLearningCandidate` a la base
 * `explicit_user_statement`: se replica aqui para no gastar una escritura de
 * candidato cuando el turno ya venia dudoso.
 */
const MIN_CAPTURE_CONFIDENCE = 0.85;

export type ConversationStyleCaptureResult = {
  captured: boolean;
  /** Motivo estable para telemetria; nunca se muestra al usuario. */
  reason:
    | "captured"
    | "style_reset"
    | "style_not_persistent"
    | "learning_disabled_by_user"
    | "confidence_below_threshold"
    | "learning_not_promoted"
    | "capture_failed";
  memory_id: string | null;
};

/**
 * Convierte una preferencia de conversacion declarada por el usuario en un
 * recuerdo duradero (`RUL-MEM-01`, clase "preferencia de uso": se aplica sola,
 * no se pregunta y se reemplaza cuando el usuario la contradice).
 *
 * Tres puertas antes de escribir, en este orden:
 *
 *   1. Durabilidad — solo `scope=persistent` se recuerda. "Hoy respondeme
 *      corto" (`turn`) o un ajuste acotado a la charla (`session`) viven en el
 *      estado del hilo y no ensucian la memoria del usuario.
 *   2. Consentimiento — si el usuario apago el aprendizaje, no se captura nada
 *      (`RUL-MEM-05`). Un `reset` si procede: borrar nunca es aprender.
 *   3. Confianza — por debajo de `MIN_CAPTURE_CONFIDENCE` la declaracion queda
 *      como observada y no se promueve. El gate de politica sigue siendo la
 *      autoridad final; aqui solo se evita el viaje.
 *
 * Nunca lanza: la captura es un efecto secundario del turno, jamas una
 * condicion para responderle al usuario.
 */
export async function captureExplicitConversationStyle(input: {
  client: Client;
  userId: string;
  styleUpdate: ConversationStyleProfile | null;
  resetStyle: boolean;
  evidenceRef: string;
  observedAt: string;
  traceId: string;
  /**
   * Confianza del plan que interpreto el turno. Se propaga tal cual al
   * candidato en vez de asumir certeza absoluta: una lectura dudosa del
   * ejecutivo no debe convertirse en un recuerdo permanente.
   */
  confidence: number;
}): Promise<ConversationStyleCaptureResult> {
  try {
    return await runCapture(input);
  } catch (error) {
    // El turno ya se respondio o se esta por responder: un fallo de captura se
    // registra y se traga. Nunca rompe la conversacion.
    logger.warn("learning.conversation_style_capture_failed", {
      user_id: input.userId,
      trace_id: input.traceId,
      evidence_ref: input.evidenceRef,
      error,
    });
    return { captured: false, reason: "capture_failed", memory_id: null };
  }
}

async function runCapture(input: {
  client: Client;
  userId: string;
  styleUpdate: ConversationStyleProfile | null;
  resetStyle: boolean;
  evidenceRef: string;
  observedAt: string;
  traceId: string;
  confidence: number;
}): Promise<ConversationStyleCaptureResult> {
  // Puerta 1: solo lo que el usuario pidio recordar se recuerda.
  if (!input.resetStyle && input.styleUpdate?.scope !== "persistent") {
    return {
      captured: false,
      reason: "style_not_persistent",
      memory_id: null,
    };
  }

  if (input.resetStyle) {
    for (const memory of await listStyleMemories(input.client, input.userId)) {
      await manageFinancialMemory(input.client, {
        userId: input.userId,
        memoryId: memory.id,
        action: "forget",
        reason: "explicit_conversation_style_reset",
        idempotencyKey:
          `conversation-style-reset:${input.evidenceRef}:${memory.id}`,
      });
    }
    await persistStylePreference(input, null);
    return { captured: false, reason: "style_reset", memory_id: null };
  }

  const styleUpdate = input.styleUpdate;
  if (!styleUpdate) {
    return {
      captured: false,
      reason: "style_not_persistent",
      memory_id: null,
    };
  }

  // Puerta 2: consentimiento antes que cualquier escritura.
  const preferences = await getLearningPreferences(input.client, input.userId);
  if (!preferences.enabled) {
    logger.info("learning.conversation_style_capture_skipped", {
      user_id: input.userId,
      trace_id: input.traceId,
      reason: "learning_disabled_by_user",
    });
    return {
      captured: false,
      reason: "learning_disabled_by_user",
      memory_id: null,
    };
  }

  // Puerta 3: una lectura dudosa no se vuelve permanente.
  const confidence = clampConfidence(input.confidence);
  if (confidence < MIN_CAPTURE_CONFIDENCE) {
    logger.info("learning.conversation_style_capture_skipped", {
      user_id: input.userId,
      trace_id: input.traceId,
      reason: "confidence_below_threshold",
      confidence,
    });
    return {
      captured: false,
      reason: "confidence_below_threshold",
      memory_id: null,
    };
  }

  const styleMemories = await listStyleMemories(input.client, input.userId);
  const outcomes = await new LearningEngine(
    input.client,
  ).learnExplicitPreference({
    userId: input.userId,
    canonicalKey: `${STYLE_KEY_PREFIX}${input.evidenceRef}`,
    summary:
      "Preferencia de conversación: " +
      formatConversationStyleInstruction(styleUpdate),
    searchTerms: [
      "preferencia",
      "conversacion",
      "estilo",
      styleUpdate.response_length,
      styleUpdate.formality,
      styleUpdate.directness,
    ],
    evidenceRef: input.evidenceRef,
    claimValue: { conversation_style: styleUpdate },
    observedAt: input.observedAt,
    traceId: input.traceId,
    confidence,
  });

  const promoted = outcomes.find(
    (outcome) => outcome.promoted_to_memory && outcome.memory_id,
  );
  if (!promoted?.memory_id) {
    // El gate pudo mandarla a `pending_confirmation` (sensible) o dejarla en
    // observado. En ninguno de esos casos se toca el estilo vigente.
    logger.warn("learning.conversation_style_learning_not_promoted", {
      user_id: input.userId,
      trace_id: input.traceId,
      evidence_ref: input.evidenceRef,
      outcomes,
    });
    return {
      captured: false,
      reason: "learning_not_promoted",
      memory_id: null,
    };
  }

  // Una preferencia de uso se reemplaza, no se acumula (`RUL-MEM-01`).
  for (const memory of styleMemories) {
    if (memory.id === promoted.memory_id) continue;
    await manageFinancialMemory(input.client, {
      userId: input.userId,
      memoryId: memory.id,
      action: "forget",
      reason: "superseded_by_explicit_conversation_style",
      idempotencyKey:
        `conversation-style-replace:${input.evidenceRef}:${memory.id}`,
    });
  }

  await persistStylePreference(input, styleUpdate);
  return { captured: true, reason: "captured", memory_id: promoted.memory_id };
}

async function listStyleMemories(client: Client, userId: string) {
  const memories = await listFinancialMemory(client, {
    userId,
    statuses: ["confirmed", "suspended"],
    limit: 200,
  });
  return memories.filter((memory) =>
    memory.canonical_key.startsWith(STYLE_KEY_PREFIX),
  );
}

/**
 * Espeja el estilo vigente en `user_preferences` para que los adaptadores de
 * canal lo lean sin pasar por la memoria semantica en cada turno.
 */
async function persistStylePreference(
  input: { client: Client; userId: string },
  style: ConversationStyleProfile | null,
): Promise<void> {
  const current = await input.client
    .from("user_preferences")
    .select("metadata")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (current.error) {
    logger.warn("learning.conversation_style_persist_failed", {
      user_id: input.userId,
      error: current.error,
    });
    return;
  }

  const metadata = writePersistentConversationStyle({
    metadata: current.data?.metadata,
    style,
  });
  const { error } = await input.client
    .from("user_preferences")
    .update({
      tone_style: formatConversationStyleInstruction(style),
      metadata: metadata as Json,
    })
    .eq("user_id", input.userId);

  if (error) {
    logger.warn("learning.conversation_style_persist_failed", {
      user_id: input.userId,
      error,
    });
  }
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
