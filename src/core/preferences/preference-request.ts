import { z } from "zod";
import type { PreferenceChangeRequest } from "@/agents/conversational-executive-agent/types";
import {
  NOT_REQUESTED,
  type ActionRequestOutcome,
} from "@/core/actions/action-request-outcome";
import { esComandoDeNivel } from "@/core/catalog";
import { REMINDER_KINDS, type ReminderKind } from "@/shared/types/domain";

/**
 * `RUL-PREF-01`: los cuatro comandos de preferencia del catalogo (`40` §7.14)
 * que tienen sentido pedir **hablando**, en vez de ir a buscar el interruptor.
 *
 * El nivel de confirmacion no lo decide este modulo ni el modelo: ya esta
 * decidido en `src/core/catalog/generated.ts`, generado desde `40` §7. Tres son
 * `tarjeta` y uno es `consentimiento`, que es su propio nivel y se trata como
 * tal (ver `preference-proposal.ts`). `preference-request.catalog.test.ts`
 * comprueba contra el catalogo que ninguno de estos nombres sea de otro nivel.
 *
 * ## Una direccion y su inversa, bajo el mismo nombre de catalogo
 *
 * `40` §3 dice que todo comando `tarjeta` "se deshace con accion inversa", y que
 * un `consentimiento` es "revocable en cualquier momento". Ninguna de esas
 * inversas tiene nombre propio en §7: no existe `reanudar_recordatorios` ni
 * `desactivar_correo_recordatorios`. Por eso el intent es siempre el nombre de
 * catalogo y la direccion viaja en `activar`: reanudar es
 * `pausar_recordatorios` con `activar: false`, y revocar el correo es
 * `activar_correo_recordatorios` con `activar: false`.
 *
 * Se hace asi y no inventando dos nombres nuevos porque `AC-CATALOGO-10` manda:
 * lo que se ejecuta tiene que existir en el catalogo. Y se hace —en vez de
 * dejar la inversa fuera— porque una pausa que se pide hablando y solo se quita
 * desde la pantalla es una trampa, y una trampa es peor que una funcion que
 * falta.
 *
 * ## Lo que queda fuera, y por que
 *
 * - **Modo discreto, resumen semanal y tema claro/oscuro**
 *   (`PUT /v1/preferences/experience`). No estan fuera por dificultad: **no
 *   existen como comando en `40` §7**, en ninguna de sus dieciseis secciones.
 *   `AC-CATALOGO-10` dice que la lista blanca vive en el catalogo y no en el
 *   prompt, asi que exponerlos exigiria primero una entrada en `40` §7 con su
 *   nivel decidido — no un comando inventado aqui. Del tema, ademas, no hay
 *   uso conversacional evidente: el tema es de la pantalla, y en una
 *   conversacion de texto no hay nada que cambiar de color.
 * - **`POST /v1/preferences/nudges`** (los avisos `payment_due` y `debt_due` de
 *   la bandeja). Escribe las **mismas filas** de `nudge_preferences` que
 *   `silenciar_tipo_recordatorio` para el canal `dashboard`. Exponer las dos
 *   seria dar dos nombres a una sola escritura, y ante dos caminos hacia la
 *   misma fila manda el mas debil. Se expone el que tiene nombre de catalogo.
 * - **El consentimiento del canal de mensajeria** (la ruta hermana de
 *   `/v1/preferences/nudges`). Queda fuera por dos razones independientes, y
 *   cualquiera de las dos basta. La primera: **no tiene comando en `40` §7** —
 *   el unico `consentimiento` de todo el catalogo es
 *   `activar_correo_recordatorios`. La segunda: su RPC sella el evento de
 *   consentimiento con `source: 'dashboard_settings'`, asi que concederlo desde
 *   una conversacion registraria un consentimiento diciendo que se dio en un
 *   sitio donde la persona no estuvo, que es exactamente lo que un evento de
 *   consentimiento existe para no hacer. (`INV-04` ademas prohibe que el nucleo
 *   nombre un canal concreto, y esta exclusion es la razon por la que no hace
 *   falta.)
 * - **`silenciar_tipo_descubrimiento`** (`34`, `tarjeta`). Es de descubrimientos,
 *   no de preferencias de recordatorio, y hoy no hay repositorio que silencie un
 *   **tipo** de descubrimiento: `commitInsightInteraction` opera sobre un
 *   descubrimiento concreto. Cablearlo pediria escritura nueva de datos, no una
 *   puerta conversacional.
 */
export const PREFERENCE_INTENTS = [
  "none",
  /** `40` §7.14 — `pausar_recordatorios` (`tarjeta`). */
  "pausar_recordatorios",
  /** `40` §7.14 — `silenciar_tipo_recordatorio` (`tarjeta`). */
  "silenciar_tipo_recordatorio",
  /** `40` §7.14 — `cambiar_horario_silencioso` (`tarjeta`). */
  "cambiar_horario_silencioso",
  /** `40` §7.14 — `activar_correo_recordatorios` (`consentimiento`). */
  "activar_correo_recordatorios",
] as const;
export type PreferenceIntent = (typeof PREFERENCE_INTENTS)[number];

/** Nombres de catalogo que este modulo cablea, sin el `none`. */
export const PREFERENCE_COMMAND_NAMES = PREFERENCE_INTENTS.filter(
  (intent): intent is Exclude<PreferenceIntent, "none"> => intent !== "none",
);

const HORA_HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const ReminderKindSchema = z.enum(REMINDER_KINDS);

/**
 * Orden ya tipada y validada. El ejecutor no vuelve a leer texto, no elige
 * plazos y no decide direcciones.
 *
 * Es un schema y no solo un tipo porque el borrador viaja por el working set
 * (JSONB) y vuelve: al ejecutarlo hay que **revalidarlo**, igual que hace
 * `StructureCommandSchema` con el payload de una estructura. El estado
 * conversacional es transporte, no autoridad de tipos.
 */
export const PreferenceCommandSchema = z.union([
  z.object({
    command: z.literal("pausar_recordatorios"),
    /** `true` pausa; `false` es la accion inversa, reanudar. */
    activar: z.literal(true),
    /** Dias de pausa. El nucleo los convierte a instante, no el modelo. */
    dias: z.number().int().min(1).max(90),
  }),
  z.object({
    command: z.literal("pausar_recordatorios"),
    activar: z.literal(false),
  }),
  z.object({
    command: z.literal("silenciar_tipo_recordatorio"),
    /** `true` silencia el tipo; `false` lo vuelve a encender. */
    activar: z.boolean(),
    tipo: ReminderKindSchema,
  }),
  z.object({
    command: z.literal("cambiar_horario_silencioso"),
    /** `HH:MM` en 24h. */
    desde: z.string().regex(HORA_HH_MM),
    hasta: z.string().regex(HORA_HH_MM),
  }),
  z.object({
    command: z.literal("activar_correo_recordatorios"),
    /** `true` concede el consentimiento; `false` lo revoca. */
    activar: z.boolean(),
    tipo: ReminderKindSchema,
  }),
]);
export type PreferenceCommand = z.infer<typeof PreferenceCommandSchema>;

/**
 * Relee la orden guardada en el borrador. Devuelve `null` si no valida: un
 * estado conversacional corrupto —o escrito por una version anterior— no puede
 * convertirse en una escritura.
 */
export function compilePreferenceCommandPayload(
  payload: unknown,
): PreferenceCommand | null {
  const parsed = PreferenceCommandSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/**
 * `RUL-PREF-02`: una preferencia cambia el comportamiento futuro del sistema,
 * asi que el umbral de duda es el de una propuesta (`0.6`), no el de una
 * lectura. Por debajo de esto el turno sigue su camino normal y el usuario
 * recibe la respuesta conversacional de siempre; no se queda mudo
 * (`WEB-D296`).
 */
const MIN_CONFIDENCE = 0.6;

/**
 * `40` §3: un `consentimiento` "autoriza algo continuo o externo" y se registra
 * como evento. Un evento de consentimiento registrado por una lectura dudosa es
 * peor que no tenerlo, asi que este nivel pide mas certeza que una `tarjeta`.
 */
const MIN_CONFIDENCE_CONSENTIMIENTO = 0.75;

/** Sin plazo dicho, una pausa dura una semana — y la tarjeta lo dice. */
export const DIAS_DE_PAUSA_POR_DEFECTO = 7;

/** `pause_reminders` exige un instante futuro; mas de un trimestre no es "pausar". */
const MAX_DIAS_DE_PAUSA = 90;

const TIPOS_DE_RECORDATORIO = new Set<string>(REMINDER_KINDS);

/**
 * Convierte lo que dijo el ejecutivo en una orden tipada.
 *
 * `WEB-D298`: antes devolvia `null` tanto cuando el turno no hablaba de
 * preferencias como cuando si lo hacia y los datos no validaban —un plazo fuera
 * de rango, un tipo de aviso inexistente, un horario imposible—. Los dos casos
 * terminaban igual: el turno contestaba amable y la persona se quedaba creyendo
 * que le habian pausado los avisos.
 *
 * La confianza baja sigue siendo `not_requested` a proposito (`RUL-PREF-02`):
 * no es un fallo, es que no esta claro que la persona pidiera nada.
 */
export function compilePreferenceRequest(
  request: PreferenceChangeRequest | null,
): ActionRequestOutcome<PreferenceCommand> {
  if (!request) return NOT_REQUESTED;
  if (request.intent === "none") return NOT_REQUESTED;
  // Una duda declarada es una duda. Preguntar de mas es barato; apagar los
  // avisos de vencimiento de alguien que no lo pidio, no.
  if (request.ambiguities.length > 0) {
    return { kind: "needs_clarification", question: request.ambiguities[0]! };
  }

  const esConsentimiento = esComandoDeNivel(request.intent, "consentimiento");
  const minimo = esConsentimiento
    ? MIN_CONFIDENCE_CONSENTIMIENTO
    : MIN_CONFIDENCE;
  if (request.confidence < minimo) return NOT_REQUESTED;

  switch (request.intent) {
    case "pausar_recordatorios": {
      if (!request.activar) {
        return {
          kind: "ready",
          command: { command: "pausar_recordatorios", activar: false },
        };
      }
      const pedidos = request.pausar_dias ?? DIAS_DE_PAUSA_POR_DEFECTO;
      // Un plazo fuera de rango no se recorta a la fuerza: se pregunta.
      // Recortar "pausalos un año" a 90 dias seria contestar otra cosa sin
      // decirlo, y dejarlo caer en silencio seria no contestar nada.
      if (!Number.isInteger(pedidos) || pedidos < 1 || pedidos > MAX_DIAS_DE_PAUSA) {
        return {
          kind: "needs_clarification",
          question: `¿Cuántos días quieres pausarlos? Puedo hasta ${MAX_DIAS_DE_PAUSA}.`,
        };
      }
      return {
        kind: "ready",
        command: { command: "pausar_recordatorios", activar: true, dias: pedidos },
      };
    }

    case "silenciar_tipo_recordatorio": {
      const tipo = normalizarTipo(request.reminder_kind);
      if (!tipo) return tipoNoValido();
      return {
        kind: "ready",
        command: {
          command: "silenciar_tipo_recordatorio",
          activar: request.activar,
          tipo,
        },
      };
    }

    case "cambiar_horario_silencioso": {
      const desde = request.desde_hora?.trim() ?? "";
      const hasta = request.hasta_hora?.trim() ?? "";
      if (!HORA_HH_MM.test(desde) || !HORA_HH_MM.test(hasta)) {
        return {
          kind: "needs_clarification",
          question: "¿Entre qué horas quieres el silencio? Dímelas como 22:00 y 08:00.",
        };
      }
      // Un horario silencioso puede cruzar la medianoche (22:00 → 08:00), asi
      // que `desde > hasta` es legitimo. Lo que no significa nada es que sean
      // iguales: eso no es una franja, es un instante.
      if (desde === hasta) {
        return {
          kind: "needs_clarification",
          question: "Esa franja empieza y acaba a la misma hora. ¿Entre qué horas la quieres?",
        };
      }
      return {
        kind: "ready",
        command: { command: "cambiar_horario_silencioso", desde, hasta },
      };
    }

    case "activar_correo_recordatorios": {
      const tipo = normalizarTipo(request.reminder_kind);
      if (!tipo) return tipoNoValido();
      return {
        kind: "ready",
        command: {
          command: "activar_correo_recordatorios",
          activar: request.activar,
          tipo,
        },
      };
    }
  }
}

/**
 * El nucleo rechaza un tipo de aviso que no existe en vez de aproximarlo al mas
 * parecido. Preguntar es mejor que declarar un limite: el vocabulario cerrado
 * de `37` es cosa nuestra, no un fallo de la persona.
 */
function tipoNoValido(): Extract<
  ActionRequestOutcome<never>,
  { kind: "needs_clarification" }
> {
  return {
    kind: "needs_clarification",
    question: "¿De qué tipo de aviso hablamos? Por ejemplo: los pagos que vienen, los pagos vencidos o los presupuestos cerca del límite.",
  };
}

/**
 * El tipo sale del vocabulario cerrado de `37` (`RUL-NOTIF-01`), no del texto.
 * Un nombre que no este en `REMINDER_KINDS` no se aproxima al mas parecido:
 * silenciar el tipo equivocado apagaria avisos que el usuario si quiere.
 */
function normalizarTipo(valor: string): ReminderKind | null {
  const tipo = valor.trim().toLowerCase();
  return TIPOS_DE_RECORDATORIO.has(tipo) ? (tipo as ReminderKind) : null;
}
