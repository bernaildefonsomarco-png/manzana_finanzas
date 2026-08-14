import { z } from "zod";
import {
  ConversationalAnswerSchema,
  ConversationQuerySchema,
  ConversationToolNameSchema,
  ConversationTurnStateSchema,
  type ConversationContextPack,
} from "@/agents/conversation-agent/types";
import {
  DataAgentOutputSchema,
  type DataContextPack,
} from "@/agents/data-agent/types";
import {
  SemanticCorrectionInterpretationSchema,
} from "@/agents/correction-agent/types";
import {
  OrchestrationPlanSchema,
  PlanningGoalSchema,
  PlanningWorkflowSchema,
  type OrchestrationPlanningContextPack,
} from "@/agents/orchestration-planning-agent/types";
import type { AgentConversationTurn } from "@/agents/runtime/types";
import type { TurnWorkspace } from "@/core/conversation/turn-workspace";
import { DEBT_ACTION_INTENTS } from "@/core/debts/debt-action-request";
import { LIGHT_ACTION_INTENTS } from "@/core/light-actions/light-action-request";
import { MONEY_ACTION_INTENTS } from "@/core/money-actions/money-action-request";
import { MOVEMENT_ACTION_INTENTS } from "@/core/movement-actions/movement-action-request";
import { PREFERENCE_INTENTS } from "@/core/preferences/preference-request";
import { SemanticQuerySchema } from "@/core/semantics/query";

export const TurnInterpreterSchema = z.object({
  goal: PlanningGoalSchema,
  workflow: PlanningWorkflowSchema,
  semantic_query: ConversationQuerySchema,
  semantic_turn: ConversationTurnStateSchema,
  response_strategy: z.enum([
    "acknowledge",
    "clarify",
    "confirm",
    "explain",
    "mixed",
  ]),
  confidence: z.number().min(0).max(1),
  evidence_signals: z.array(z.string().trim().min(1).max(240)).max(12),
});
export type TurnInterpreter = z.infer<typeof TurnInterpreterSchema>;

export const ReferenceResolverSchema = z.object({
  resolution: z.enum([
    "not_applicable",
    "focus_set",
    "single",
    "multiple",
    "ambiguous",
    "no_candidate",
  ]),
  focus_id: z.string().nullable(),
  candidate_movement_ids: z.array(z.string()).max(80),
  candidate_entity_ids: z.array(z.string()).max(80),
  visible_order_ids: z.array(z.string()).max(80),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string().trim().min(1).max(240)).max(8),
  evidence_refs: z.array(z.string().trim().min(1).max(240)).max(12),
});
export type ReferenceResolver = z.infer<typeof ReferenceResolverSchema>;

export const ToolRequestSchema = z.object({
  request_id: z.string().trim().min(1).max(80),
  tool_name: ConversationToolNameSchema,
  query: ConversationQuerySchema,
  purpose: z.string().trim().min(1).max(240),
  required_for_response: z.boolean(),
});
export type ToolRequest = z.infer<typeof ToolRequestSchema>;

export const FinancialProposalSchema = DataAgentOutputSchema;
export type FinancialProposal = z.infer<typeof FinancialProposalSchema>;

export const CorrectionProposalSchema =
  SemanticCorrectionInterpretationSchema;
export type CorrectionProposal = z.infer<typeof CorrectionProposalSchema>;

/**
 * `RUL-ESTR-01`: modulo por el que el ejecutivo propone crear, modificar,
 * cerrar, pausar o reanudar una caja, una meta, un presupuesto, un pago
 * recurrente, una cuenta o una subcategoria.
 *
 * `subcategoria` viaja por aqui y no por una superficie propia justamente para
 * heredar lo que este modulo ya tiene: confirmacion, caducidad, "deshacer" y
 * los avisos de `ERR-ASI-01`. La **categoria** no es un valor posible y no
 * puede serlo: las 12 son fijas (`CATEGORY_IDS`). Cuando la persona pida una
 * categoria nueva, el nucleo lo contesta con nombre propio en vez de callar.
 *
 * Es deliberadamente plano y no un comando: el modelo describe lo que entendio
 * y `compileStructureProposal` lo convierte en un borrador tipado, aplicando
 * `RUL-PRES-01` y los campos obligatorios de cada entidad. El modelo no emite
 * comandos, IDs de idempotencia ni confirmaciones, igual que en
 * `correction_proposal`.
 *
 * `RUL-ESTR-05`: en `archive` el modelo tampoco redacta la consecuencia. Dice
 * que entiende que hay que cerrar; lo que se pierde lo pone el nucleo con un
 * texto fijo.
 */
export const StructureProposalRequestSchema = z.object({
  intent: z.enum(["none", "create", "update", "archive", "pause", "resume"]),
  entity: z
    .enum([
      "caja",
      "meta",
      "presupuesto",
      "recurrente",
      "cuenta",
      "subcategoria",
    ])
    .nullable(),
  /** Lo que se le va a preguntar al usuario, en su idioma y con sus datos. */
  summary: z.string().trim().max(280),
  /**
   * Texto del boton. El limite es 60 y no 40 porque un `max` de Zod sobre la
   * salida del modelo **rechaza**, no recorta: una etiqueta natural en espanol
   * —"Si, cierra la caja del viaje a Cusco"— tumbaria el turno entero. El
   * recorte por canal vive en el adaptador que lo necesita, no aqui.
   */
  confirm_label: z.string().trim().max(60),
  confidence: z.number().min(0).max(1),
  /** Dudas que impiden proponer. Con una sola, el turno pregunta. */
  ambiguities: z.array(z.string().trim().min(1).max(240)).max(4),
  /** ID de la estructura sobre la que se actua. Nulo al crear. */
  target_id: z.string().nullable(),
  name: z.string().trim().max(80).nullable(),
  /**
   * Monto principal: lo que se aparta en una caja, el objetivo de una meta,
   * el limite de un presupuesto, lo que se espera pagar en un recurrente o el
   * saldo declarado de una cuenta nueva.
   */
  amount: z.number().nullable(),
  target_amount: z.number().nullable(),
  target_date: z.string().nullable(),
  account_id: z.string().nullable(),
  box_id: z.string().nullable(),
  box_type: z.enum(["compromiso", "objetivo", "emergencia"]).nullable(),
  /**
   * En un presupuesto o un pago recurrente, de que categoria es. En una
   * **subcategoria** es otra cosa: es la categoria de la que cuelga, y ahi no
   * es opcional — una subcategoria suelta no existe en el dominio.
   */
  category_id: z.string().nullable(),
  period_kind: z.enum(["semanal", "quincenal", "mensual"]).nullable(),
  budget_kind: z
    .enum(["presupuesto", "limite_blando", "limite_duro"])
    .nullable(),
  /** Solo pagos recurrentes: cada cuanto se espera el cobro. */
  frequency: z
    .enum(["weekly", "biweekly", "monthly", "yearly", "custom_window"])
    .nullable(),
  /** Solo pagos recurrentes: la proxima fecha esperada, en `YYYY-MM-DD`. */
  next_expected_date: z.string().nullable(),
  /** Solo pagos recurrentes: si el monto es siempre el mismo o no. */
  amount_variability: z.enum(["fixed", "variable", "estimated"]).nullable(),
  /** Moneda de un pago recurrente o de una cuenta nueva. */
  currency: z.enum(["PEN", "USD"]).nullable(),
  /** Solo cuentas: de que tipo es. */
  account_type: z.enum(["digital", "banco", "fisico", "tarjeta"]).nullable(),
  /** Solo cuentas: el banco o la app donde vive. */
  institution: z.string().trim().max(80).nullable(),
});
export type StructureProposalRequest = z.infer<
  typeof StructureProposalRequestSchema
>;

/**
 * `RUL-MEM-16`: modulo por el que el ejecutivo dice que este turno es una orden
 * sobre la **memoria** del usuario —verla, olvidar algo, corregir algo, o
 * encender y apagar el aprendizaje.
 *
 * Existe por la misma razon que `structure_proposal`: hasta ahora la intencion
 * se detectaba con expresiones regulares ancladas a frases literales, y "che,
 * olvidate de eso" o "¿que te acordas de mi?" no matcheaban ninguna. El fallo
 * era ademas asimetrico —`list` degradaba con gracia al modelo, pero `forget`,
 * `correct`, `enable` y `disable` caian a una ruta sin ejecutor y el asistente
 * respondia amablemente **sin olvidar nada**.
 *
 * Es deliberadamente plano y no un comando, igual que `structure_proposal`: el
 * modelo describe lo que entendio y `compileMemoryControlRequest` lo convierte
 * en una orden tipada. El modelo no elige IDs de recuerdo, no decide el nivel
 * de confirmacion y no ejecuta nada.
 */
export const MemoryControlRequestSchema = z.object({
  /**
   * `forget_all` esta aqui **para poder rechazarlo con nombre propio**
   * (`WEB-D065`, `40` §8.2): sin ese valor, "borra todo lo que sabes de mi" se
   * leeria como un `forget` con target "todo" y podria terminar borrando un
   * recuerdo cualquiera. Declararlo permite responder que el motor no puede y
   * dar la via de pantalla.
   */
  intent: z.enum([
    "none",
    "list",
    "forget",
    "correct",
    "enable",
    "disable",
    "forget_all",
  ]),
  /**
   * A que recuerdo se refiere, con las palabras del usuario o con su codigo
   * `M-XXXXXX` si lo dijo. Vacio cuando el usuario no lo acoto ("olvidate de
   * eso"): el nucleo desambigua contra los recuerdos reales, nunca el modelo.
   */
  target: z.string().trim().max(240),
  /** Solo en `correct`: la version nueva que el usuario acaba de dictar. */
  replacement: z.string().trim().max(280),
  confidence: z.number().min(0).max(1),
  /** Dudas que impiden actuar. Con una sola, el turno pregunta. */
  ambiguities: z.array(z.string().trim().min(1).max(240)).max(4),
});
export type MemoryControlRequest = z.infer<typeof MemoryControlRequestSchema>;

/**
 * `RUL-LIG-01`: modulo por el que el ejecutivo dice que este turno pide una
 * accion de nivel `ninguna` del catalogo (`40` §7) — posponer o descartar un
 * recordatorio, descartar o valorar un descubrimiento, ocultar o mostrar un
 * bloque del Inicio.
 *
 * Es plano por la misma razon que `structure_proposal` y `memory_control`: el
 * modelo describe lo que entendio y `compileLightActionRequest` lo convierte en
 * una orden tipada. El modelo no decide el nivel de confirmacion —ya lo decidio
 * el catalogo— y no ejecuta nada.
 *
 * La diferencia con los otros dos: estas si se aplican en el mismo turno,
 * porque el catalogo dice que no llevan tarjeta. Por eso el umbral de duda es
 * mas duro y una sola ambiguedad basta para no ejecutar.
 */
export const LightActionRequestSchema = z.object({
  intent: z.enum(LIGHT_ACTION_INTENTS),
  // `LIGHT_ACTION_INTENTS` vive en el nucleo, con el ejecutor, y no aqui: el
  // nombre de cada accion es de catalogo (`40` §7), no del contrato del modelo.
  /**
   * El `id` exacto que devolvio `get_reminders` o `get_insights`, o la clave de
   * bloque de `get_home_preferences`. Nunca un identificador inventado.
   */
  target_id: z.string().trim().max(80),
  /** Solo `marcar_descubrimiento`: `util` o `no_util`. */
  value: z.string().trim().max(40),
  /** Solo `posponer_recordatorio`: cuantos dias pidio el usuario. */
  postpone_days: z.number().int().min(1).max(30).nullable(),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string().trim().min(1).max(240)).max(4),
});
export type LightActionRequest = z.infer<typeof LightActionRequestSchema>;

/**
 * `AC-PERF-14`, `20c` §6b.1: modulo por el que el ejecutivo dice que en este
 * turno la persona conto —o dejo ver— algo **sobre ella misma** que cambia como
 * se leen sus numeros: como le pagan, a que se dedica, con quien vive, a quien
 * mantiene, un viaje en curso, su preocupacion principal.
 *
 * Existe por la misma razon que `structure_proposal`, `memory_control` y
 * `light_action`, y se resuelve igual: **sin una pasada de modelo nueva**. El
 * ejecutivo ya lee el turno entero una vez; pedirle un campo mas cuesta tokens,
 * no latencia. Una segunda llamada encadenada para "extraer hechos de perfil"
 * habria devuelto el turno a la arquitectura que se desmonto por lenta.
 *
 * Es deliberadamente plano y no un comando: el modelo describe lo que oyo y
 * `compileProfileSignal` decide si eso se guarda. El modelo no elige la capa
 * (sale del prefijo del `subject_key`), no decide si algo es sensible, no
 * pregunta y no escribe.
 *
 * `20c` §6b.1: se registra en el momento y **se pregunta despues**. Este modulo
 * es solo el registro; quien pregunta es el gate (`AC-PERF-02`).
 */
export const ProfileSignalRequestSchema = z.object({
  intent: z.enum(["none", "observed"]),
  /**
   * `ambito:valor` (`36` §7). El ambito es la capa de `20c` §2 y solo se
   * aceptan `vida:` y `vinculo:`: `estilo` ya viaja por
   * `orchestration_plan.style_update` y `hilo` es el estado del hilo.
   */
  subject_key: z.string().trim().max(120),
  /** La frase que se le mostrara al usuario para confirmarla, en sus terminos. */
  statement: z.string().trim().max(280),
  /** `20c` §3: `dicho` lo conto la persona, `observado` lo dedujo el motor. */
  origin: z.enum(["dicho", "observado"]),
  /**
   * `20c` §3: "se pregunta cuando el hecho desbloquea algo concreto". Que
   * habilita saberlo, dicho en una frase. Vacio significa que no habilita nada,
   * y entonces no se guarda: `20c` §9 cuenta como coste de privacidad sin
   * beneficio los hechos que nunca se usan.
   */
  unlocks: z.string().trim().max(240),
  /**
   * `id` exacto de la categoria de la que salio la observacion, si salio de
   * una. El nucleo resuelve su `is_sensitive` contra el catalogo real
   * (`AC-PERF-10`); el modelo no declara sensibilidad.
   */
  source_category_id: z.string().trim().max(80).nullable(),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string().trim().min(1).max(240)).max(4),
});
export type ProfileSignalRequest = z.infer<typeof ProfileSignalRequestSchema>;

/**
 * `RUL-PREF-01`: modulo por el que el ejecutivo dice que este turno pide
 * cambiar una **preferencia de aviso** — pausar los recordatorios, dejar de
 * recibir los de un tipo, mover el horario silencioso, o autorizar (o revocar)
 * que se le escriba al correo.
 *
 * Existe por la misma razon que `structure_proposal`, `memory_control`,
 * `light_action` y `profile_signal`, y se resuelve igual: **sin una pasada de
 * modelo nueva**. El ejecutivo ya lee el turno entero una vez; pedirle un campo
 * mas cuesta tokens, no latencia.
 *
 * Es deliberadamente plano y no un comando: el modelo describe lo que entendio
 * y `compilePreferenceRequest` lo convierte en una orden tipada. El modelo no
 * elige el nivel de confirmacion —ya lo decidio el catalogo (`40` §7.14): tres
 * son `tarjeta` y uno es `consentimiento`—, no calcula fechas y no ejecuta
 * nada.
 *
 * A diferencia de `light_action`, ninguna de estas se aplica en el turno en que
 * se pide: todas llevan tarjeta, y la de correo lleva ademas la constancia del
 * consentimiento.
 */
export const PreferenceChangeRequestSchema = z.object({
  intent: z.enum(PREFERENCE_INTENTS),
  // `PREFERENCE_INTENTS` vive en el nucleo, con el ejecutor, y no aqui: el
  // nombre de cada comando es de catalogo (`40` §7.14), no del contrato del
  // modelo.
  /**
   * Direccion de lo que pide el usuario: `true` enciende lo que nombra el
   * intent (pausar, silenciar, activar el correo) y `false` es su accion
   * inversa (reanudar, volver a avisar, dejar de escribir). `40` §3 exige que
   * toda `tarjeta` se pueda deshacer y que un `consentimiento` sea revocable
   * en cualquier momento, y ninguna de esas inversas tiene nombre propio en
   * §7. Se ignora en `cambiar_horario_silencioso`, que no tiene direccion.
   */
  activar: z.boolean(),
  /**
   * Tipo de recordatorio del vocabulario cerrado de `37` (`RUL-NOTIF-01`).
   * Solo en `silenciar_tipo_recordatorio` y `activar_correo_recordatorios`;
   * vacio en los demas. El nucleo rechaza cualquier nombre que no exista en
   * vez de aproximarlo al mas parecido.
   */
  reminder_kind: z.string().trim().max(40),
  /**
   * Solo en `pausar_recordatorios`: cuantos dias pidio el usuario. El nucleo
   * convierte los dias a fecha —"hasta el lunes" son 3 dias, no una fecha que
   * el modelo escriba— y la tarjeta muestra el dia resultante (`40` §7.14).
   */
  pausar_dias: z.number().int().min(1).max(90).nullable(),
  /** Solo en `cambiar_horario_silencioso`: inicio de la franja, `HH:MM` en 24h. */
  desde_hora: z.string().trim().max(5).nullable(),
  /** Solo en `cambiar_horario_silencioso`: fin de la franja, `HH:MM` en 24h. */
  hasta_hora: z.string().trim().max(5).nullable(),
  confidence: z.number().min(0).max(1),
  /** Dudas que impiden proponer. Con una sola, el turno pregunta. */
  ambiguities: z.array(z.string().trim().min(1).max(240)).max(4),
});
export type PreferenceChangeRequest = z.infer<
  typeof PreferenceChangeRequestSchema
>;

/**
 * `RUL-DEUDAS-13`: modulo por el que el ejecutivo dice que este turno pide una
 * operacion del **ciclo de vida de una deuda** — cerrarla, reabrirla, mover o
 * saltar una cuota, o dar de alta a una persona con la que se tienen deudas.
 *
 * Existe por la misma razon que `structure_proposal`, `memory_control`,
 * `light_action`, `profile_signal` y `preference_change`, y se resuelve igual:
 * **sin una pasada de modelo nueva**. El ejecutivo ya lee el turno entero una
 * vez; pedirle un campo mas cuesta tokens, no latencia.
 *
 * Es deliberadamente plano y no un comando: el modelo describe lo que entendio y
 * `compileDebtAction` lo convierte en un borrador tipado. El modelo no elige el
 * nivel de confirmacion —ya lo decidio `40` §7.11: `cerrar_deuda` es `riesgo` y
 * el resto `tarjeta`—, no lee saldos y no ejecuta nada.
 *
 * Y una diferencia propia del dominio, que es la razon de que `close_reason`
 * exista como campo separado en vez de deducirse: **cerrar no es una operacion,
 * son dos** (`RUL-DEUDAS-13`). El modelo solo transmite lo que la persona dijo;
 * quien decide entre pagada y condonada es el nucleo, contra el saldo real, y
 * cuando ninguna de las dos es la unica legal, pregunta.
 */
export const DebtActionRequestSchema = z.object({
  intent: z.enum(DEBT_ACTION_INTENTS),
  // `DEBT_ACTION_INTENTS` vive en el nucleo, con el compilador, y no aqui: el
  // nombre de cada comando es de catalogo (`40` §7.11), no del contrato del
  // modelo. Cuatro de sus valores existen solo para poder rechazarse por su
  // nombre (`WEB-D205`), igual que `forget_all` en `memory_control`.
  /**
   * El `id` exacto de una deuda que el turno haya leido. Vacio cuando la persona
   * la nombro sin id: el nucleo la resuelve contra las deudas reales, y un id
   * que no exista entre ellas se descarta en vez de confiarse.
   */
  debt_id: z.string().trim().max(80),
  /** El `id` exacto de la cuota, solo en `reprogramar_cuota` y `saltar_cuota`. */
  installment_id: z.string().trim().max(80),
  /**
   * `RUL-DEUDAS-13`: lo que la persona dijo sobre **como** se cierra, si lo
   * dijo. `sin_decidir` no es un fallo del modelo: es la respuesta correcta
   * cuando la frase fue "cierra la de Marco", y lo que hace que el turno
   * pregunte en vez de elegir por ella (`ERR-DEUDAS-06`).
   */
  close_reason: z.enum(["sin_decidir", "pagada", "condonada"]),
  /** Solo `reprogramar_cuota`: la fecha nueva, en `YYYY-MM-DD`. */
  due_date: z.string().trim().max(10),
  /**
   * Motivo con las palabras de la persona. Obligatorio en `saltar_cuota`
   * (`RUL-DEUDAS-08`) y opcional en `reprogramar_cuota`.
   */
  reason: z.string().trim().max(180),
  /** Solo `crear_persona`: como se llama. */
  person_name: z.string().trim().max(60),
  /** Solo `crear_persona`: la relacion, si la dijo ("mi hermano", "el casero"). */
  person_relationship: z.string().trim().max(60),
  confidence: z.number().min(0).max(1),
  /** Dudas que impiden proponer. Con una sola, el turno pregunta. */
  ambiguities: z.array(z.string().trim().min(1).max(240)).max(4),
});
export type DebtActionRequest = z.infer<typeof DebtActionRequestSchema>;

/**
 * `24` §9 (`ACT-CUENTAS-10` a `13`): modulo por el que el ejecutivo dice que
 * este turno pide mover dinero real entre cuentas o cajas del propio usuario
 * — transferir, separar en una caja, devolver a libre, o mover entre dos
 * cajas. Mismo contrato que `debt_action`: plano, sin comandos, resuelto por
 * `compileMoneyAction` sin una pasada de modelo nueva.
 *
 * `from_account_id`/`to_account_id` son de `transferir`; `box_origin_id` es
 * de `devolver_a_libre` y `mover_entre_cajas`; `box_destination_id` es de
 * `separar_en_caja` y `mover_entre_cajas`. Cuentas y cajas ya viajan enteras
 * en el contexto del turno (`DataContextPack.accounts`/`.boxes`), asi que a
 * diferencia de `debt_id` no hay resolucion por texto para las operaciones de
 * dos lados: `transferir` y `mover_entre_cajas` exigen el id exacto o el
 * nucleo pregunta.
 */
export const MoneyActionRequestSchema = z.object({
  intent: z.enum(MONEY_ACTION_INTENTS),
  from_account_id: z.string().trim().max(80),
  to_account_id: z.string().trim().max(80),
  box_origin_id: z.string().trim().max(80),
  box_destination_id: z.string().trim().max(80),
  amount: z.number(),
  /** Descripcion opcional que la persona haya dado, tal cual la dijo. */
  description: z.string().trim().max(180),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string().trim().min(1).max(240)).max(4),
});
export type MoneyActionRequest = z.infer<typeof MoneyActionRequestSchema>;

/**
 * `26` §14.2: modulo por el que el ejecutivo dice que este turno pide
 * restaurar un movimiento eliminado o duplicar uno existente. Mismo contrato
 * que `debt_action` y `money_action`.
 */
export const MovementActionRequestSchema = z.object({
  intent: z.enum(MOVEMENT_ACTION_INTENTS),
  /** El id exacto del movimiento, si lo leyo de una consulta de este turno. */
  movement_id: z.string().trim().max(80),
  /** Solo `duplicar_movimiento`: fecha nueva en `YYYY-MM-DD`, vacio es "ahora". */
  new_occurred_at: z.string().trim().max(10),
  /** Solo `duplicar_movimiento`: monto nuevo; `0` es "el mismo del original". */
  new_amount: z.number(),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string().trim().min(1).max(240)).max(4),
});
export type MovementActionRequest = z.infer<typeof MovementActionRequestSchema>;

export const GroundedClaimSchema = z.object({
  claim_id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(320),
  claim_type: z.enum([
    "amount",
    "date",
    "weekday",
    "category",
    "count",
    "list_membership",
    "status",
    "explanation",
    "projection",
    "non_financial",
  ]),
  evidence_refs: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
  source_tools: z.array(ConversationToolNameSchema).max(8),
  // `22` §2: "Una proyección | Los datos base y los supuestos" — obligatorio
  // solo para claim_type "projection"; vacío para el resto.
  assumptions: z.array(z.string().trim().min(1).max(200)).max(6).default([]),
});
export type GroundedClaim = z.infer<typeof GroundedClaimSchema>;

// `22` §9: dos niveles de hallazgo. `afirmacion` viene de un motor
// determinístico; `impresion` es observación del modelo y no puede contener
// una cifra que no salga de datos consultados en este turno. Máximo uno por
// turno (`22` §9, "Máximo un hallazgo por turno").
export const FindingSchema = z.object({
  finding_id: z.string().trim().min(1).max(80),
  level: z.enum(["afirmacion", "impresion"]),
  text: z.string().trim().min(1).max(320),
  has_figure: z.boolean(),
  evidence_refs: z.array(z.string().trim().min(1).max(240)).max(12),
});
export type Finding = z.infer<typeof FindingSchema>;

export const ResponseCompositionSchema = ConversationalAnswerSchema.extend({
  grounded_claims: z.array(GroundedClaimSchema).max(24),
  composition_stage: z.enum([
    "final_read_only",
    "pre_core_draft",
    "safe_clarification",
  ]),
});
export type ResponseComposition = z.infer<typeof ResponseCompositionSchema>;

export const ConversationalExecutiveOutputSchema = z.object({
  turn_interpretation: TurnInterpreterSchema,
  reference_resolution: ReferenceResolverSchema,
  tool_requests: z.array(ToolRequestSchema).max(8),
  financial_proposals: FinancialProposalSchema,
  correction_proposal: CorrectionProposalSchema,
  // Nullable con default para que un estado o fixture anterior a `RUL-ESTR-01`
  // siga validando: la ausencia de propuesta de estructura es "no hay".
  structure_proposal: StructureProposalRequestSchema.nullable().default(null),
  // `RUL-MEM-16`: mismo contrato que `structure_proposal` — nullable con default
  // para que un estado o fixture anterior siga validando. Ausencia es "este
  // turno no habla de memoria".
  memory_control: MemoryControlRequestSchema.nullable().default(null),
  // `RUL-LIG-01`: mismo contrato que los dos anteriores — nullable con default
  // para que un estado o fixture anterior siga validando. Ausencia es "este
  // turno no pide ninguna accion ligera".
  light_action: LightActionRequestSchema.nullable().default(null),
  // `AC-PERF-14`: mismo contrato que los tres anteriores — nullable con default
  // para que un estado o fixture anterior siga validando. Ausencia es "este
  // turno no observo nada sobre la persona".
  profile_signal: ProfileSignalRequestSchema.nullable().default(null),
  // `RUL-PREF-01`: mismo contrato que los cuatro anteriores — nullable con
  // default para que un estado o fixture anterior siga validando. Ausencia es
  // "este turno no pide cambiar ninguna preferencia".
  preference_change: PreferenceChangeRequestSchema.nullable().default(null),
  // `RUL-DEUDAS-13`: mismo contrato que los cinco anteriores — nullable con
  // default para que un estado o fixture anterior siga validando. Ausencia es
  // "este turno no pide nada del ciclo de vida de una deuda".
  debt_action: DebtActionRequestSchema.nullable().default(null),
  // `24` §9: mismo contrato — nullable con default para que un estado o
  // fixture anterior siga validando. Ausencia es "este turno no mueve dinero
  // entre cuentas ni cajas".
  money_action: MoneyActionRequestSchema.nullable().default(null),
  // `26` §14.2: mismo contrato. Ausencia es "este turno no pide restaurar ni
  // duplicar un movimiento".
  movement_action: MovementActionRequestSchema.nullable().default(null),
  response_composition: ResponseCompositionSchema,
  orchestration_plan: OrchestrationPlanSchema,
  findings: z.array(FindingSchema).max(1).default([]),
  confidence: z.number().min(0).max(1),
  safety_flags: z.array(z.string().trim().min(1).max(160)).max(16),
});
export type ConversationalExecutiveOutput = z.infer<
  typeof ConversationalExecutiveOutputSchema
>;

export const ExecutiveToolCallInputSchema = z.object({
  // Nulo para "consultar_datos_abiertos" — esa tool usa `semantic_query`,
  // no el vocabulario cerrado de `ConversationQuery` (`20b` S5, `WEB-D259`).
  query: ConversationQuerySchema.nullable(),
  // Solo para "consultar_datos_abiertos" (`20b` S5.2).
  semantic_query: SemanticQuerySchema.nullable().default(null),
  should_use_active_memory: z.boolean(),
});
export type ExecutiveToolCallInput = z.infer<
  typeof ExecutiveToolCallInputSchema
>;

export type ConversationalExecutiveContextPack = {
  context_pack_type: "conversational_executive_context";
  version: "v1";
  planning_context: OrchestrationPlanningContextPack;
  data_context: DataContextPack;
  conversation_context: ConversationContextPack;
  turn_workspace: TurnWorkspace;
  /**
   * Turnos previos del hilo, mas antiguo primero y sin el mensaje actual.
   * Viaja en el pack solo como transporte: el agente lo levanta a mensajes
   * `user`/`assistant` del runtime y no lo serializa dentro del Context Pack
   * (`RUL-ASI-11`: el modelo lee una conversacion, no un formulario).
   */
  conversation_history?: AgentConversationTurn[];
  constraints: string[];
  validation_feedback?: {
    attempt: number;
    issue_codes: string[];
    instructions: string[];
  } | null;
};
