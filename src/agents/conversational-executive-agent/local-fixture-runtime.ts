import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
  ToolCallSummary,
} from "@/agents/runtime";
import {
  ConversationToolNameSchema,
  type ConversationalAnswer,
  type ConversationToolResult,
} from "@/agents/conversation-agent/types";
import { composeConversationAnswer } from "@/core/conversation/grounded-response-composer";
import { extractDataAgentOutput } from "@/agents/data-agent/local-fixture-runtime";
import { proposeCorrection } from "@/agents/correction-agent/correction-agent";
import type {
  CorrectionAgentOutput,
  CorrectionContextPack,
  SemanticCorrectionInterpretation,
} from "@/agents/correction-agent/types";
import { composeLocalOrchestrationPlan } from "@/agents/orchestration-planning-agent/local-fixture-runtime";
import {
  ACCOUNT_TYPES,
  MOVEMENT_TYPES,
  type AccountType,
  type MovementType,
} from "@/shared/types/domain";
import {
  ConversationalExecutiveOutputSchema,
  type ConversationalExecutiveContextPack,
  type ConversationalExecutiveOutput,
} from "./types";

export class LocalFixtureConversationalExecutiveAgentRuntime
  implements AgentRuntime
{
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    if (request.agent_name !== "conversational_executive_agent") {
      throw new Error(
        "LocalFixtureConversationalExecutiveAgentRuntime solo soporta conversational_executive_agent"
      );
    }

    const startedAt = Date.now();
    const context =
      request.context_pack as ConversationalExecutiveContextPack;
    const plan = composeLocalOrchestrationPlan(context.planning_context);
    const query =
      plan.semantic_query ?? context.planning_context.kernel_hint.query;
    const turnState =
      plan.semantic_turn ?? context.planning_context.kernel_hint.turn_state;
    const toolResults: ConversationToolResult[] = [];
    const toolCalls: ToolCallSummary[] = [];

    for (const toolName of plan.selected_tools) {
      if (!request.tool_executor) {
        toolCalls.push({ tool_name: toolName, status: "skipped" });
        continue;
      }
      try {
        const result = await request.tool_executor({
          call_id: `local-executive:${toolName}`,
          tool_name: toolName,
          arguments: {
            query,
            should_use_active_memory: turnState.should_use_active_memory,
          },
        });
        if (isConversationToolResult(result)) toolResults.push(result);
        toolCalls.push({ tool_name: toolName, status: "called" });
      } catch {
        toolCalls.push({ tool_name: toolName, status: "failed" });
      }
    }

    const correctionContext = buildCorrectionContext(context);
    const correction = proposeCorrection(correctionContext);
    const financialProposals = extractDataAgentOutput(context.data_context);
    const baseResponseComposition =
      plan.workflow === "conversation_read_only" ||
      plan.workflow === "support" ||
      plan.workflow === "mixed_capture_and_query"
        ? composeConversationAnswer({
            ...context.conversation_context,
            query,
            turn_state: turnState,
            tool_results: toolResults,
          })
        : composeNonReadOnlyResponse(plan.goal, correction);
    const hasProposedWrite =
      financialProposals.result.length > 0 ||
      correction.kind !== "not_correction";
    const responseComposition = {
      ...baseResponseComposition,
      grounded_claims: buildGroundedClaims(toolResults),
      composition_stage: hasProposedWrite
        ? ("pre_core_draft" as const)
        : plan.workflow === "conversation_read_only" ||
            plan.workflow === "support"
          ? ("final_read_only" as const)
          : ("safe_clarification" as const),
    };
    const referenceResolution = buildReferenceResolution(
      context,
      correction
    );
    const output = ConversationalExecutiveOutputSchema.parse({
      turn_interpretation: {
        goal: plan.goal,
        workflow: plan.workflow,
        semantic_query: query,
        semantic_turn: turnState,
        response_strategy: plan.response_strategy,
        confidence: plan.confidence,
        evidence_signals: ["local_fixture_semantic_modules"],
      },
      reference_resolution: referenceResolution,
      tool_requests: plan.selected_tools.map((toolName, index) => ({
        request_id: `tool_${index + 1}`,
        tool_name: toolName,
        query,
        purpose: `Obtener evidencia read-only para ${plan.workflow}.`,
        required_for_response: true,
      })),
      financial_proposals: financialProposals,
      correction_proposal: toSemanticCorrection(correction),
      response_composition: responseComposition,
      orchestration_plan: plan,
      confidence: Math.min(plan.confidence, responseComposition.confidence),
      safety_flags: [
        "local_fixture_not_production_llm",
        "single_semantic_turn_authority",
        "no_direct_financial_write",
      ],
    });

    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: toolCalls,
      runtime: {
        provider: "local_fixture",
        model_name: "local-conversational-executive-fixture-v1",
        latency_ms: Date.now() - startedAt,
        cost_estimate: 0,
      },
      safety: {
        policy_flags: output.safety_flags,
        redaction_applied: false,
      },
    };
  }
}

function buildGroundedClaims(toolResults: ConversationToolResult[]) {
  return toolResults.flatMap((result) => {
    const toolName = ConversationToolNameSchema.safeParse(result.tool_name);
    if (result.status !== "called" || !toolName.success) return [];
    return result.facts.slice(0, 12).map((fact, index) => ({
      claim_id: `${result.tool_name}_${index + 1}`,
      text: fact,
      claim_type: "explanation" as const,
      evidence_refs: [`tool:${result.tool_name}:fact:${index}`],
      source_tools: [toolName.data],
    }));
  });
}

function buildCorrectionContext(
  context: ConversationalExecutiveContextPack
): CorrectionContextPack {
  return {
    context_pack_type: "correction_context",
    version: "v1",
    user_id: context.data_context.user_id,
    locale: "es-PE",
    timezone: context.data_context.timezone,
    channel: "whatsapp",
    original_message: context.data_context.original_message,
    received_at: context.data_context.received_at,
    recent_movements: context.data_context.recent_movements
      .filter(
        (
          movement
        ): movement is (typeof context.data_context.recent_movements)[number] & {
          type: MovementType;
        } => MOVEMENT_TYPES.includes(movement.type as MovementType)
      )
      .map((movement) => ({
        id: movement.id,
        type: movement.type,
        amount: movement.amount,
        currency: movement.currency,
        description: movement.description,
        merchant: movement.merchant,
        category_id: movement.category_id,
        occurred_at: movement.occurred_at,
        created_at: movement.occurred_at,
        status:
          movement.status === "deleted" ||
          movement.status === "reversed" ||
          movement.status === "corrected"
            ? movement.status
            : "confirmed",
        account_origin_id: movement.account_origin_id,
        account_destination_id: movement.account_destination_id,
        metadata: {},
      })),
    accounts: context.data_context.accounts
      .filter(
        (account): account is (typeof context.data_context.accounts)[number] & {
          type: AccountType;
        } => ACCOUNT_TYPES.includes(account.type as AccountType)
      )
      .map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        is_default: account.is_default,
      })),
    categories: context.data_context.categories,
    subcategories: context.data_context.subcategories,
    active_conversation_state: {
      last_response_summary:
        context.conversation_context.active_conversation_state
          .last_result_summary,
      continuity_hint:
        context.conversation_context.active_conversation_state.continuity_hint,
      referenced_movement_ids:
        context.conversation_context.active_conversation_state.working_set
          ?.focus_set?.ordered_ids ??
        context.conversation_context.active_conversation_state
          .referenced_movements.map((movement) => movement.id),
      working_set:
        context.conversation_context.active_conversation_state.working_set,
    },
    recent_changes: context.data_context.recent_corrections.map(
      (correction) => ({
        movement_id: correction.movement_id,
        action: correction.action,
        field_name: correction.field_name,
        created_at: correction.created_at,
      })
    ),
    undo_rules: [
      "Toda correccion requiere confirmacion explicita.",
      "No se corrigen transferencias ni asignaciones con el flujo generico.",
    ],
  };
}

function toSemanticCorrection(
  correction: CorrectionAgentOutput
): SemanticCorrectionInterpretation {
  const commands =
    correction.kind === "requires_confirmation"
      ? [correction.command]
      : correction.kind === "candidate_selection_required"
        ? correction.commands
        : [];
  const first = commands[0];
  const isCorrection = correction.kind !== "not_correction";

  return {
    is_correction: isCorrection,
    command_id: null,
    operation: first?.operation ?? (isCorrection ? "none" : "none"),
    correction_type:
      first?.correction_type ??
      (correction.kind === "unsupported" ? "unsupported" : "none"),
    candidate_movement_ids: commands.map((command) => command.movement_id),
    target_amount:
      first?.correction_type === "amount" &&
      typeof first.corrected_fields?.amount === "number"
        ? first.corrected_fields.amount
        : null,
    target_category_id:
      first?.correction_type === "category"
        ? first.corrected_fields?.category_id ?? null
        : null,
    // La subcategoria viaja por id y no por nombre: es lo unico que sigue
    // senalando la misma etiqueta si la persona la renombra entre turnos.
    target_subcategory_id:
      first?.correction_type === "subcategory"
        ? first.corrected_fields?.subcategory_id ?? null
        : null,
    target_subcategory_label: null,
    target_account_id:
      first?.correction_type === "account"
        ? first.corrected_fields?.account_origin_id ??
          first.corrected_fields?.account_destination_id ??
          null
        : null,
    target_movement_type: first?.target_type ?? null,
    related_person_name: first?.related_person_name ?? null,
    reference_resolution:
      correction.kind === "requires_confirmation"
        ? "single"
        : correction.kind === "candidate_selection_required"
          ? "multiple"
          : correction.kind === "no_candidate"
            ? "no_candidate"
            : correction.kind === "needs_clarification" ||
                correction.kind === "unsupported"
              ? "ambiguous"
              : "no_candidate",
    confidence: correction.confidence,
    requires_confirmation: commands.length > 0,
    ambiguities:
      correction.kind === "needs_clarification" ||
      correction.kind === "unsupported" ||
      correction.kind === "no_candidate"
        ? [correction.safe_explanation]
        : [],
    safe_explanation:
      "safe_explanation" in correction
        ? correction.safe_explanation
        : "El mensaje no contiene una correccion financiera.",
    evidence_signals: commands.map(
      (command) => `candidate_movement_id=${command.movement_id}`
    ),
  };
}

function buildReferenceResolution(
  context: ConversationalExecutiveContextPack,
  correction: CorrectionAgentOutput
) {
  const focus =
    context.conversation_context.active_conversation_state.working_set
      ?.focus_set;
  const semantic = toSemanticCorrection(correction);
  const movementIds =
    semantic.candidate_movement_ids.length > 0
      ? semantic.candidate_movement_ids
      : focus?.subject === "movements"
        ? focus.ordered_ids
        : [];

  return {
    resolution:
      semantic.candidate_movement_ids.length > 0
        ? semantic.reference_resolution
        : focus
          ? ("focus_set" as const)
          : ("not_applicable" as const),
    focus_id: focus?.focus_id ?? null,
    candidate_movement_ids: movementIds,
    candidate_entity_ids:
      focus?.subject === "entities" ? focus.ordered_ids : [],
    visible_order_ids: focus?.ordered_ids ?? movementIds,
    confidence:
      semantic.candidate_movement_ids.length > 0
        ? semantic.confidence
        : focus
          ? 1
          : 0,
    ambiguities: semantic.ambiguities,
    evidence_refs: focus?.tool_provenance
      .map((provenance) => provenance.source_ref)
      .filter((value): value is string => Boolean(value)) ?? [],
  };
}

function composeNonReadOnlyResponse(
  goal: ConversationalExecutiveOutput["orchestration_plan"]["goal"],
  correction: CorrectionAgentOutput
): ConversationalAnswer {
  if (
    correction.kind !== "not_correction" &&
    "safe_explanation" in correction
  ) {
    return {
      response_text: correction.safe_explanation,
      answer_kind: "clarification",
      confidence: correction.confidence,
      cited_facts: [],
      used_tools: [],
      follow_up_question: null,
      safety_flags: ["requires_domain_validation"],
    };
  }

  return {
    response_text:
      goal === "record" || goal === "mixed"
        ? "Entendi la propuesta financiera. La politica y el Core deben validarla antes de afirmar que fue registrada."
        : "Entendi el turno. Voy a responder solo con el resultado validado por el dominio.",
    answer_kind: "clarification",
    confidence: 0.8,
    cited_facts: [],
    used_tools: [],
    follow_up_question: null,
    safety_flags: ["requires_domain_validation"],
  };
}

function isConversationToolResult(
  value: unknown
): value is ConversationToolResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      "tool_name" in value &&
      "status" in value
  );
}
