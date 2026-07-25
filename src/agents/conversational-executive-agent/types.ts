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
import type { TurnWorkspace } from "@/core/conversation/turn-workspace";

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
    "non_financial",
  ]),
  evidence_refs: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
  source_tools: z.array(ConversationToolNameSchema).max(8),
});
export type GroundedClaim = z.infer<typeof GroundedClaimSchema>;

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
  confidence: z.number().min(0).max(1),
  safety_flags: z.array(z.string().trim().min(1).max(160)).max(16),
});
export type ConversationalExecutiveOutput = z.infer<
  typeof ConversationalExecutiveOutputSchema
>;

export const ExecutiveToolCallInputSchema = z.object({
  query: ConversationQuerySchema,
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
  constraints: string[];
  validation_feedback?: {
    attempt: number;
    issue_codes: string[];
    instructions: string[];
  } | null;
};
