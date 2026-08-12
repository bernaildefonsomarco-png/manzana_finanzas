// Censo de cobertura: que comandos del catalogo cerrado de `40` §7 puede
// ejecutar hoy el asistente **conversando**, y por que camino.
//
// Existe para poder responder con un numero medido en vez de estimado. La
// pregunta "¿cuantos de los 99 ejecuta?" se contestaba antes contando a ojo, y
// a ojo se cuenta de mas: es facil dar por ejecutable un comando cuyo ejecutor
// existe pero al que ninguna ruta conversacional llega.
//
// Reglas de esta lista, para que siga siendo verdad:
//
//  - Solo entra un nombre si hay un camino desde `FinancialOrchestrator` hasta
//    una escritura real. Que exista la ruta HTTP de la pantalla no cuenta.
//  - `via` nombra el ejecutor concreto. Si no se puede nombrar, no entra.
//  - Ante la duda, **no entra**. Un censo que infla es peor que uno corto.
//
// `comandos-ejecutables.test.ts` comprueba contra `generated.ts` que cada
// nombre exista de verdad en el catalogo, asi que un rename en `40` rompe aqui
// en vez de dejar el censo mintiendo en silencio.

export type ComandoEjecutable = {
  nombre: string;
  via: string;
};

export const COMANDOS_EJECUTABLES_POR_EL_ASISTENTE: ComandoEjecutable[] = [
  // --- Estructura (`RUL-ESTR-01`, `structure-executor.ts`) -----------------
  { nombre: "crear_cuenta", via: "structure-executor: CreateAccountCommand" },
  { nombre: "editar_cuenta", via: "structure-executor: UpdateAccountCommand" },
  { nombre: "archivar_cuenta", via: "structure-executor: ArchiveAccountCommand" },
  { nombre: "crear_caja", via: "structure-executor: CreateBoxCommand" },
  { nombre: "editar_caja", via: "structure-executor: UpdateBoxCommand" },
  { nombre: "eliminar_caja", via: "structure-executor: ArchiveBoxCommand" },
  { nombre: "crear_meta", via: "structure-executor: CreateGoalCommand" },
  { nombre: "crear_presupuesto", via: "structure-executor: CreateBudgetCommand" },
  { nombre: "editar_presupuesto", via: "structure-executor: UpdateBudgetCommand" },
  { nombre: "pausar_presupuesto", via: "structure-executor: PauseBudgetCommand" },
  { nombre: "archivar_presupuesto", via: "structure-executor: ArchiveBudgetCommand" },
  { nombre: "crear_recurrente", via: "recurring-executor: CreateRecurringCommand" },
  {
    nombre: "actualizar_monto_esperado",
    via: "recurring-executor: UpdateRecurringCommand",
  },
  { nombre: "pausar_recurrente", via: "recurring-executor: PauseRecurringCommand" },
  {
    nombre: "reactivar_recurrente",
    via: "recurring-executor: ResumeRecurringCommand",
  },
  {
    nombre: "cancelar_recurrente",
    via: "recurring-executor: ArchiveRecurringCommand",
  },

  // --- Dinero (`CommandDispatcher`) ---------------------------------------
  { nombre: "crear_movimiento", via: "CommandDispatcher: CreateMovementCommand" },
  { nombre: "crear_deuda", via: "CommandDispatcher: DebtCreationCommandHandler" },
  {
    nombre: "registrar_pago_deuda",
    via: "CommandDispatcher: DebtPaymentCommandHandler",
  },
  // `registrar_devolucion` no tiene ejecutor propio ni le hace falta: es el
  // **mismo** camino que `registrar_pago_deuda`, y lo que lo separa es la
  // direccion de la deuda, no el comando. `planDebtPaymentAction` exige
  // `devolucion_recibida` cuando la deuda es `they_owe_me`
  // (`data-action-policy.ts`), y `buildDebtPaymentMovementCommand` emite ese
  // mismo tipo de movimiento por la misma razon (`debt-payment-command.ts`).
  // Entra al censo porque el camino conversacional existe y termina en una
  // escritura real, que es la unica regla de esta lista; no entraba antes
  // porque nadie habia mirado que ya estaba cubierto.
  {
    nombre: "registrar_devolucion",
    via: "CommandDispatcher: DebtPaymentCommandHandler (deuda `they_owe_me` -> movimiento `devolucion_recibida`)",
  },

  // --- Ciclo de vida de deudas (`RUL-DEUDAS-13`, `debt-action-executor.ts`) --
  //
  // Los cuatro primeros van por `commit_debt_operation` (`057`), que trae su
  // propia idempotencia con recibo; el quinto es de clasificacion y ya tenia
  // despachador propio. Los cinco llevan tarjeta o riesgo, asi que entran por
  // el ciclo propuesta -> confirmacion, nunca por ejecucion directa.
  //
  // Los cuatro que faltan de `40` §7.11 **no** entran, y no por descuido:
  // `registrar_interes` y `renegociar_deuda` estan diferidos por `WEB-D205`
  // (`RUL-DEUDAS-11`, `RUL-DEUDAS-12`) y `vincular_caja_a_deuda` no tiene
  // ejecutor en ningun sitio del producto —`boxes.linked_debt_id` solo se lee—.
  // Los tres se rechazan por su nombre con via manual, que no es lo mismo que
  // ejecutarlos.
  {
    nombre: "cerrar_deuda",
    via: "debt-action-executor: closeDebt (`paid` | `forgiven`, riesgo)",
  },
  { nombre: "reabrir_deuda", via: "debt-action-executor: reopenDebt (tarjeta)" },
  {
    nombre: "reprogramar_cuota",
    via: "debt-action-executor: rescheduleDebtInstallment (tarjeta)",
  },
  {
    nombre: "saltar_cuota",
    via: "debt-action-executor: skipDebtInstallment (tarjeta)",
  },
  {
    nombre: "crear_persona",
    via: "debt-action-executor: ClassificationCommandDispatcher CreateRelatedPersonCommand (tarjeta)",
  },

  // --- Correcciones (`16` §10.3, `correction-resolution.ts`) --------------
  {
    nombre: "editar_movimiento",
    via: "correction-resolution: amount / account_origin / account_destination",
  },
  { nombre: "corregir_clasificacion", via: "correction-resolution: category" },
  { nombre: "eliminar_movimiento", via: "correction-resolution: delete" },
  {
    nombre: "cambiar_tipo",
    via: "correction-resolution: loan_to / loan_from (cambia movement_type)",
  },

  // --- Pendientes (`pending-resolution-from-text.ts`) ----------------------
  { nombre: "confirmar_pendiente", via: "resolvePendingFromAction: confirm" },
  {
    nombre: "editar_y_confirmar",
    via: "resolvePendingFromAction: confirm con overrides de cuenta/categoria",
  },
  { nombre: "descartar_pendiente", via: "resolvePendingFromAction: discard" },

  // --- Memoria (`RUL-MEM-16`, `memory-control-from-text.ts`) --------------
  {
    nombre: "olvidar_aprendizaje",
    via: "executeMemoryControlProposal: forget (tarjeta)",
  },
  {
    nombre: "corregir_aprendizaje",
    via: "executeMemoryControlProposal: correct (tarjeta)",
  },
  { nombre: "no_preguntar_mas", via: "resolveMemoryControl: disable" },
  { nombre: "reactivar_aprendizaje", via: "resolveMemoryControl: enable" },

  // --- Acciones ligeras (`RUL-LIG-01`, `light-action-executor.ts`) --------
  { nombre: "posponer_recordatorio", via: "light-action-executor: snoozeReminder" },
  {
    nombre: "descartar_recordatorio",
    via: "light-action-executor: dismissReminder",
  },
  {
    nombre: "descartar_descubrimiento",
    via: "light-action-executor: commitInsightInteraction dismiss",
  },
  {
    nombre: "marcar_descubrimiento",
    via: "light-action-executor: commitInsightInteraction feedback",
  },
  {
    nombre: "ocultar_bloque_inicio",
    via: "light-action-executor: setHomeBlockHidden(true)",
  },
  {
    nombre: "mostrar_bloque_inicio",
    via: "light-action-executor: setHomeBlockHidden(false)",
  },

  // --- Preferencias de aviso (`RUL-PREF-01`, `preference-executor.ts`) -----
  //
  // Los cuatro llevan tarjeta, asi que entran por el ciclo propuesta ->
  // confirmacion, no por ejecucion directa. La accion inversa de cada uno
  // (reanudar, volver a avisar, dejar de escribir) viaja bajo el mismo nombre
  // de catalogo con `activar: false`, asi que no suma nombres al censo: `40`
  // §7 no le da nombre propio a ninguna de esas inversas.
  {
    nombre: "pausar_recordatorios",
    via: "preference-executor: pauseRemindersForUser / resumeRemindersForUser (tarjeta)",
  },
  {
    nombre: "silenciar_tipo_recordatorio",
    via: "preference-executor: setReminderPreferenceForUser channel=dashboard (tarjeta)",
  },
  {
    nombre: "cambiar_horario_silencioso",
    via: "preference-executor: setQuietHoursForUser (tarjeta)",
  },
  {
    nombre: "activar_correo_recordatorios",
    via: "preference-executor: setReminderPreferenceForUser channel=email (consentimiento)",
  },
];
