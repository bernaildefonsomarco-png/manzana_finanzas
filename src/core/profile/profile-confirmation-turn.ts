import type { Block, BlockOption } from "@/core/channel/types";
import type { ProfileCandidateRow } from "@/data/repositories/profile-candidates.repository";
import { decidirConfirmacionDePerfil } from "./confirmation-gate";
import { capaDelHecho, RITMO_DE_CAMBIO_DE_LA_CAPA } from "./layers";

/**
 * `SCR-MEM-03` (`36` §8) y `AC-PERF-02`: la unica pregunta que hace el modulo de
 * memoria, y el unico camino por el que un candidato de perfil se resuelve
 * hablando.
 *
 * Todo lo que decide **cuando** se pregunta ya vive en
 * `decidirConfirmacionDePerfil`; aqui no se duplica ni se ablanda ninguna de
 * sus tres reglas. Este modulo solo hace tres cosas que el gate no puede hacer
 * porque no conoce ni el canal ni la base: traduce un candidato en un bloque de
 * pregunta, lee la respuesta del usuario, y aplica el ritmo de la capa
 * (`20c` §2), que es el unico dato de politica que el gate declara como
 * responsabilidad de quien llama.
 */

export const PROFILE_COMMAND_PREFIX = "perfil";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `23` §5b.1: una pregunta sin responder caduca a los 15 minutos. Mismo numero
 * que `STRUCTURE_CONFIRMATION_TTL_MS` y que la propuesta de memoria, porque es
 * el mismo contrato de turno: un "si" dicho dos temas despues no confirma nada.
 */
export const PROFILE_CONFIRMATION_TTL_MS = 15 * 60 * 1000;

/**
 * `20c` §2: cada capa cambia a su ritmo, y ese ritmo es cada cuanto tiene
 * sentido volver a molestar con hechos de esa capa. No es caducidad del hecho
 * —eso es `validity`, `23` §5b.3—: es el descanso entre preguntas.
 *
 * `vinculo` cambia muy lento, asi que preguntar por la relacion de alguien con
 * el dinero dos veces en una semana es interrogatorio aunque el gate lo permita
 * (el gate cuenta conversaciones, no dias).
 */
const DESCANSO_POR_RITMO_MS: Record<
  (typeof RITMO_DE_CAMBIO_DE_LA_CAPA)[keyof typeof RITMO_DE_CAMBIO_DE_LA_CAPA],
  number
> = {
  cada_conversacion: 0,
  ocasional: 3 * 24 * 60 * 60 * 1000,
  lento: 14 * 24 * 60 * 60 * 1000,
  muy_lento: 30 * 24 * 60 * 60 * 1000,
};

export type ProfileConfirmationCandidateRow = ProfileCandidateRow;

export type ProfileQuestionDecision =
  | { preguntar: false }
  | { preguntar: true; candidato: ProfileCandidateRow; block: Block };

/**
 * `AC-PERF-02` cableado: decide si este turno pregunta por un candidato y, si
 * si, con que bloque.
 *
 * `conversationStateId` nulo es el primer turno de la conversacion: es
 * literalmente lo que el gate documenta como
 * `active_conversation_state.state_id === null`.
 */
export function decidirPreguntaDePerfil(input: {
  candidatos: ProfileCandidateRow[];
  conversationStateId: string | null;
  now: string;
}): ProfileQuestionDecision {
  const ahora = Date.parse(input.now);
  const decision = decidirConfirmacionDePerfil({
    esPrimerTurnoDeLaConversacion: input.conversationStateId === null,
    yaSePreguntoEnEstaConversacion:
      input.conversationStateId !== null &&
      input.candidatos.some(
        (candidato) =>
          leerMetadatoTexto(candidato, "asked_conversation_state_id") ===
          input.conversationStateId,
      ),
    candidatos: input.candidatos.map((candidato) => ({
      id: candidato.id,
      subjectKey: candidato.subject_key,
      askCount: candidato.ask_count,
      row: candidato,
    })),
    desbloqueaAlgoConcreto: (candidato) =>
      desbloqueaAlgoConcreto(candidato.row, ahora),
  });

  if (!decision.preguntar) return { preguntar: false };
  return {
    preguntar: true,
    candidato: decision.candidato.row,
    block: construirBloqueDePregunta(decision.candidato.row),
  };
}

/**
 * `20c` §3: se pregunta cuando el hecho desbloquea algo concreto. Dos cosas
 * tienen que cumplirse, y las dos las declaro quien observo el hecho:
 *
 *  1. El candidato dijo para que servia (`metadata.desbloquea`). Sin eso, es un
 *     hecho que nadie va a usar, y `20c` §9 los cuenta como coste de privacidad
 *     sin beneficio.
 *  2. Su capa admite que se vuelva a preguntar ahora. Un candidato que ya se
 *     pregunto una vez descansa lo que dure el ritmo de su capa.
 */
function desbloqueaAlgoConcreto(
  candidato: ProfileCandidateRow,
  ahora: number,
): boolean {
  if (!leerMetadatoTexto(candidato, "desbloquea")) return false;

  const capa = capaDelHecho(candidato.subject_key);
  if (!capa) return false;
  if (!candidato.last_asked_at) return true;

  const ultimaPregunta = Date.parse(candidato.last_asked_at);
  if (!Number.isFinite(ultimaPregunta) || !Number.isFinite(ahora)) return false;

  const descanso = DESCANSO_POR_RITMO_MS[RITMO_DE_CAMBIO_DE_LA_CAPA[capa]];
  return ahora - ultimaPregunta >= descanso;
}

/**
 * `SCR-MEM-03`: la tarjeta con sus tres salidas, y ni una mas. "No preguntar
 * esto" cuenta como el segundo ignorado y cierra el tema (`20c` §3), cosa que
 * ya hace `resolve_profile_candidate` al subir `ask_count` a 2.
 */
export function construirBloqueDePregunta(
  candidato: ProfileCandidateRow,
): Block {
  const options: BlockOption[] = [
    { id: buildProfileCommandText(candidato.id, "confirm"), label: "Sí, es así" },
    { id: buildProfileCommandText(candidato.id, "reject"), label: "No exactamente" },
    {
      id: buildProfileCommandText(candidato.id, "never_ask"),
      label: "No preguntar esto",
    },
  ];
  return {
    kind: "pregunta",
    text: `${candidato.statement} ¿Es así?`,
    options,
  };
}

export type ProfileAnswer = "confirm" | "reject" | "never_ask";

/** Texto de comando que devuelve el boton al pulsarse. */
export function buildProfileCommandText(
  candidateId: string,
  answer: ProfileAnswer,
): string {
  return `${PROFILE_COMMAND_PREFIX}:${candidateId}:${answer}`;
}

export function isProfileCommandText(value: string): boolean {
  return value.trim().toLowerCase().startsWith(`${PROFILE_COMMAND_PREFIX}:`);
}

export function parseProfileCommandText(
  value: string,
): { candidateId: string; answer: ProfileAnswer } | null {
  const [prefix, candidateId, answer, extra] = value.trim().split(":");
  if (prefix !== PROFILE_COMMAND_PREFIX || extra !== undefined) return null;
  if (!candidateId || !UUID_PATTERN.test(candidateId)) return null;
  if (answer !== "confirm" && answer !== "reject" && answer !== "never_ask") {
    return null;
  }
  return { candidateId, answer };
}

export type AwaitingProfileConfirmation =
  | { kind: "none" }
  | { kind: "answered"; candidato: ProfileCandidateRow; answer: ProfileAnswer };

/**
 * Lee el turno contra los candidatos reales y dice si esto responde a la
 * pregunta de perfil que se hizo antes.
 *
 * **No reutiliza `isStructureConfirmationText` ni `isMemoryConfirmationText`, y
 * la razon es la misma que llevo a separar esos dos.** Ante "¿cierro la caja?",
 * "olvidalo" significa "dejalo"; ante "¿olvido este recuerdo?" significa lo
 * contrario. Aqui la pregunta es "¿es asi?", asi que el vocabulario natural es
 * otra vez distinto: "exacto", "asi es", "no exactamente", "mas o menos", "no
 * me preguntes esto". Reusar la lista de otro dominio convertiria un "no
 * exactamente" —que `SCR-MEM-03` ofrece como boton— en una confirmacion o en
 * silencio, segun el matcher que se hubiera copiado.
 *
 * Sigue siendo una lista cerrada: cualquier otra cosa devuelve `none` y el
 * turno sigue su camino normal. La pregunta no vuelve a hacerse en esta
 * conversacion (`AC-PERF-02`) y el candidato sigue vivo para otro dia.
 */
export function resolveAwaitingProfileConfirmation(params: {
  text: string;
  candidatos: ProfileCandidateRow[];
  conversationStateId: string | null;
  now: string;
}): AwaitingProfileConfirmation {
  const comando = parseProfileCommandText(params.text);
  if (comando) {
    const candidato = params.candidatos.find(
      (fila) => fila.id === comando.candidateId,
    );
    // Un id que no es de este usuario, o ya resuelto, no esta en la lista:
    // no se ejecuta y el turno sigue.
    if (!candidato) return { kind: "none" };
    return { kind: "answered", candidato, answer: comando.answer };
  }

  const pendiente = candidatoPreguntadoEnEsteHilo(params);
  if (!pendiente) return { kind: "none" };

  if (esTextoDeNoPreguntarMas(params.text)) {
    return { kind: "answered", candidato: pendiente, answer: "never_ask" };
  }
  if (esTextoDeRechazoDePerfil(params.text)) {
    return { kind: "answered", candidato: pendiente, answer: "reject" };
  }
  if (esTextoDeConfirmacionDePerfil(params.text)) {
    return { kind: "answered", candidato: pendiente, answer: "confirm" };
  }
  return { kind: "none" };
}

function candidatoPreguntadoEnEsteHilo(params: {
  candidatos: ProfileCandidateRow[];
  conversationStateId: string | null;
  now: string;
}): ProfileCandidateRow | null {
  if (!params.conversationStateId) return null;
  const ahora = Date.parse(params.now);
  if (!Number.isFinite(ahora)) return null;

  const vigentes = params.candidatos.filter((candidato) => {
    if (candidato.status !== "pending_confirmation") return false;
    if (
      leerMetadatoTexto(candidato, "asked_conversation_state_id") !==
      params.conversationStateId
    ) {
      return false;
    }
    if (!candidato.last_asked_at) return false;
    const preguntado = Date.parse(candidato.last_asked_at);
    if (!Number.isFinite(preguntado)) return false;
    return ahora - preguntado < PROFILE_CONFIRMATION_TTL_MS;
  });

  if (vigentes.length === 0) return null;
  // El mas reciente: si por lo que sea hay dos, el que el usuario tiene delante
  // es el ultimo que se le pregunto.
  return vigentes.reduce((mejor, actual) =>
    Date.parse(actual.last_asked_at ?? "") >= Date.parse(mejor.last_asked_at ?? "")
      ? actual
      : mejor,
  );
}

export function esTextoDeConfirmacionDePerfil(value: string): boolean {
  if (esTextoDeRechazoDePerfil(value) || esTextoDeNoPreguntarMas(value)) {
    return false;
  }
  const text = normalizar(value);
  if (!text) return false;
  return (
    /^(si|sip|claro|dale|ok|okay|exacto|exactamente|correcto|cierto|obvio|tal cual)\b/.test(
      text,
    ) ||
    /^(asi es|es asi|eso es|es correcto|es cierto|confirmo|confirmado)\b/.test(
      text,
    )
  );
}

export function esTextoDeRechazoDePerfil(value: string): boolean {
  if (esTextoDeNoPreguntarMas(value)) return false;
  const text = normalizar(value);
  if (!text) return false;
  return (
    /^no\b/.test(text) ||
    /^(nop|nel|nunca|jamas|para nada|que va|negativo)\b/.test(text) ||
    /\b(no exactamente|no es asi|no del todo|mas o menos|ni ahi|te equivocas|equivocado|esta mal|ya no)\b/.test(
      text,
    )
  );
}

/** `20c` §3: cerrar el tema es una respuesta distinta de decir que no. */
export function esTextoDeNoPreguntarMas(value: string): boolean {
  const text = normalizar(value);
  if (!text) return false;
  return /\b(no preguntes|no me preguntes|no preguntar|deja de preguntar|dejame de preguntar|no vuelvas a preguntar|no me lo preguntes)\b/.test(
    text,
  );
}

function normalizar(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function leerMetadatoTexto(
  candidato: ProfileCandidateRow,
  key: string,
): string | null {
  const value = candidato.metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
