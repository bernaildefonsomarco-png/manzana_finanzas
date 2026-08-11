import type { SupabaseClient } from "@supabase/supabase-js";

import { getLearningPreferences } from "@/data/repositories/financial-memory.repository";
import {
  recordProfileCandidateObservation,
  type ProfileCandidateRow,
  type ProfileObservationReason,
} from "@/data/repositories/profile-candidates.repository";
import type { Database } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";
import type { ProfileCandidateDraft } from "./profile-signal";

type Client = SupabaseClient<Database>;

/**
 * `20c` §6b.1: registra en el momento, sin interrumpir, el hecho de perfil que
 * el turno dejo ver. Preguntar es otra cosa y viene despues (`AC-PERF-02`).
 *
 * Es el gemelo de `captureExplicitConversationStyle` y comparte su regla dura:
 * **nunca lanza**. La captura es un efecto secundario del turno, jamas una
 * condicion para responderle al usuario. Si la base falla, se registra y se
 * sigue; el usuario recibe su respuesta igual.
 */

export type ProfileCaptureResult = {
  captured: boolean;
  /** Motivo estable para telemetria; nunca se le muestra al usuario. */
  reason:
    | ProfileObservationReason
    | "no_signal"
    | "learning_disabled_by_user"
    | "narrative_memory_not_allowed"
    | "capture_failed";
  candidate: ProfileCandidateRow | null;
};

export async function captureProfileCandidate(input: {
  client: Client;
  userId: string;
  draft: ProfileCandidateDraft | null;
  /** `external_event_log.id` del turno: la evidencia de donde salio el hecho. */
  evidenceRef: string;
  observedAt: string;
  traceId: string;
}): Promise<ProfileCaptureResult> {
  if (!input.draft) {
    return { captured: false, reason: "no_signal", candidate: null };
  }

  try {
    return await runCapture(input as CaptureInput);
  } catch (error) {
    logger.warn("profile.candidate_capture_failed", {
      user_id: input.userId,
      trace_id: input.traceId,
      evidence_ref: input.evidenceRef,
      subject_key: input.draft.subjectKey,
      error,
    });
    return { captured: false, reason: "capture_failed", candidate: null };
  }
}

type CaptureInput = {
  client: Client;
  userId: string;
  draft: ProfileCandidateDraft;
  evidenceRef: string;
  observedAt: string;
  traceId: string;
};

async function runCapture(input: CaptureInput): Promise<ProfileCaptureResult> {
  // `RUL-MEM-05`: el consentimiento manda y va antes que cualquier escritura.
  // Con el aprendizaje apagado no se genera ni un candidato.
  const preferences = await getLearningPreferences(input.client, input.userId);
  if (!preferences.enabled) {
    logger.info("profile.candidate_capture_skipped", {
      user_id: input.userId,
      trace_id: input.traceId,
      reason: "learning_disabled_by_user",
    });
    return {
      captured: false,
      reason: "learning_disabled_by_user",
      candidate: null,
    };
  }

  // La capa `vinculo` es relato sobre la persona —su carga emocional, su
  // preocupacion, su objetivo declarado—, que es exactamente lo que gobierna
  // `allow_narrative_memory` para `narrative_fact` en la memoria clasificatoria.
  // Quien apago el relato ahi no espera que entre por otra puerta.
  if (input.draft.capa === "vinculo" && !preferences.allow_narrative_memory) {
    logger.info("profile.candidate_capture_skipped", {
      user_id: input.userId,
      trace_id: input.traceId,
      reason: "narrative_memory_not_allowed",
    });
    return {
      captured: false,
      reason: "narrative_memory_not_allowed",
      candidate: null,
    };
  }

  const result = await recordProfileCandidateObservation(input.client, {
    userId: input.userId,
    subjectKey: input.draft.subjectKey,
    statement: input.draft.statement,
    evidenceRef: `evento:${input.evidenceRef}`,
    metadata: {
      capa: input.draft.capa,
      origin: input.draft.origin,
      // `20c` §3: lo que este hecho desbloquea viaja con el candidato porque es
      // lo que el gate mira para decidir si merece una pregunta.
      desbloquea: input.draft.desbloquea,
      observed_at: input.observedAt,
    },
    now: input.observedAt,
  });

  return {
    captured: result.candidate !== null,
    reason: result.reason,
    candidate: result.candidate,
  };
}
