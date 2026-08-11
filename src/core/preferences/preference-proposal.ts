import { z } from "zod";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import {
  compilePreferenceCommandPayload,
  PREFERENCE_COMMAND_NAMES,
} from "./preference-request";

/**
 * `RUL-PREF-03`: cambiar una preferencia **nunca** se ejecuta en el mismo turno
 * en que se pide.
 *
 * No es una politica inventada aqui: el catalogo (`40` §7.14) le asigna nivel
 * `tarjeta` a `silenciar_tipo_recordatorio`, `cambiar_horario_silencioso` y
 * `pausar_recordatorios`, y nivel `consentimiento` a
 * `activar_correo_recordatorios`. `40` §3 define `tarjeta` como "muestra lo que
 * va a pasar; el usuario acepta", y `consentimiento` como "autoriza algo
 * continuo o externo; **se registra como evento de consentimiento**".
 *
 * El camino es el mismo que ya usan una propuesta de estructura y una orden de
 * memoria, y es el mismo a proposito: el bloque `propuesta` lleva `options`
 * cuyo `id` es el texto de comando, cada canal los materializa como botones, y
 * un "si" escrito se resuelve contra el estado conversacional del hilo. El `id`
 * es un asa (`pref:<uuid>`) y el borrador vive en el working set, para que lo
 * que se ejecuta salga del estado del propio usuario y no de lo que devuelva el
 * canal.
 *
 * Lo unico que el nivel `consentimiento` cambia respecto de una `tarjeta` es lo
 * que la tarjeta tiene que decir (`40` §7.14: tipo, frecuencia maxima y como se
 * apaga) y que la escritura deja constancia. El ciclo es el mismo, y tener dos
 * ciclos distintos para lo mismo seria un quinto patron que nadie pidio.
 */

export const PREFERENCE_CANCEL_COMMAND_ID = "pref:cancel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PreferenceProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  /** Nombre de catalogo (`40` §7.14) del comando que se va a ejecutar. */
  command: z.enum(PREFERENCE_COMMAND_NAMES),
  /**
   * El nivel que el catalogo le da a ese comando. Se guarda en el borrador —en
   * vez de recalcularlo al ejecutar— para que la constancia de consentimiento
   * se decida con el mismo dato que se le mostro al usuario.
   */
  nivel: z.enum(["tarjeta", "consentimiento"]),
  /**
   * Orden ya compilada. Se revalida contra `PreferenceCommand` al ejecutar: el
   * estado conversacional es transporte, no autoridad de tipos.
   */
  payload: z.record(z.string(), z.unknown()),
  /**
   * Frase que se le mostro al usuario. Es lo que confirma, textualmente, e
   * incluye ya el detalle obligatorio que exige el catalogo. Mismo techo que la
   * propuesta de estructura y la de memoria por la misma razon: el nucleo
   * antepone texto fijo y con un limite corto el borrador se guardaba pero no
   * volvia a validar al leerlo.
   */
  summary: z.string().trim().min(1).max(560),
  confirm_label: z.string().trim().min(1).max(60),
  proposed_at: z.string(),
});
export type PreferenceProposal = z.infer<typeof PreferenceProposalSchema>;

export type ParsedPreferenceCommand =
  | { kind: "cancel"; command_id: typeof PREFERENCE_CANCEL_COMMAND_ID }
  | { kind: "confirm"; command_id: string; proposal_id: string };

/** Texto de comando que el boton devuelve al pulsarse. */
export function buildPreferenceCommandText(proposalId: string): string {
  return `pref:${proposalId}`;
}

export function isPreferenceCommandText(value: string): boolean {
  return value.trim().startsWith("pref:");
}

export function parsePreferenceCommandText(
  value: string,
): ParsedPreferenceCommand | null {
  const text = value.trim();
  if (text === PREFERENCE_CANCEL_COMMAND_ID) {
    return { kind: "cancel", command_id: PREFERENCE_CANCEL_COMMAND_ID };
  }

  const [prefix, proposalId, extra] = text.split(":");
  if (prefix !== "pref" || !proposalId || extra !== undefined) return null;
  if (!UUID_PATTERN.test(proposalId)) return null;

  return { kind: "confirm", command_id: text, proposal_id: proposalId };
}

export type AwaitingPreferenceResolution =
  /** No hay ningun cambio de preferencia esperando confirmacion. */
  | { kind: "none" }
  /** Confirmacion o descarte validos: mismo hilo, dentro de la vigencia. */
  | {
      kind: "confirmable";
      commandText: string;
      proposal: PreferenceProposal;
    }
  /** Llego la confirmacion pero la propuesta ya no vale. Se dice, no se ejecuta. */
  | {
      kind: "lapsed_confirmation";
      reason: "confirmation_window_expired" | "thread_unknown";
    }
  /** Hay una propuesta viva pero es de otra conversacion: este turno no la toca. */
  | { kind: "other_thread" }
  /** Turno que no confirma ni descarta: la propuesta caduca por cambio de tema. */
  | { kind: "lapsed_by_topic_change" };

/**
 * Lee el turno contra el estado del hilo y dice si hay un cambio de preferencia
 * que este turno pueda confirmar, descartar o caducar.
 *
 * Reproduce el contrato de `resolveAwaitingStructure` y de
 * `resolveAwaitingMemoryControl`: mismo hilo, dentro de la vigencia, y solo
 * cuando el turno es una confirmacion o un descarte. Cualquier otro mensaje la
 * caduca, para que un "si" dicho dos temas despues no apague unos avisos que el
 * usuario ya no tiene en mente.
 */
export function resolveAwaitingPreference(params: {
  text: string;
  workingSet: ConversationWorkingSet | null;
  threadKey: string;
  now: string;
}): AwaitingPreferenceResolution {
  const lastAction = params.workingSet?.last_action ?? null;
  const proposal = readStoredPreferenceProposal(params.workingSet);

  if (
    !lastAction ||
    lastAction.kind !== "preference_proposed" ||
    lastAction.status !== "awaiting_confirmation" ||
    !proposal
  ) {
    return { kind: "none" };
  }

  const storedThreadKey = lastAction.thread_key ?? null;
  // La direccion de la propuesta decide como se lee una reformulacion. Ver
  // `propuestaPideSilencio`.
  const silencio = propuestaPideSilencio(proposal);
  const answersTheProposal =
    isPreferenceConfirmationText(params.text, silencio) ||
    isPreferenceDiscardText(params.text, silencio);

  if (storedThreadKey && storedThreadKey !== params.threadKey) {
    return { kind: "other_thread" };
  }

  if (!answersTheProposal) return { kind: "lapsed_by_topic_change" };

  if (!storedThreadKey) {
    return { kind: "lapsed_confirmation", reason: "thread_unknown" };
  }

  if (
    isConfirmationWindowExpired(lastAction.confirmation_expires_at, params.now)
  ) {
    return {
      kind: "lapsed_confirmation",
      reason: "confirmation_window_expired",
    };
  }

  if (isPreferenceDiscardText(params.text, silencio)) {
    return {
      kind: "confirmable",
      commandText: PREFERENCE_CANCEL_COMMAND_ID,
      proposal,
    };
  }

  return {
    kind: "confirmable",
    commandText: buildPreferenceCommandText(proposal.proposal_id),
    proposal,
  };
}

/**
 * Lee el borrador guardado en el estado del hilo, validandolo. Un estado
 * escrito por una version anterior, o corrupto, devuelve `null` en vez de
 * romper el turno entero.
 */
export function readStoredPreferenceProposal(
  workingSet: ConversationWorkingSet | null,
): PreferenceProposal | null {
  const raw = workingSet?.preference_proposal ?? null;
  if (!raw) return null;
  const parsed = PreferenceProposalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Ni `isStructureConfirmationText` ni `isMemoryConfirmationText` sirven aqui, y
 * la razon es concreta y propia de este dominio.
 *
 * Las preguntas de este modulo son casi todas **negativas**: "¿Silencio los
 * avisos de presupuesto?", "¿Pauso tus recordatorios una semana?". Y la forma
 * natural de decir que si a una pregunta negativa empieza por "no": *"no me
 * avises"*, *"no me molestes"*, *"no quiero que me escribas"*. Cualquier
 * matcher generico de descarte empieza por `/^no\b/` —los dos existentes lo
 * hacen— y convertiria cada uno de esos "si" en una cancelacion silenciosa: el
 * usuario pediria dos veces que lo dejen en paz y el sistema le contestaria dos
 * veces que no cambio nada.
 *
 * Por eso el orden es: primero las **reformulaciones de la peticion**, que son
 * confirmaciones aunque empiecen por "no"; despues el descarte; y solo al final
 * la confirmacion generica. Sigue siendo una lista cerrada: cualquier otra cosa
 * caduca la propuesta en vez de ejecutarla.
 */
export function isPreferenceConfirmationText(
  value: string,
  /**
   * Si la propuesta viva pide **callar** algo (pausar, silenciar, poner un
   * horario de silencio, dejar de escribir al correo). Solo entonces una
   * reformulacion como "no me avises" es un si.
   *
   * Cuando la propuesta pide lo contrario —"¿Reanudo tus recordatorios?",
   * "¿Vuelvo a avisarte?", "¿Te escribo al correo?"— la misma frase significa
   * exactamente lo opuesto: el usuario esta repitiendo que quiere silencio, o
   * sea que **no**. Sin este parametro, decir "no me avises" ante "¿reanudo?"
   * reanudaba los avisos, que es el mismo fallo por el otro lado.
   *
   * Por defecto `false`: sin saber la direccion, la reformulacion no se lee
   * como un si.
   */
  propuestaPideSilencio = false,
): boolean {
  const text = normalizePreferenceAnswer(value);
  if (!text) return false;

  if (propuestaPideSilencio && esReformulacionDeLaPeticion(text)) return true;
  if (isPreferenceDiscardText(value, propuestaPideSilencio)) return false;

  return (
    /^(si|sip|claro|dale|ok|okay|listo|va|exacto|correcto|confirmo|confirma|confirmar|hazlo|hacelo|adelante|porfa|por favor)$/.test(
      text,
    ) ||
    /^(si|sip|claro|dale|ok|okay|listo|va|eso|exacto|correcto)\b.*\b(hazlo|hacelo|adelante|dale|pausalo|pausala|pausa|silencialo|silenciala|silencia|apagalo|apagala|apaga|activalo|activala|activa|cambialo|cambiala|cambia|ponlo|ponelo|quitalo)\b/.test(
      text,
    ) ||
    /^(pausalo|pausala|pausa|silencialo|silenciala|silencia|apagalo|apagala|apaga|activalo|activala|activa|cambialo|cambiala|ponlo|ponelo|quitalo|desactivalo|reanudalo|reanuda)\b/.test(
      text,
    )
  );
}

/**
 * Hermana de `isPreferenceConfirmationText` para el descarte. No se llama nunca
 * antes que `esReformulacionDeLaPeticion`: ese orden es lo que evita leer "no
 * me avises" como una cancelacion.
 */
export function isPreferenceDiscardText(
  value: string,
  propuestaPideSilencio = false,
): boolean {
  const text = normalizePreferenceAnswer(value);
  if (!text) return false;
  if (propuestaPideSilencio && esReformulacionDeLaPeticion(text)) return false;

  // Descartada ya la reformulacion, todo lo que empieza por "no" es un "no":
  // "no", "no gracias", "no por ahora", "no se". El lado seguro de este camino
  // es no cambiar nada.
  return (
    /^no\b/.test(text) ||
    /^(cancelar|cancela|cancelalo|descartar|descarta|descartalo|olvidalo|olvidala|dejalo|dejala)$/.test(
      text,
    ) ||
    /\b(mejor no|dejalo asi|dejalo como esta|dejala asi|asi esta bien|dejalos como estan)\b/.test(
      text,
    )
  );
}

/**
 * "No me avises", "no me molestes", "no me escribas de noche", "no quiero mas
 * correos": empiezan por "no" y significan **si**, porque repiten lo que el
 * usuario acaba de pedir en vez de responder a la pregunta. `40` §7.14 y
 * `37` §14.3 usan literalmente estas frases como ejemplos de las peticiones que
 * abren estos comandos, asi que volverlas a oir en la respuesta es lo
 * esperable, no lo raro.
 */
function esReformulacionDeLaPeticion(textoNormalizado: string): boolean {
  return (
    /\bno\s+(me\s+|nos\s+|vuelvas\s+a\s+|quiero\s+que\s+me\s+|lo\s+|los\s+)*(avis|molest|notifi|escrib|mand|recuerd|fastidi)/.test(
      textoNormalizado,
    ) ||
    /\bno\s+(quiero|queremos|deseo|necesito)\s+(mas\s+)?(avis|recordatori|correo|notificacion|mensaj)/.test(
      textoNormalizado,
    )
  );
}

/**
 * Si lo que la propuesta viva va a hacer es **callar** algo. No es una etiqueta
 * por comando: `activar_correo_recordatorios` con `activar: false` calla, y
 * `pausar_recordatorios` con `activar: false` hace justo lo contrario.
 *
 * Un borrador que no vuelve a validar cuenta como "no calla": es el lado
 * seguro, porque deja las reformulaciones fuera de la lectura de confirmacion.
 */
function propuestaPideSilencio(proposal: PreferenceProposal): boolean {
  const command = compilePreferenceCommandPayload(proposal.payload);
  if (!command) return false;
  switch (command.command) {
    case "cambiar_horario_silencioso":
      return true;
    case "pausar_recordatorios":
    case "silenciar_tipo_recordatorio":
      return command.activar;
    case "activar_correo_recordatorios":
      return !command.activar;
  }
}

function normalizePreferenceAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sin sello de vigencia, la propuesta se considera vencida: el lado seguro. */
function isConfirmationWindowExpired(
  confirmationExpiresAt: string | null | undefined,
  now: string,
): boolean {
  if (!confirmationExpiresAt) return true;
  const expiresAt = Date.parse(confirmationExpiresAt);
  const current = Date.parse(now);
  if (Number.isNaN(expiresAt) || Number.isNaN(current)) return true;
  return current >= expiresAt;
}
