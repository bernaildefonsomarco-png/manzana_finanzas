// `46` `RUL-MAIL-02` — las cinco condiciones se comprueban **al enviar**, no
// al encolar. Función pura y determinista: nada de I/O aquí, quien llama
// (el worker) ya resolvió cada entrada consultando la base de datos en el
// momento del envío.

export type EmailKind = "transaccional" | "notificacion";

export type SendPolicyInput = {
  kind: EmailKind;
  /** `false` solo tiene sentido para `notificacion`: el tipo lo apagó el usuario. */
  typeStillActive: boolean;
  /** La causa que originó el correo sigue vigente (p. ej. la cuota sigue sin pagar). */
  causeStillValid: boolean;
  addressSuppressed: boolean;
  /** `true` si el instante de envío cae dentro del horario silencioso. */
  withinQuietHours: boolean;
  /** `true` si ya se alcanzó el límite diario de esa clase de notificación. */
  dailyLimitReached: boolean;
};

export type SendDecision =
  | { action: "send" }
  | { action: "discard"; reason: "tipo_desactivado" | "causa_resuelta" | "direccion_suprimida" }
  | { action: "defer"; reason: "horario_silencioso" | "limite_diario" };

/**
 * `RUL-MAIL-03` dice "los transaccionales ignoran las cinco reglas", pero su
 * propio encabezado ("horario silencioso y límites, solo para
 * notificaciones") y su único ejemplo son sobre horario — la supresión
 * (`RUL-MAIL-08`) es una regla distinta, cuya razón de ser es proteger la
 * reputación del dominio: un correo a una dirección que rebota de forma
 * permanente rebota otra vez sin importar si es transaccional, y seguir
 * intentando es exactamente lo que `RUL-MAIL-06`/`RUL-MAIL-08` existen para
 * evitar. Se corrige aquí (`WEB-D282`): la supresión bloquea **todo** tipo
 * de correo; tipo-activo/causa-vigente/horario/límite siguen siendo solo
 * de notificación, con el mismo razonamiento que ya traía el comentario
 * original — un transaccional no tiene "tipo" que apagar ni "causa" que
 * resolverse.
 */
export function decideSend(input: SendPolicyInput): SendDecision {
  if (input.addressSuppressed) return { action: "discard", reason: "direccion_suprimida" };

  if (input.kind === "transaccional") {
    return { action: "send" };
  }

  if (!input.typeStillActive) return { action: "discard", reason: "tipo_desactivado" };
  if (!input.causeStillValid) return { action: "discard", reason: "causa_resuelta" };
  if (input.withinQuietHours) return { action: "defer", reason: "horario_silencioso" };
  if (input.dailyLimitReached) return { action: "defer", reason: "limite_diario" };
  return { action: "send" };
}

/**
 * `RUL-MAIL-03`: 22:00–08:00 en `America/Lima`, sin horario de verano.
 * Recibe la hora local ya resuelta (0–23) para no acoplar este módulo a
 * `Intl`/zona horaria — quien llama usa `src/shared/dates/lima.ts`.
 */
export function isWithinQuietHours(localHour: number, quietStart = 22, quietEnd = 8): boolean {
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) return localHour >= quietStart && localHour < quietEnd;
  // Cruza medianoche: 22 → 8 significa [22,24) ∪ [0,8).
  return localHour >= quietStart || localHour < quietEnd;
}
