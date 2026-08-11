import type { ProfileSignalRequest } from "@/agents/conversational-executive-agent/types";
import { capaDelHecho, type ProfileLayer } from "./layers";
import { puedeGenerarHechoDePerfilAutomatico } from "./sensitive-topics";

/**
 * `AC-PERF-14`, `20c` §6b.1: convierte lo que el ejecutivo entendio sobre la
 * **persona** en un candidato de perfil, o en `null` cuando este turno no
 * observo nada que merezca guardarse.
 *
 * Es el hermano de `compileStructureProposal`, `compileMemoryControlRequest` y
 * `compileLightActionRequest`: el modelo describe lo que oyo, el nucleo decide
 * si eso se guarda y con que forma. El modelo no elige capa por su cuenta —la
 * capa sale del prefijo del `subject_key` y la lee `capaDelHecho`, unica fuente
 * de esa convencion (`36` §7)—, no decide sensibilidad y no escribe nada.
 *
 * Devolver `null` nunca es un error: significa "este turno no observo un hecho
 * de perfil", y el turno continua exactamente igual.
 */

/**
 * Las dos capas que este camino puede alimentar, y por que no son las cuatro.
 *
 * - `estilo` ya tiene dueño: `captureExplicitConversationStyle`
 *   (`orchestration_plan.style_update`) escribe la preferencia de conversacion
 *   en `financial_memory_items` y la espeja en `user_preferences`. Abrir un
 *   segundo camino a `user_profile_facts` para lo mismo daria dos verdades
 *   sobre como hablarle a alguien, y ninguna ganaria por regla escrita.
 * - `hilo` tambien: es `conversation_memory_state` —working set, hint de
 *   continuidad, resumen del ultimo resultado—, que se reescribe cada turno.
 *   `20c` §2 dice que esa capa cambia "cada conversacion"; un hecho que hay
 *   que confirmar una sola vez no es la forma de guardar algo que cambia asi.
 *
 * Quedan `vida` y `vinculo`, que son exactamente las dos que hoy no guarda
 * nadie y las dos que `20c` §2.2/§2.3 describe como hechos sobre la persona.
 */
export const CAPAS_QUE_GENERAN_CANDIDATO = ["vida", "vinculo"] as const;
export type CapaConCandidato = (typeof CAPAS_QUE_GENERAN_CANDIDATO)[number];

/**
 * `RUL-LIG-02` aplica la misma idea a las acciones ligeras y por el mismo
 * motivo: lo que se hace sin pedir permiso se hace con mas certeza que lo que
 * se propone. Guardar un hecho sobre alguien entra en esa clase — no se le
 * enseña hasta que se le pregunta, pero se guarda sin avisar.
 */
const MIN_CONFIDENCE = 0.7;

export type ProfileCandidateDraft = {
  /** `ambito:valor` con la capa en el prefijo (`36` §7, `20c` §2). */
  subjectKey: string;
  capa: CapaConCandidato;
  /** La frase que vera el usuario, en sus terminos. */
  statement: string;
  /** `20c` §3: `dicho` lo conto la persona; `observado` lo dedujo el motor. */
  origin: "dicho" | "observado";
  /**
   * `20c` §3: "se pregunta cuando el hecho desbloquea algo concreto". Es lo que
   * despues alimenta `desbloqueaAlgoConcreto` en el gate de confirmacion, y por
   * eso viaja con el candidato en vez de recalcularse al preguntar: quien
   * observo el hecho es quien sabe para que servia.
   */
  desbloquea: string;
};

export type CompileProfileSignalContext = {
  /**
   * `categories[].is_sensitive` de la categoria que originó la observacion.
   * Lo resuelve quien llama contra el catalogo real (`DataContextPack`), nunca
   * el modelo: `sensitive-topics.ts` es explicito en que la sensibilidad de una
   * categoria ya es un dato del dominio y no se reimplementa por modulo.
   */
  categoriaOrigenEsSensible: boolean;
};

export function compileProfileSignal(
  request: ProfileSignalRequest | null,
  contexto: CompileProfileSignalContext,
): ProfileCandidateDraft | null {
  if (!request) return null;
  if (request.intent === "none") return null;
  // Una duda declarada es una duda. Guardar de mas un hecho sobre la persona
  // no se nota hasta que el asistente razona con el, que es tarde.
  if (request.ambiguities.length > 0) return null;
  if (request.confidence < MIN_CONFIDENCE) return null;

  const subjectKey = request.subject_key.trim().toLowerCase();
  const capa = capaDelHecho(subjectKey);
  if (!esCapaConCandidato(capa)) return null;

  const statement = request.statement.trim();
  if (!statement) return null;

  const desbloquea = request.unlocks.trim();
  if (!desbloquea) return null;

  // `AC-PERF-10`: una categoria sensible no genera candidato, en ninguna capa.
  if (
    !puedeGenerarHechoDePerfilAutomatico({
      categoriaOrigenEsSensible: contexto.categoriaOrigenEsSensible,
      capa,
    })
  ) {
    return null;
  }

  return {
    subjectKey,
    capa,
    statement,
    origin: request.origin === "dicho" ? "dicho" : "observado",
    desbloquea,
  };
}

function esCapaConCandidato(
  capa: ProfileLayer | null,
): capa is CapaConCandidato {
  return (
    capa !== null &&
    (CAPAS_QUE_GENERAN_CANDIDATO as readonly string[]).includes(capa)
  );
}
