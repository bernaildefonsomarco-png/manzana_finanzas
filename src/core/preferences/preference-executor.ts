import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { esComandoDeNivel } from "@/core/catalog";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import type { Database } from "@/data/supabase/types";
import {
  pauseRemindersForUser,
  ReminderRepositoryError,
  resumeRemindersForUser,
  setQuietHoursForUser,
  setReminderPreferenceForUser,
} from "@/data/repositories/reminders.repository";
import { logger } from "@/shared/telemetry/logger";
import {
  PreferenceProposalSchema,
  type PreferenceProposal,
} from "./preference-proposal";
import {
  compilePreferenceCommandPayload,
  type PreferenceCommand,
} from "./preference-request";

type Client = SupabaseClient<Database>;

/**
 * `40` §7.14: el detalle obligatorio de la tarjeta de
 * `activar_correo_recordatorios` es **tipo, frecuencia maxima y como se apaga**.
 * Lo pone el nucleo con texto fijo, nunca el modelo: un consentimiento que no
 * dice a que se esta autorizando no es un consentimiento.
 *
 * La frecuencia que se declara es la que el sistema **de verdad** aplica: la
 * evaluacion de vencimientos es diaria y el envio es idempotente por
 * `(user_id, subject_key, dia)` (`37` §17), asi que como mucho llega un correo
 * al dia por cada asunto. No se promete un numero que nadie hace cumplir.
 */
const DETALLE_DE_CONSENTIMIENTO =
  "Como mucho te llega un correo al día por ese aviso, nunca dos por lo mismo, y no lleva montos ni categorías. Puedes apagarlo cuando quieras diciéndome “deja de escribirme por correo”.";

/** Nombre con el que se habla de cada tipo de recordatorio. */
const NOMBRE_DE_TIPO: Record<string, string> = {
  pago_proximo: "los pagos que vienen",
  pago_vencido: "los pagos vencidos",
  cuota_proxima: "las cuotas que vienen",
  cuota_vencida: "las cuotas vencidas",
  presupuesto_umbral: "los presupuestos cerca del límite",
  pendientes_acumulados: "los pendientes acumulados",
  sin_registrar: "los días sin registrar nada",
  correo_desconectado: "el correo desconectado",
  descarga_lista: "las descargas listas",
  confirmar_hecho: "las confirmaciones de lo que sé de ti",
};

function nombreDeTipo(tipo: string): string {
  return NOMBRE_DE_TIPO[tipo] ?? "ese tipo de aviso";
}

/**
 * Arma el borrador confirmable a partir de la orden ya compilada. Devuelve
 * `null` si el borrador no valida: un borrador que no se puede releer no puede
 * prometerse con un boton.
 */
export function buildPreferenceProposal(input: {
  command: PreferenceCommand;
  now: string;
}): PreferenceProposal | null {
  const nivel = esComandoDeNivel(input.command.command, "consentimiento")
    ? "consentimiento"
    : "tarjeta";

  const { summary, confirmLabel } = composePreferenceCard(
    input.command,
    input.now,
  );

  const parsed = PreferenceProposalSchema.safeParse({
    proposal_id: randomUUID(),
    command: input.command.command,
    nivel,
    payload: input.command as unknown as Record<string, unknown>,
    summary,
    confirm_label: confirmLabel,
    proposed_at: input.now,
  });

  return parsed.success ? parsed.data : null;
}

/**
 * Lo que el usuario ve antes de aceptar. Cada texto lleva el detalle que el
 * catalogo exige para ese comando (`40` §7.14): el horario resultante, la fecha
 * de reanudacion, y los tres datos del consentimiento.
 */
function composePreferenceCard(
  command: PreferenceCommand,
  now: string,
): { summary: string; confirmLabel: string } {
  switch (command.command) {
    case "pausar_recordatorios": {
      if (!command.activar) {
        return {
          summary:
            "¿Reanudo tus recordatorios? Vuelves a recibir los avisos que tenías activados, desde ahora mismo.",
          confirmLabel: "Sí, reanúdalos",
        };
      }
      // `40` §7.14: el detalle obligatorio es la **fecha de reanudacion**. Sin
      // ella el usuario aceptaria un silencio de duracion desconocida.
      const hasta = fechaLegible(sumarDias(now, command.dias));
      return {
        summary: `¿Pauso todos tus recordatorios hasta el ${hasta}? No pierdes ninguno: se reanudan solos ese día y puedes reanudarlos antes cuando quieras.`,
        confirmLabel: "Sí, pausa los avisos",
      };
    }

    case "silenciar_tipo_recordatorio": {
      const nombre = nombreDeTipo(command.tipo);
      return command.activar
        ? {
            summary: `¿Dejo de avisarte sobre ${nombre}? Los demás avisos siguen igual, y no cambia ningún movimiento ni saldo. Puedes volver a activarlo cuando quieras.`,
            confirmLabel: "Sí, deja de avisarme",
          }
        : {
            summary: `¿Vuelvo a avisarte sobre ${nombre}? Los demás avisos siguen como están.`,
            confirmLabel: "Sí, vuelve a avisarme",
          };
    }

    case "cambiar_horario_silencioso":
      // `40` §7.14: el detalle obligatorio es **el horario resultante**, y va
      // en las dos puntas para que no haya que deducirlo.
      return {
        summary: `¿Dejo de escribirte entre las ${command.desde} y las ${command.hasta}? En esa franja no te llega nada: lo que caiga dentro se guarda y te lo entrego después.`,
        confirmLabel: "Sí, cambia el horario",
      };

    case "activar_correo_recordatorios": {
      const nombre = nombreDeTipo(command.tipo);
      return command.activar
        ? {
            summary: `¿Te escribo al correo sobre ${nombre}? ${DETALLE_DE_CONSENTIMIENTO}`,
            confirmLabel: "Sí, escríbeme al correo",
          }
        : {
            summary: `¿Dejo de escribirte al correo sobre ${nombre}? Los avisos siguen apareciendo en la app; solo dejan de llegarte por correo.`,
            confirmLabel: "Sí, deja de escribirme",
          };
    }
  }
}

export type PreferenceExecution =
  | {
      kind: "applied";
      command: PreferenceCommand["command"];
      response_text: string;
    }
  | {
      kind: "cancelled";
      command: PreferenceCommand["command"];
      response_text: string;
    }
  | { kind: "failed"; error_code: string; response_text: string };

/**
 * Aplica el cambio de preferencia que el usuario acaba de confirmar.
 *
 * Tres cosas que este ejecutor sostiene:
 *
 * 1. **Aislamiento por usuario.** El `userId` sale del turno, nunca del texto
 *    ni del borrador. El borrador vive en el estado conversacional del propio
 *    usuario, que se lee por `user_id`, asi que un `pref:<uuid>` inventado no
 *    encuentra nada y no toca nada.
 * 2. **Mismo gate que la pantalla.** Cada escritura pasa por
 *    `assertSystemActionAllowed` con el mismo `actionKind` que usa su ruta HTTP
 *    (`preference_change`), para que conversar no sea una puerta con menos
 *    control que pulsar el interruptor.
 * 3. **La constancia del consentimiento no se salta.** Activar el correo de un
 *    tipo escribe el evento (`AC-NOTIF-03`) dentro de la propia RPC, asi que la
 *    via conversacional deja exactamente la misma huella que la pantalla.
 */
export async function executePreferenceProposal(input: {
  client: Client;
  userId: string;
  proposal: PreferenceProposal;
  traceId: string;
  now?: string;
}): Promise<PreferenceExecution> {
  const command = compilePreferenceCommandPayload(input.proposal.payload);
  if (!command) {
    // Un borrador que no vuelve a validar no se ejecuta a medias ni se
    // "interpreta": se dice y no se toca nada.
    return {
      kind: "failed",
      error_code: "PREFERENCE_PROPOSAL_INVALID",
      response_text:
        "No pude releer ese cambio, así que no toqué ninguna de tus preferencias. Vuelve a pedírmelo y te lo propongo otra vez.",
    };
  }

  const now = input.now ?? new Date().toISOString();

  try {
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      // El usuario acaba de aceptar la tarjeta: esa es la confirmacion
      // explicita, y sin ella este camino no llega aqui.
      explicitUserConfirmation: true,
      applicableOptIn: input.proposal.nivel === "consentimiento",
      reversible: true,
    });

    switch (command.command) {
      case "pausar_recordatorios": {
        if (!command.activar) {
          await resumeRemindersForUser(input.client, input.userId);
          return {
            kind: "applied",
            command: command.command,
            response_text:
              "Listo, reanudé tus recordatorios. Vuelves a recibir los avisos que tenías activados. Dime “pausa los avisos” si quieres volver a callarlos.",
          };
        }
        const hasta = sumarDias(now, command.dias);
        await pauseRemindersForUser(input.client, input.userId, hasta);
        return {
          kind: "applied",
          command: command.command,
          response_text: `Listo, pausé todos tus recordatorios hasta el ${fechaLegible(hasta)}. No perdiste ninguno y no cambié ningún movimiento ni saldo. Dime “reanuda los avisos” si quieres recuperarlos antes.`,
        };
      }

      case "silenciar_tipo_recordatorio": {
        await setReminderPreferenceForUser(input.client, input.userId, {
          nudgeType: command.tipo,
          channel: "dashboard",
          enabled: !command.activar,
        });
        const nombre = nombreDeTipo(command.tipo);
        return {
          kind: "applied",
          command: command.command,
          response_text: command.activar
            ? `Listo, dejo de avisarte sobre ${nombre}. Los demás avisos siguen igual y no toqué ningún dato tuyo. Dime “vuelve a avisarme” cuando lo quieras de vuelta.`
            : `Listo, vuelvo a avisarte sobre ${nombre}. Los demás avisos siguen como estaban.`,
        };
      }

      case "cambiar_horario_silencioso": {
        await setQuietHoursForUser(input.client, input.userId, {
          desde: command.desde,
          hasta: command.hasta,
        });
        return {
          kind: "applied",
          command: command.command,
          response_text: `Listo, no te escribo entre las ${command.desde} y las ${command.hasta}. Lo que caiga en esa franja se guarda y te lo entrego después. Dime otro horario cuando quieras cambiarlo.`,
        };
      }

      case "activar_correo_recordatorios": {
        await setReminderPreferenceForUser(input.client, input.userId, {
          nudgeType: command.tipo,
          channel: "email",
          enabled: command.activar,
        });
        const nombre = nombreDeTipo(command.tipo);
        return {
          kind: "applied",
          command: command.command,
          response_text: command.activar
            ? `Listo, te escribo al correo sobre ${nombre}, y queda registrado que lo autorizaste hoy. ${DETALLE_DE_CONSENTIMIENTO}`
            : `Listo, dejo de escribirte al correo sobre ${nombre}. Los avisos siguen apareciendo en la app.`,
        };
      }
    }
  } catch (error) {
    if (error instanceof ReminderRepositoryError) {
      return {
        kind: "failed",
        error_code: error.code,
        response_text: `${error.message} No cambié ninguna de tus preferencias.`,
      };
    }
    logger.warn("preference.execution_failed", {
      trace_id: input.traceId,
      user_id: input.userId,
      command: command.command,
      error,
    });
    return {
      kind: "failed",
      error_code: "PREFERENCE_EXECUTION_FAILED",
      response_text:
        "No pude guardar ese cambio ahora mismo. No toqué nada: tus avisos siguen exactamente como estaban. Vuelve a pedírmelo en un momento.",
    };
  }
}

/** Texto de la cancelacion: tiene que negar lo que se iba a hacer. */
export function composePreferenceCancelledText(
  proposal: PreferenceProposal | null,
): string {
  if (proposal?.command === "activar_correo_recordatorios") {
    return "Listo, no cambié nada. Tu correo sigue como estaba y no autorizaste nada.";
  }
  if (proposal?.command === "pausar_recordatorios") {
    return "Listo, no pausé nada. Tus recordatorios siguen como estaban.";
  }
  return "Listo, no cambié nada. Tus avisos siguen exactamente como estaban.";
}

/** `AC-RT-13` aplicado a preferencias: una confirmacion tardia se responde, no se ejecuta. */
export function composePreferenceLapsedText(): string {
  return "Esa confirmación llegó tarde y no la apliqué, así que tus avisos siguen como estaban. Si todavía lo quieres, dímelo otra vez y te lo vuelvo a preguntar.";
}

/** Instante ISO desplazado N dias. El nucleo calcula el plazo, no el modelo. */
function sumarDias(nowIso: string, dias: number): string {
  const instante = new Date(nowIso);
  const base = Number.isFinite(instante.getTime()) ? instante : new Date();
  return new Date(base.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * `18` (formatos): la fecha que ve el usuario es la de Lima, no la del proceso.
 * `es-PE` con `America/Lima` es el mismo formato que usa el resto del producto.
 */
function fechaLegible(iso: string): string {
  const fecha = new Date(iso);
  if (!Number.isFinite(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    timeZone: "America/Lima",
  }).format(fecha);
}
