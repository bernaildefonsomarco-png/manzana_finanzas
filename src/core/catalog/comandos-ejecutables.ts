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
];
