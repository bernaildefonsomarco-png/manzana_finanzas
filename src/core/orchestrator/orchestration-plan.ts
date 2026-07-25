import type {
  ConversationQuery,
  ConversationStyleProfile,
  ConversationTurnState,
  ConversationToolName,
  ConversationWorkingSet,
} from "@/agents/conversation-agent/types";
import { defaultToolsForConversationQuery } from "@/agents/orchestration-planning-agent/types";
import type { OrchestrationPlan } from "@/agents/orchestration-planning-agent/types";

export type OrchestrationRoute =
  "data_agent" | "conversation_agent" | "correction_agent" | "support";

export type CompiledConversationStyleUpdate = ConversationStyleProfile;

export type CompiledOrchestrationPlan = {
  goal: OrchestrationPlan["goal"];
  workflow: OrchestrationPlan["workflow"];
  route: OrchestrationRoute;
  conversationQuery: ConversationQuery;
  conversationTurnState: ConversationTurnState;
  selectedTools: ConversationToolName[];
  pendingOperationResolution: OrchestrationPlan["pending_operation_resolution"];
  financialResolution: OrchestrationPlan["financial_resolution"];
  styleUpdate: CompiledConversationStyleUpdate | null;
  resetStyle: boolean;
  runConversationAfterFinancialAction: boolean;
  requiresConfirmation: boolean;
  responseStrategy: OrchestrationPlan["response_strategy"];
  riskFlags: string[];
  confidence: number;
  rejectedStepCount: number;
};

const MAX_PLANNED_TOOLS = 4;

export function compileOrchestrationPlan(input: {
  plan: OrchestrationPlan;
  fallbackQuery: ConversationQuery;
  fallbackTurnState: ConversationTurnState;
  workingSet?: ConversationWorkingSet | null;
  receivedAt: string;
}): CompiledOrchestrationPlan {
  const pendingQuery = input.workingSet?.active_read_operation?.query ?? null;
  const semanticQuery = validateSemanticQuery(input.plan.semantic_query);
  const conversationQuery =
    input.plan.pending_operation_resolution === "execute" && pendingQuery
      ? pendingQuery
      : semanticQuery ?? fallbackConversationQuery(input);
  const conversationTurnState = input.plan.semantic_turn;
  const styleUpdate = compileStyleUpdate(input.plan.style_update, input.receivedAt);
  const financialResolution = compileFinancialResolution(
    input.plan.financial_resolution,
  );
  const hasPendingQuery = Boolean(pendingQuery);
  const route = routeForPlan(input.plan, hasPendingQuery);
  const selectedTools = selectAuthorizedTools({
    goal:
      route === "conversation_agent" && input.plan.goal === "confirmation"
        ? "query"
        : input.plan.goal,
    requested: input.plan.selected_tools,
    query: conversationQuery,
  });
  const rejectedStepCount = input.plan.steps.filter(
    (step) => !isStepAllowedForGoal(step.capability, input.plan.goal),
  ).length;
  const confirmationEnforced =
    input.plan.goal === "correction" && !input.plan.requires_confirmation;

  return {
    goal: input.plan.goal,
    workflow: input.plan.workflow,
    route,
    conversationQuery,
    conversationTurnState,
    selectedTools,
    pendingOperationResolution: input.plan.pending_operation_resolution,
    financialResolution,
    styleUpdate,
    resetStyle: input.plan.style_update?.operation === "reset",
    runConversationAfterFinancialAction: input.plan.goal === "mixed",
    requiresConfirmation:
      input.plan.requires_confirmation || input.plan.goal === "correction",
    responseStrategy: input.plan.response_strategy,
    riskFlags: [
      ...new Set([
        ...input.plan.risk_flags,
        ...(input.plan.financial_resolution.action !== "none" &&
        financialResolution.action === "none"
          ? ["financial_resolution_rejected_by_compiler"]
          : []),
        ...(confirmationEnforced ? ["confirmation_enforced_by_compiler"] : []),
      ]),
    ].slice(0, 8),
    confidence: input.plan.confidence,
    rejectedStepCount,
  };
}

function compileFinancialResolution(
  resolution: OrchestrationPlan["financial_resolution"],
): OrchestrationPlan["financial_resolution"] {
  const empty: OrchestrationPlan["financial_resolution"] = {
    action: "none",
    target: "none",
    pending_code: null,
    account_origin_id: null,
    account_destination_id: null,
    category_id: null,
    learn_account_aliases: false,
    confidence: resolution.confidence,
  };

  if (resolution.action === "none") return empty;
  if (resolution.confidence < 0.65) return empty;
  if (resolution.target === "none") return empty;
  if (resolution.target === "capture_draft" && resolution.pending_code) {
    return empty;
  }
  if (resolution.action === "list" && resolution.target !== "pending_item") {
    return empty;
  }
  if (
    ["review", "assign_transfer", "classify_expense", "classify_income"].includes(
      resolution.action,
    ) &&
    resolution.target !== "pending_item"
  ) {
    return empty;
  }
  if (
    resolution.target === "capture_draft" &&
    !["confirm", "discard"].includes(resolution.action)
  ) {
    return empty;
  }

  return resolution;
}

export function reconcileCompiledOrchestrationPlan(input: {
  compiled: CompiledOrchestrationPlan;
  proposedActionCount: number;
  turnState: ConversationTurnState;
}): CompiledOrchestrationPlan {
  if (input.proposedActionCount === 0) return input.compiled;

  const hasSemanticReadOnlyFollowUp =
    input.compiled.goal === "query" ||
    input.compiled.goal === "mixed" ||
    (input.compiled.goal === "record" &&
      input.turnState.should_route_to_conversation_agent &&
      input.compiled.conversationQuery.kind !== "unsupported");

  if (!hasSemanticReadOnlyFollowUp) return input.compiled;

  const selectedTools =
    input.compiled.selectedTools.length > 0
      ? input.compiled.selectedTools
      : defaultToolsForConversationQuery(
          input.compiled.conversationQuery.kind,
        ).slice(0, MAX_PLANNED_TOOLS);

  if (selectedTools.length === 0) return input.compiled;

  const reconciliationFlag =
    input.compiled.goal === "mixed"
      ? null
      : `goal_reconciled_${input.compiled.goal}_to_mixed`;

  return {
    ...input.compiled,
    goal: "mixed",
    workflow: "mixed_capture_and_query",
    route: "data_agent",
    selectedTools,
    runConversationAfterFinancialAction: true,
    responseStrategy: "mixed",
    riskFlags: [
      ...new Set([
        ...input.compiled.riskFlags,
        ...(reconciliationFlag ? [reconciliationFlag] : []),
      ]),
    ].slice(0, 8),
  };
}

function routeForGoal(goal: OrchestrationPlan["goal"]): OrchestrationRoute {
  if (goal === "query" || goal === "help" || goal === "review") {
    return "conversation_agent";
  }
  if (goal === "correction") return "correction_agent";
  if (goal === "record" || goal === "mixed") return "data_agent";
  return "support";
}

function routeForPlan(
  plan: OrchestrationPlan,
  hasPendingQuery: boolean,
): OrchestrationRoute {
  if (
    plan.goal === "confirmation" &&
    plan.pending_operation_resolution === "execute" &&
    hasPendingQuery
  ) {
    return "conversation_agent";
  }

  return routeForGoal(plan.goal);
}

function fallbackConversationQuery(input: {
  plan: OrchestrationPlan;
  fallbackQuery: ConversationQuery;
}): ConversationQuery {
  const queryKind =
    input.plan.conversation_query_kind ?? input.fallbackQuery.kind;
  return {
    ...input.fallbackQuery,
    kind: queryKind,
    confidence: Math.min(
      1,
      Math.max(input.fallbackQuery.confidence, input.plan.confidence),
    ),
  };
}

function validateSemanticQuery(
  query: OrchestrationPlan["semantic_query"],
): ConversationQuery | null {
  if (!query) return null;
  const semanticQuery: ConversationQuery = {
    ...query,
    movement_filters:
      query.kind === "movement_search"
        ? normalizeMovementFilters(query.movement_filters)
        : null,
  };
  if (!semanticQuery.date_range) return semanticQuery;

  const start = Date.parse(semanticQuery.date_range.start);
  const end = Date.parse(semanticQuery.date_range.end);
  const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    end - start > maxRangeMs
  ) {
    return {
      ...semanticQuery,
      date_range: null,
      confidence: Math.min(semanticQuery.confidence, 0.5),
    };
  }

  return {
    ...semanticQuery,
    date_range: {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      label: semanticQuery.date_range.label.trim().slice(0, 120),
    },
  };
}

function normalizeMovementFilters(
  filters: ConversationQuery["movement_filters"],
): NonNullable<ConversationQuery["movement_filters"]> {
  return {
    search_terms: uniqueNormalizedStrings(filters?.search_terms ?? []),
    movement_types: [...new Set(filters?.movement_types ?? [])],
    category_ids: [...new Set(filters?.category_ids ?? [])],
    sources: [...new Set(filters?.sources ?? [])],
    account_terms: uniqueNormalizedStrings(filters?.account_terms ?? []).slice(
      0,
      8,
    ),
    subcategory_terms: uniqueNormalizedStrings(filters?.subcategory_terms ?? []).slice(
      0,
      8,
    ),
    person_terms: uniqueNormalizedStrings(filters?.person_terms ?? []).slice(0, 8),
    tag_terms: uniqueNormalizedStrings(filters?.tag_terms ?? []).slice(0, 8),
    uncategorized_only: filters?.uncategorized_only ?? false,
  };
}

function uniqueNormalizedStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(
    0,
    12,
  );
}

function compileStyleUpdate(
  update: OrchestrationPlan["style_update"],
  receivedAt: string,
): CompiledConversationStyleUpdate | null {
  if (!update || update.operation !== "set" || !update.instruction) return null;
  return {
    instruction: update.instruction,
    response_length: update.response_length,
    formality: update.formality,
    warmth: update.warmth,
    playfulness: update.playfulness,
    directness: update.directness,
    emoji_policy: update.emoji_policy,
    scope: update.scope,
    source: "explicit_user_request",
    updated_at: receivedAt,
  };
}

function selectAuthorizedTools(input: {
  goal: OrchestrationPlan["goal"];
  requested: ConversationToolName[];
  query: ConversationQuery;
}): ConversationToolName[] {
  if (input.goal !== "query" && input.goal !== "mixed") return [];

  const requested = [...new Set(input.requested)].slice(0, MAX_PLANNED_TOOLS);
  if (requested.length > 0) return requested;

  return defaultToolsForConversationQuery(input.query.kind).slice(
    0,
    MAX_PLANNED_TOOLS,
  );
}

function isStepAllowedForGoal(
  capability: OrchestrationPlan["steps"][number]["capability"],
  goal: OrchestrationPlan["goal"],
) {
  if (capability === "command_dispatcher") {
    return goal === "record" || goal === "mixed" || goal === "correction";
  }

  if (capability === "correction_agent") return goal === "correction";

  if (capability === "data_agent") {
    return goal === "record" || goal === "mixed" || goal === "correction";
  }

  if (capability === "conversation_agent") {
    return (
      goal === "query" ||
      goal === "mixed" ||
      goal === "help" ||
      goal === "review"
    );
  }

  return true;
}
