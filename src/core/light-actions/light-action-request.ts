import type { LightActionRequest } from "@/agents/conversational-executive-agent/types";
import { HOME_BLOCK_KINDS, type HomeBlockKind } from "@/core/home/home-composer";

/**
 * `RUL-LIG-01`: los comandos de nivel `ninguna` del catalogo (`40` §7) son los
 * unicos que se ejecutan **en el mismo turno en que se piden**, sin tarjeta de
 * confirmacion.
 *
 * El nivel no lo decide este modulo ni el modelo: ya esta decidido en
 * `src/core/catalog/generated.ts`, generado desde `40` §7. Aqui solo se cablea
 * el subconjunto que tiene sentido conversando, y `light-action.catalog.test.ts`
 * comprueba contra el catalogo que ninguno de estos nombres sea de otro nivel.
 *
 * Que no lleven tarjeta **no** significa que se hagan en silencio
 * (`40` §3.1): el ejecutor devuelve siempre un texto que dice que se hizo y
 * como se deshace, y ese texto es el que ve el usuario.
 *
 * Los que quedan fuera, y por que:
 *
 * - `posponer_siguiente` (`39`): su ejecutor real es el mismo `dismissReminder`
 *   que `descartar_recordatorio` —lo dice literalmente
 *   `POST /v1/home/next/[id]/postpone`—, y "el siguiente" es la tarjeta que el
 *   Inicio esta pintando ahora mismo, un concepto de pantalla que un turno de
 *   conversacion no tiene en la mano. Exponerlo seria un segundo nombre para un
 *   comando ya expuesto.
 * - `guardar_busqueda` (`38`) y `guardar_vista_reporte` (`35`): las dos guardan
 *   la **configuracion de una pantalla** (nombre + consulta + filtros; periodo +
 *   agrupacion + filtros). Una conversacion no tiene ese objeto: lo mas cercano
 *   es una `SemanticQuery`, que no reproduce lo que el usuario vio. Guardar algo
 *   que al reabrirse muestra otra cosa es peor que no guardarlo.
 * - `confirmar_hecho_perfil` (`36`): sigue fuera, pero **ya no por falta de
 *   lectura** — `get_profile_summary` expone los candidatos con su id desde
 *   `AC-PERF-02`. Queda fuera por lo que promueve: `WEB-D023` dice que un hecho
 *   de perfil no pasa a vigente sin que el usuario lo confirme, *nunca*, y esa
 *   es la unica clase de aprendizaje de la que el producto exige eso. Un
 *   `light_action` pone al modelo a decidir que el usuario confirmo; el camino
 *   que si existe —la pregunta de `SCR-MEM-03` con sus tres botones, y su
 *   respuesta leida por `resolveAwaitingProfileConfirmation` contra la pregunta
 *   exacta que se hizo y dentro de su ventana— es el usuario confirmando. Con
 *   dos caminos hacia la misma escritura, el debil manda; por eso hay uno.
 * - `no_preguntar_mas` y `reactivar_aprendizaje` (`36`): ya se ejecutan en
 *   `resolveMemoryControl` (`RUL-MEM-16`), por la puerta de privacidad.
 */
export const LIGHT_ACTION_INTENTS = [
  "none",
  /** `40` §7.14 — `posponer_recordatorio`. */
  "posponer_recordatorio",
  /** `40` §7.14 — `descartar_recordatorio`. */
  "descartar_recordatorio",
  /** `40` §7.11 — `descartar_descubrimiento`. */
  "descartar_descubrimiento",
  /** `40` §7.11 — `marcar_descubrimiento`. */
  "marcar_descubrimiento",
  /** `40` §7.16 — `ocultar_bloque_inicio`. */
  "ocultar_bloque_inicio",
  /** `40` §7.16 — `mostrar_bloque_inicio`. */
  "mostrar_bloque_inicio",
] as const;
export type LightActionIntent = (typeof LIGHT_ACTION_INTENTS)[number];

/** Nombres de catalogo que este modulo cablea, sin el `none`. */
export const LIGHT_ACTION_COMMAND_NAMES = LIGHT_ACTION_INTENTS.filter(
  (intent): intent is Exclude<LightActionIntent, "none"> => intent !== "none",
);

/** Orden ya tipada: el ejecutor no vuelve a leer texto ni a decidir nada. */
export type LightActionCommand =
  | { action: "posponer_recordatorio"; reminderId: string; days: number }
  | { action: "descartar_recordatorio"; reminderId: string }
  | { action: "descartar_descubrimiento"; insightId: string }
  | { action: "marcar_descubrimiento"; insightId: string; value: "util" | "no_util" }
  | { action: "ocultar_bloque_inicio"; block: HomeBlockKind }
  | { action: "mostrar_bloque_inicio"; block: HomeBlockKind };

/**
 * `RUL-LIG-02`: una accion sin tarjeta se ejecuta sin red, asi que el umbral de
 * duda es mas duro que el de una propuesta. Por debajo de esto el turno sigue
 * su camino normal y el usuario recibe la respuesta conversacional de siempre;
 * no se queda mudo (`WEB-D296`).
 */
const MIN_CONFIDENCE = 0.6;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HOME_BLOCKS = new Set<string>(HOME_BLOCK_KINDS);

/**
 * Convierte lo que dijo el ejecutivo en una orden tipada, o `null` cuando este
 * turno no pide ninguna accion ligera —o la pide sin los datos que la hacen
 * ejecutable.
 *
 * Devolver `null` nunca es un error: significa "esto no es una accion ligera",
 * y el turno continua por la via normal.
 */
export function compileLightActionRequest(
  request: LightActionRequest | null,
): LightActionCommand | null {
  if (!request) return null;
  if (request.intent === "none") return null;
  // Una duda declarada es una duda: preguntar de mas es barato, ejecutar de mas
  // no lo es, aunque sea reversible.
  if (request.ambiguities.length > 0) return null;
  if (request.confidence < MIN_CONFIDENCE) return null;

  const target = request.target_id.trim();
  if (!target) return null;

  switch (request.intent) {
    case "posponer_recordatorio":
      if (!UUID.test(target)) return null;
      return {
        action: "posponer_recordatorio",
        reminderId: target,
        // Sin dias declarados, "recuerdamelo despues" es mañana: es el plazo
        // mas corto que cumple la peticion y el que menos tarda en volver.
        days: request.postpone_days ?? 1,
      };
    case "descartar_recordatorio":
      if (!UUID.test(target)) return null;
      return { action: "descartar_recordatorio", reminderId: target };
    case "descartar_descubrimiento":
      if (!UUID.test(target)) return null;
      return { action: "descartar_descubrimiento", insightId: target };
    case "marcar_descubrimiento": {
      if (!UUID.test(target)) return null;
      const value = request.value.trim().toLowerCase();
      // `34`: el feedback tiene exactamente dos valores. Cualquier otra cosa no
      // se normaliza a uno de ellos a la fuerza — se descarta y se pregunta.
      if (value !== "util" && value !== "no_util") return null;
      return { action: "marcar_descubrimiento", insightId: target, value };
    }
    case "ocultar_bloque_inicio":
      if (!HOME_BLOCKS.has(target)) return null;
      return { action: "ocultar_bloque_inicio", block: target as HomeBlockKind };
    case "mostrar_bloque_inicio":
      if (!HOME_BLOCKS.has(target)) return null;
      return { action: "mostrar_bloque_inicio", block: target as HomeBlockKind };
  }
}
