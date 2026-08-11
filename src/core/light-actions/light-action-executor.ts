import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { HomeBlockKind } from "@/core/home/home-composer";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  commitInsightInteraction,
  InsightOperationError,
} from "@/data/repositories/insights.repository";
import {
  dismissReminder,
  ReminderRepositoryError,
  snoozeReminder,
} from "@/data/repositories/reminders.repository";
import { setHomeBlockHidden } from "@/data/repositories/home.repository";
import { logger } from "@/shared/telemetry/logger";
import type { LightActionCommand } from "./light-action-request";

type Client = SupabaseClient<Database>;

/**
 * Resultado de una accion ligera. Los tres desenlaces llevan texto: un turno de
 * este camino **nunca** puede quedar sin nada que decir (`WEB-D296`), porque el
 * usuario acaba de pedir un cambio y tiene que saber si ocurrio.
 */
export type LightActionResult =
  | { kind: "applied"; action: LightActionCommand["action"]; text: string }
  /** El objeto no existe, ya no esta vigente, o es de otra persona. */
  | { kind: "not_found"; action: LightActionCommand["action"]; text: string }
  | { kind: "failed"; action: LightActionCommand["action"]; text: string };

/**
 * Como se llama cada bloque del Inicio cuando se habla de el. No es
 * `BLOCK_TITLES` de la pantalla: ese es el titulo que se pinta ("Tienes
 * libres"), y aqui hace falta el nombre con el que uno lo menciona. El nucleo
 * no puede importar del canal (`INV-04`), asi que vive aqui.
 */
const NOMBRE_DE_BLOQUE: Record<HomeBlockKind, string> = {
  free_money: "el de dinero libre",
  next_action: "el de lo siguiente",
  pending: "el de pendientes",
  month: "el de este mes",
  upcoming: "el de lo que te viene",
  insight: "el de descubrimientos",
  movements: "el de últimos movimientos",
};

/**
 * `RUL-LIG-01`: ejecuta un comando de nivel `ninguna` en el mismo turno.
 *
 * Tres cosas que este ejecutor sostiene y que no son negociables:
 *
 * 1. **Aislamiento por usuario.** El `userId` sale del turno, nunca del texto
 *    ni de la orden del modelo, y viaja a cada repositorio. Un `target_id` de
 *    otra persona no encuentra fila y sale por `not_found`, no por error.
 * 2. **Reversibilidad dicha.** El nivel `ninguna` se gano por ser reversible en
 *    un clic; el texto lo dice siempre, porque sin tarjeta previa esa frase es
 *    la unica oportunidad que tiene el usuario de enterarse.
 * 3. **Mismo gate que la pantalla.** Cada accion pasa por
 *    `assertSystemActionAllowed` con el mismo `actionKind` que usa su ruta HTTP,
 *    para que conversar no sea una puerta con menos control que pulsar el boton.
 */
export async function executeLightAction(input: {
  client: Client;
  userId: string;
  command: LightActionCommand;
  traceId: string;
  now?: string;
}): Promise<LightActionResult> {
  const { client, userId, command, traceId } = input;
  const now = input.now ?? new Date().toISOString();

  try {
    switch (command.action) {
      case "posponer_recordatorio": {
        assertSystemActionAllowed({
          actionKind: "experience_feedback",
          authenticatedSession: true,
          reversible: true,
        });
        const until = addDays(now, command.days);
        await snoozeReminder(client, userId, command.reminderId, until);
        return {
          kind: "applied",
          action: command.action,
          text: `Listo, te lo recuerdo ${command.days === 1 ? "mañana" : `en ${command.days} días`}. No lo borré: sigue ahí y puedes verlo cuando quieras en tus recordatorios.`,
        };
      }

      case "descartar_recordatorio": {
        assertSystemActionAllowed({
          actionKind: "experience_feedback",
          authenticatedSession: true,
          reversible: true,
        });
        await dismissReminder(client, userId, command.reminderId);
        return {
          kind: "applied",
          action: command.action,
          text: "Listo, descarté ese recordatorio. No cambié ningún movimiento ni saldo, y si la causa sigue vigente volverá a aparecer solo.",
        };
      }

      case "descartar_descubrimiento": {
        assertSystemActionAllowed({
          actionKind: "experience_feedback",
          authenticatedSession: true,
          reversible: true,
        });
        const result = await commitInsightInteraction(client, userId, {
          insightId: command.insightId,
          operation: "dismiss",
          // La clave sale del objeto y del turno: repetir el mismo descarte en
          // el mismo turno no crea dos interacciones.
          idempotencyKey: `light-action:${traceId}:dismiss:${command.insightId}`,
          traceId,
        });
        if (!result) return notFound(command.action, "ese descubrimiento");
        return {
          kind: "applied",
          action: command.action,
          text: "Listo, descarté ese descubrimiento y no te lo vuelvo a mostrar. No toqué ningún dato tuyo, y si quieres seguir viendo los de ese tipo no hace falta que hagas nada más.",
        };
      }

      case "marcar_descubrimiento": {
        assertSystemActionAllowed({
          actionKind: "experience_feedback",
          authenticatedSession: true,
          reversible: true,
        });
        const result = await commitInsightInteraction(client, userId, {
          insightId: command.insightId,
          operation: "feedback",
          value: command.value,
          idempotencyKey: `light-action:${traceId}:feedback:${command.insightId}`,
          traceId,
        });
        if (!result) return notFound(command.action, "ese descubrimiento");
        return {
          kind: "applied",
          action: command.action,
          text:
            command.value === "util"
              ? "Anotado: ese descubrimiento te sirvió. Lo tendré en cuenta para los próximos. Puedes decirme lo contrario cuando quieras."
              : "Anotado: ese descubrimiento no te sirvió. Lo tendré en cuenta para los próximos. Puedes decirme lo contrario cuando quieras.",
        };
      }

      case "ocultar_bloque_inicio":
      case "mostrar_bloque_inicio": {
        // Misma puerta que `PATCH /v1/home/preferences`: es un cambio de
        // preferencia declarado, no una observacion, y el usuario acaba de
        // pedirlo con todas las letras (`RUL-HOME-06`, `WEB-D064`).
        assertSystemActionAllowed({
          actionKind: "preference_change",
          authenticatedSession: true,
          explicitUserConfirmation: true,
          reversible: true,
        });
        const hide = command.action === "ocultar_bloque_inicio";
        await setHomeBlockHidden(client, userId, command.block, hide);
        const nombre = NOMBRE_DE_BLOQUE[command.block];
        return {
          kind: "applied",
          action: command.action,
          text: hide
            ? `Listo, oculté ${nombre} en tu Inicio. No borré nada: dime “muestra ${nombre}” y vuelve.`
            : `Listo, ${nombre} vuelve a aparecer en tu Inicio. Si prefieres quitarlo otra vez, dímelo.`,
        };
      }
    }
  } catch (error) {
    if (error instanceof ReminderRepositoryError) {
      if (error.code === "NOT_FOUND") {
        return notFound(command.action, "ese recordatorio");
      }
      if (error.code === "CONFLICT") {
        return {
          kind: "not_found",
          action: command.action,
          text: "Ese recordatorio ya estaba resuelto, así que no cambié nada.",
        };
      }
      // `INVALID_OPERATION` trae el motivo real desde la base (un aplazamiento
      // fuera de rango, por ejemplo). Decirlo tal cual es mas util que una
      // frase generica.
      return {
        kind: "failed",
        action: command.action,
        text: `${error.message} No cambié nada.`,
      };
    }

    if (error instanceof InsightOperationError) {
      // Una clave repetida con otros datos: la accion anterior ya quedo
      // registrada, asi que no se reintenta ni se afirma una segunda.
      return {
        kind: "failed",
        action: command.action,
        text: "Ya había registrado algo distinto para ese descubrimiento, así que no lo pisé. Vuelve a decírmelo si quieres cambiarlo.",
      };
    }

    logger.warn("light_action.failed", {
      trace_id: traceId,
      user_id: userId,
      action: command.action,
      error,
    });
    return {
      kind: "failed",
      action: command.action,
      text: "No pude hacer eso ahora mismo, así que no cambié nada. Vuelve a pedírmelo en un momento.",
    };
  }
}

function notFound(
  action: LightActionCommand["action"],
  que: string,
): LightActionResult {
  return {
    kind: "not_found",
    action,
    text: `No encontré ${que}, así que no cambié nada.`,
  };
}

/** Instante ISO desplazado N dias. El nucleo calcula el plazo, no el modelo. */
function addDays(nowIso: string, days: number): string {
  const instant = new Date(nowIso);
  const base = Number.isFinite(instant.getTime()) ? instant : new Date();
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
