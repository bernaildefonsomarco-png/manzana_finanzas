// Política de cuándo preguntar por un candidato de perfil dentro de un
// turno (`20c` §3, `AC-PERF-02`). Determinista: decide cuál (si alguno) de
// los candidatos pendientes se pregunta, nunca cuántos a la vez.
//
// Lo que este módulo NO decide: si un candidato "desbloquea algo concreto"
// — eso depende del turno y de qué pregunta el usuario, y lo declara quien
// llama (`desbloqueaAlgoConcreto`). Este módulo solo aplica el límite de
// frecuencia y de reintentos que `20c` §3 exige sin excepción.

const TOPE_DE_INTENTOS_IGNORADOS = 2;

export type ProfileConfirmationCandidate = {
  id: string;
  subjectKey: string;
  /** `user_profile_candidates.ask_count` — veces que ya se preguntó y se ignoró. */
  askCount: number;
};

export type ProfileConfirmationGateInput<
  TCandidate extends ProfileConfirmationCandidate,
> = {
  /** `conversation_context.active_conversation_state.state_id === null`. */
  esPrimerTurnoDeLaConversacion: boolean;
  /** Ya se preguntó por perfil en algún turno anterior de esta misma conversación. */
  yaSePreguntoEnEstaConversacion: boolean;
  candidatos: TCandidate[];
  /** `20c` §3: "se pregunta cuando el hecho desbloquea algo concreto". */
  desbloqueaAlgoConcreto: (candidato: TCandidate) => boolean;
};

export type ProfileConfirmationGateResult<
  TCandidate extends ProfileConfirmationCandidate,
> =
  | {
      preguntar: false;
      razon:
        | "primer_turno"
        | "ya_se_pregunto_en_esta_conversacion"
        | "sin_candidatos_elegibles";
    }
  | { preguntar: true; candidato: TCandidate };

/**
 * `AC-PERF-02`: como máximo una confirmación de perfil por conversación, y
 * nunca en el primer turno. `20c` §3: si el usuario ignoró un candidato dos
 * veces, no se vuelve a preguntar por él.
 */
export function decidirConfirmacionDePerfil<
  TCandidate extends ProfileConfirmationCandidate,
>(
  input: ProfileConfirmationGateInput<TCandidate>,
): ProfileConfirmationGateResult<TCandidate> {
  if (input.esPrimerTurnoDeLaConversacion) {
    return { preguntar: false, razon: "primer_turno" };
  }
  if (input.yaSePreguntoEnEstaConversacion) {
    return { preguntar: false, razon: "ya_se_pregunto_en_esta_conversacion" };
  }

  const elegibles = input.candidatos.filter(
    (candidato) =>
      candidato.askCount < TOPE_DE_INTENTOS_IGNORADOS &&
      input.desbloqueaAlgoConcreto(candidato),
  );
  if (elegibles.length === 0) {
    return { preguntar: false, razon: "sin_candidatos_elegibles" };
  }

  // Determinista: el que menos veces se preguntó ya, y entre empates el
  // orden de llegada (`candidatos` ya viene ordenado por quien llama).
  const elegido = elegibles.reduce((mejor, actual) =>
    actual.askCount < mejor.askCount ? actual : mejor,
  );
  return { preguntar: true, candidato: elegido };
}
