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
