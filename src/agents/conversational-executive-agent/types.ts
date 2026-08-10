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
 * recurrente o una cuenta.
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
    .enum(["caja", "meta", "presupuesto", "recurrente", "cuenta"])
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
