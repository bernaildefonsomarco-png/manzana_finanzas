import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveProfileCandidateForUser,
  type ProfileCandidateRow,
} from "@/data/repositories/profile-candidates.repository";
import type { Database } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";
import type { ProfileAnswer } from "./profile-confirmation-turn";

type Client = SupabaseClient<Database>;

/**
 * `ACT-MEM-03`/`ACT-MEM-04`/`ACT-MEM-05`: aplica la respuesta del usuario a la
 * pregunta de perfil.
 *
 * Los tres desenlaces llevan texto. Un turno de este camino **no puede quedar
 * mudo** (`WEB-D296`): el usuario acaba de responder a una pregunta y tiene que
 * saber que paso con su respuesta, incluso —sobre todo— cuando falla.
 */
export type ProfileConfirmationResult = {
  kind: "applied" | "failed";
  answer: ProfileAnswer;
  candidateId: string;
  promotedFactId: string | null;
  text: string;
};

export async function applyProfileConfirmation(input: {
  client: Client;
  userId: string;
  candidato: ProfileCandidateRow;
  answer: ProfileAnswer;
  traceId: string;
}): Promise<ProfileConfirmationResult> {
  const { client, userId, candidato, answer, traceId } = input;
  try {
    const result = await resolveProfileCandidateForUser(client, {
      userId,
      candidateId: candidato.id,
      resolution: answer,
      // El enunciado confirmado es el que se le mostro, textualmente. Una
      // correccion con palabras propias ("no exactamente, es el 20") entra como
      // `dicho` por la pantalla (`36` §19, caso 5) y no por aqui: el motor no
      // reescribe un hecho sobre alguien con su propia parafrasis.
      statement: candidato.statement,
      idempotencyKey: `profile-confirm:${traceId}:${candidato.id}:${answer}`,
    });
    return {
      kind: "applied",
      answer,
      candidateId: candidato.id,
      promotedFactId: result.promotedFactId,
      text: textoDeExito(answer),
    };
  } catch (error) {
    logger.warn("profile.confirmation_failed", {
      user_id: userId,
      trace_id: traceId,
      candidate_id: candidato.id,
      answer,
      error,
    });
    return {
      kind: "failed",
      answer,
      candidateId: candidato.id,
      promotedFactId: null,
      text: "No pude guardar tu respuesta ahora mismo, así que no cambié nada. Puedes decírmelo otra vez, o hacerlo en Configuración › Memoria.",
    };
  }
}

/**
 * `40` §3.1: nivel `ninguna` no significa en silencio. Cada texto dice que
 * quedo guardado y como se deshace, porque sin tarjeta previa esta frase es la
 * unica oportunidad que tiene el usuario de enterarse.
 */
function textoDeExito(answer: ProfileAnswer): string {
  if (answer === "confirm") {
    return "Anotado, gracias. Lo tendré en cuenta de ahora en adelante, y puedes cambiarlo o borrarlo cuando quieras en Configuración › Memoria.";
  }
  if (answer === "reject") {
    return "Perfecto, lo descarto y no lo doy por cierto. Si quieres contarme cómo es de verdad, dímelo cuando quieras.";
  }
  return "Listo, no vuelvo a preguntarte por esto.";
}
