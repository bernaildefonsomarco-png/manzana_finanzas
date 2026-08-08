import type {
  ConversationalAnswer,
  ConversationContextPack,
  ConversationFocusSet,
  ConversationQuery,
  ConversationReferencedMovement,
  ConversationStyleProfile,
  ConversationToolName,
  ConversationWorkingSet,
} from "@/agents/conversation-agent";
import { CORRECTION_CONFIRMATION_TTL_MS } from "@/core/orchestrator/correction-resolution";
import type { CompiledOrchestrationPlan } from "@/core/orchestrator/orchestration-plan";
import {
  type ConversationMemoryState,
  upsertConversationMemoryState,
  type ConversationMemoryChannel,
} from "@/data/repositories/conversation-memory.repository";
import type { Database } from "@/data/supabase/types";
import type { Movement } from "@/shared/types/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;
const FOCUS_SET_TTL_MS = 2 * 60 * 60 * 1000;

export function movementToConversationReference(
  movement: Movement
): ConversationReferencedMovement {
  return {
    id: movement.id,
    type: movement.type,
    amount: Number(movement.amount),
    currency: movement.currency,
    description: movement.description,
    merchant: movement.merchant,
    category_id: movement.category_id,
    occurred_at: movement.occurred_at,
    source: movement.source,
    source_ref: movement.source_ref,
    account_origin_id: movement.account_origin_id,
    account_destination_id: movement.account_destination_id,
    confidence: movement.confidence,
    requires_review: movement.requires_review,
  };
}

export async function rememberConversationTurn(input: {
  client: Client;
  channel: ConversationMemoryChannel;
  contextPack: ConversationContextPack;
  answer: ConversationalAnswer;
  sourceRef?: string | null;
  traceId?: string | null;
  /** Hilo del turno (`resolveTurnThreadKey`). Sin el, escribe en el estado heredado. */
  threadKey?: string;
}) {
  if (input.answer.answer_kind === "unsupported") return null;

  const toolName =
    input.contextPack.tool_results.find((tool) => tool.status === "called")
      ?.tool_name ?? null;
  const referencedMovements = extractReferencedMovements(input.contextPack);
  const referencedEntities = extractReferencedEntities(input.contextPack);
  const focusSet = buildConversationFocusSet({
    contextPack: input.contextPack,
    referencedEntities,
    previous: input.contextPack.active_conversation_state.working_set?.focus_set,
    sourceRef: input.sourceRef ?? null,
    traceId: input.traceId ?? null,
  });

  return upsertConversationMemoryState(input.client, {
    userId: input.contextPack.user_id,
    channel: input.channel,
    threadKey: input.threadKey,
    lastIntent: input.contextPack.query.kind,
    lastQueryKind: input.contextPack.query.kind,
    lastQueryText: input.contextPack.query.normalized_text,
    lastQueryDateRange: input.contextPack.query.date_range,
    lastToolName: toolName,
    lastResultSummary: summarizeAnswer(input.answer.response_text),
    referencedMovements,
    referencedEntities,
    continuityHint: buildContinuityHint(
      input.contextPack,
      referencedMovements,
      referencedEntities
    ),
    sourceRef: input.sourceRef ?? null,
    metadata: {
      answer_kind: input.answer.answer_kind,
      confidence: input.answer.confidence,
      used_tools: input.answer.used_tools,
      turn_state: input.contextPack.turn_state,
      working_set: buildConversationWorkingSet({
        previous: input.contextPack.active_conversation_state.working_set,
        threadKey: input.threadKey ?? null,
        now: input.contextPack.received_at,
        topic: topicForQuery(input.contextPack.query.kind),
        goal: "query",
        userMessage: input.contextPack.original_message,
        resultSummary: summarizeAnswer(input.answer.response_text),
        sourceRef: input.sourceRef ?? null,
        movementIds: referencedMovements.map((movement) => movement.id),
        entityIds: extractEntityIds(referencedEntities),
        actionKind:
          input.answer.answer_kind === "clarification"
            ? "clarification_requested"
            : "query_answered",
        actionStatus:
          input.answer.answer_kind === "clarification"
            ? "awaiting_confirmation"
            : "completed",
        unresolvedSlots: input.answer.follow_up_question
          ? [input.answer.follow_up_question]
          : [],
        activeReadOperation: buildCompletedReadOperation({
          previous: input.contextPack.active_conversation_state.working_set,
          query: input.contextPack.query,
          selectedTools: input.contextPack.tool_results
            .filter((tool) => tool.status === "called")
            .map((tool) => tool.tool_name)
            .filter(isConversationToolName),
          status:
            input.answer.answer_kind === "clarification"
              ? "awaiting_clarification"
              : "completed",
          missingSlots: input.answer.follow_up_question
            ? [input.answer.follow_up_question]
            : [],
          now: input.contextPack.received_at,
          sourceRef: input.sourceRef ?? null,
        }),
        focusSet,
      }),
    },
  });
}

export type ConversationOutcomeAction = NonNullable<
  ConversationWorkingSet["last_action"]
>["kind"];

export async function rememberConversationOutcome(input: {
  client: Client;
  userId: string;
  channel: ConversationMemoryChannel;
  /** Hilo del turno (`resolveTurnThreadKey`). Sin el, escribe en el estado heredado. */
  threadKey?: string;
  intent: string;
  userMessage: string;
  resultSummary: string;
  sourceRef?: string | null;
  topic: ConversationWorkingSet["topic"];
  goal: ConversationWorkingSet["goal"];
  actionKind: ConversationOutcomeAction;
  actionStatus: NonNullable<
    ConversationWorkingSet["last_action"]
  >["status"];
  movements?: ConversationReferencedMovement[];
  entities?: Array<Record<string, unknown>>;
  pendingItemIds?: string[];
  commandIds?: string[];
  unresolvedSlots?: string[];
  continuityHint?: string | null;
  previous?: ConversationWorkingSet | null;
  now?: string;
}) {
  const movements = (input.movements ?? []).slice(0, 10);
  const entities = (input.entities ?? []).slice(0, 20);
  const resultSummary = summarizeAnswer(input.resultSummary);
  const now = input.now ?? new Date().toISOString();
  const focusSet = buildOutcomeFocusSet({
    movements,
    entities,
    previous: input.previous?.focus_set,
    sourceRef: input.sourceRef ?? null,
    now,
  });
  const workingSet = buildConversationWorkingSet({
    previous: input.previous ?? null,
    threadKey: input.threadKey ?? null,
    topic: input.topic,
    goal: input.goal,
    userMessage: input.userMessage,
    resultSummary,
    sourceRef: input.sourceRef ?? null,
    movementIds: movements.map((movement) => movement.id),
    entityIds: extractEntityIds(entities),
    pendingItemIds: input.pendingItemIds,
    commandIds: input.commandIds,
    actionKind: input.actionKind,
    actionStatus: input.actionStatus,
    unresolvedSlots: input.unresolvedSlots ?? [],
    focusSet,
    now,
  });

  return upsertConversationMemoryState(input.client, {
    userId: input.userId,
    channel: input.channel,
    threadKey: input.threadKey,
    lastIntent: input.intent,
    lastQueryKind: null,
    lastQueryText: summarizeAnswer(input.userMessage),
    lastQueryDateRange: null,
    lastToolName: null,
    lastResultSummary: resultSummary,
    referencedMovements: movements,
    referencedEntities: entities,
    continuityHint: input.continuityHint ?? null,
    sourceRef: input.sourceRef ?? null,
    metadata: { working_set: workingSet },
  });
}

export async function rememberConversationPlanningState(input: {
  client: Client;
  userId: string;
  channel: ConversationMemoryChannel;
  /** Hilo del turno (`resolveTurnThreadKey`). Sin el, escribe en el estado heredado. */
  threadKey?: string;
  userMessage: string;
  sourceRef?: string | null;
  compiled: CompiledOrchestrationPlan;
  previousState: ConversationMemoryState | null;
  now: string;
}): Promise<ConversationMemoryState | null> {
  const previousWorkingSet = input.previousState?.working_set ?? null;
  const persistedStyle = resolvePersistedStyle({
    previous: previousWorkingSet?.conversation_style ?? null,
    update: input.compiled.styleUpdate,
    reset: input.compiled.resetStyle,
  });
  const activeReadOperation = resolvePlannedReadOperation({
    compiled: input.compiled,
    previous: previousWorkingSet?.active_read_operation ?? null,
    now: input.now,
    sourceRef: input.sourceRef ?? null,
  });
  const workingSet: ConversationWorkingSet = {
    version: "v1",
    topic: topicForQuery(input.compiled.conversationQuery.kind),
    goal: goalForCompiledPlan(input.compiled),
    last_user_message_summary: summarizeAnswer(input.userMessage),
    last_assistant_result_summary:
      previousWorkingSet?.last_assistant_result_summary ??
      input.previousState?.last_result_summary ??
      null,
    last_action: previousWorkingSet?.last_action ?? null,
    unresolved_slots:
      activeReadOperation?.status === "awaiting_clarification"
        ? activeReadOperation.missing_slots
        : [],
    movement_referents: previousWorkingSet?.movement_referents ?? [],
    entity_referents: previousWorkingSet?.entity_referents ?? [],
    active_read_operation: activeReadOperation,
    focus_set: previousWorkingSet?.focus_set ?? null,
    conversation_style: persistedStyle,
    updated_at: input.now,
  };

  return upsertConversationMemoryState(input.client, {
    userId: input.userId,
    channel: input.channel,
    threadKey: input.threadKey,
    lastIntent: input.compiled.goal,
    lastQueryKind:
      input.compiled.conversationQuery.kind === "unsupported"
        ? input.previousState?.last_query_kind ?? null
        : input.compiled.conversationQuery.kind,
    lastQueryText: summarizeAnswer(input.userMessage),
    lastQueryDateRange:
      input.compiled.conversationQuery.date_range ??
      input.previousState?.last_query_date_range ??
      null,
    lastToolName: input.previousState?.last_tool_name ?? null,
    lastResultSummary: input.previousState?.last_result_summary ?? null,
    referencedMovements: input.previousState?.referenced_movements ?? [],
    referencedEntities: input.previousState?.referenced_entities ?? [],
    continuityHint: input.previousState?.continuity_hint ?? null,
    sourceRef: input.sourceRef ?? null,
    metadata: {
      ...(input.previousState?.metadata ?? {}),
      working_set: workingSet,
      semantic_turn: input.compiled.conversationTurnState,
    },
  });
}

/**
 * Caduca la propuesta de correccion que quedo esperando confirmacion
 * (`23` §5b.1: "15 minutos, o al cambiar de tema").
 *
 * Devuelve el mismo working set si no habia nada que caducar, para que el
 * llamador pueda usar el resultado siempre.
 */
export function withExpiredCorrectionProposal(
  workingSet: ConversationWorkingSet | null,
  now: string,
): ConversationWorkingSet | null {
  const lastAction = workingSet?.last_action ?? null;
  if (
    !workingSet ||
    !lastAction ||
    lastAction.kind !== "correction_proposed" ||
    lastAction.status !== "awaiting_confirmation"
  ) {
    return workingSet;
  }

  return {
    ...workingSet,
    last_action: {
      ...lastAction,
      status: "expired",
      // Sin comandos no queda nada que un "si" posterior pueda disparar, ni
      // aunque la escritura de abajo falle en otro turno.
      command_ids: [],
      confirmation_expires_at: null,
    },
    updated_at: now,
  };
}

/**
 * Persiste esa caducidad sin tocar el resto del estado: no es una respuesta
 * del asistente ni un turno nuevo, solo la propuesta que dejo de valer.
 */
export async function rememberExpiredCorrectionProposal(input: {
  client: Client;
  userId: string;
  channel: ConversationMemoryChannel;
  threadKey?: string;
  previousState: ConversationMemoryState | null;
  now: string;
}): Promise<ConversationMemoryState | null> {
  const workingSet = withExpiredCorrectionProposal(
    input.previousState?.working_set ?? null,
    input.now,
  );
  if (!workingSet) return input.previousState;

  return upsertConversationMemoryState(input.client, {
    userId: input.userId,
    channel: input.channel,
    threadKey: input.threadKey,
    lastIntent: input.previousState?.last_intent ?? null,
    lastQueryKind: input.previousState?.last_query_kind ?? null,
    lastQueryText: input.previousState?.last_query_text ?? null,
    lastQueryDateRange: input.previousState?.last_query_date_range ?? null,
    lastToolName: input.previousState?.last_tool_name ?? null,
    lastResultSummary: input.previousState?.last_result_summary ?? null,
    referencedMovements: input.previousState?.referenced_movements ?? [],
    referencedEntities: input.previousState?.referenced_entities ?? [],
    continuityHint: input.previousState?.continuity_hint ?? null,
    sourceRef: input.previousState?.source_ref ?? null,
    expiresAt: input.previousState?.expires_at,
    metadata: {
      ...(input.previousState?.metadata ?? {}),
      working_set: workingSet,
    },
  });
}

function buildConversationWorkingSet(input: {
  previous: ConversationWorkingSet | null;
  /** Hilo dueño de la accion; `null` mientras la superficie no tenga hilo. */
  threadKey?: string | null;
  topic: ConversationWorkingSet["topic"];
  goal: ConversationWorkingSet["goal"];
  userMessage: string;
  resultSummary: string;
  sourceRef: string | null;
  movementIds: string[];
  entityIds: string[];
  pendingItemIds?: string[];
  commandIds?: string[];
  actionKind: ConversationOutcomeAction;
  actionStatus: NonNullable<
    ConversationWorkingSet["last_action"]
  >["status"];
  unresolvedSlots: string[];
  activeReadOperation?: ConversationWorkingSet["active_read_operation"];
  focusSet?: ConversationFocusSet | null;
  now?: string;
}): ConversationWorkingSet {
  const now = input.now ?? new Date().toISOString();
  return {
    version: "v1",
    topic: input.topic,
    goal: input.goal,
    last_user_message_summary: summarizeAnswer(input.userMessage),
    last_assistant_result_summary: input.resultSummary,
    last_action: {
      kind: input.actionKind,
      status: input.actionStatus,
      source_ref: input.sourceRef,
      movement_ids: input.movementIds.slice(0, 10),
      pending_item_ids: (input.pendingItemIds ?? []).slice(0, 10),
      command_ids: (input.commandIds ?? []).slice(0, 5),
      // El sello de hilo y la vigencia son lo que impide que un "si" de otra
      // conversacion —o de dentro de dos horas— ejecute esta accion
      // (`23` §5b.1, `AC-RT-13`).
      thread_key: input.threadKey ?? null,
      confirmation_expires_at:
        input.actionStatus === "awaiting_confirmation"
          ? new Date(
              Date.parse(now) + CORRECTION_CONFIRMATION_TTL_MS,
            ).toISOString()
          : null,
    },
    unresolved_slots: input.unresolvedSlots.slice(0, 10),
    movement_referents:
      input.movementIds.length > 0
        ? input.movementIds.slice(0, 10)
        : (input.previous?.movement_referents ?? []).slice(0, 10),
    entity_referents:
      input.entityIds.length > 0
        ? input.entityIds.slice(0, 20)
        : (input.previous?.entity_referents ?? []).slice(0, 20),
    active_read_operation:
      input.activeReadOperation ??
      input.previous?.active_read_operation ??
      null,
    focus_set: input.focusSet ?? input.previous?.focus_set ?? null,
    conversation_style: input.previous?.conversation_style ?? null,
    updated_at: now,
  };
}

function resolvePersistedStyle(input: {
  previous: ConversationStyleProfile | null;
  update: ConversationStyleProfile | null;
  reset: boolean;
}): ConversationStyleProfile | null {
  if (input.reset) return null;
  if (!input.update || input.update.scope === "turn") return input.previous;
  return input.update;
}

function resolvePlannedReadOperation(input: {
  compiled: CompiledOrchestrationPlan;
  previous: ConversationWorkingSet["active_read_operation"];
  now: string;
  sourceRef: string | null;
}): ConversationWorkingSet["active_read_operation"] {
  if (input.compiled.pendingOperationResolution === "cancel") {
    return input.previous
      ? { ...input.previous, status: "cancelled", updated_at: input.now }
      : null;
  }

  if (
    input.compiled.route !== "conversation_agent" ||
    input.compiled.conversationQuery.kind === "unsupported"
  ) {
    return input.previous;
  }

  if (
    input.compiled.pendingOperationResolution === "execute" &&
    input.previous
  ) {
    return { ...input.previous, status: "ready", updated_at: input.now };
  }

  const missingSlots = input.compiled.conversationTurnState
    .should_ask_clarification_first
    ? ["Falta precisar un dato para ejecutar la consulta read-only."]
    : [];
  return {
    operation_id: `read:${input.sourceRef ?? input.now}`,
    query: input.compiled.conversationQuery,
    selected_tools: input.compiled.selectedTools,
    status: missingSlots.length > 0 ? "awaiting_clarification" : "ready",
    missing_slots: missingSlots,
    created_at: input.now,
    updated_at: input.now,
  };
}

function buildCompletedReadOperation(input: {
  previous: ConversationWorkingSet | null;
  query: ConversationQuery;
  selectedTools: ConversationToolName[];
  status: "completed" | "awaiting_clarification";
  missingSlots: string[];
  now: string;
  sourceRef: string | null;
}): ConversationWorkingSet["active_read_operation"] {
  const previous = input.previous?.active_read_operation;
  return {
    operation_id: previous?.operation_id ?? `read:${input.sourceRef ?? input.now}`,
    query: input.query,
    selected_tools:
      input.selectedTools.length > 0
        ? input.selectedTools
        : previous?.selected_tools ?? [],
    status: input.status,
    missing_slots: input.missingSlots,
    created_at: previous?.created_at ?? input.now,
    updated_at: input.now,
  };
}

function buildConversationFocusSet(input: {
  contextPack: ConversationContextPack;
  referencedEntities: Array<Record<string, unknown>>;
  previous: ConversationFocusSet | null | undefined;
  sourceRef: string | null;
  traceId: string | null;
}): ConversationFocusSet | null {
  const movementTool = input.contextPack.tool_results.find(
    (tool) => tool.tool_name === "query_movements" && tool.status === "called"
  );
  const movementIds = readRecordArray(movementTool?.data.movements)
    .map((movement) => movement.id)
    .filter((id): id is string => typeof id === "string")
    .slice(0, 80);
  const entityIds = extractEntityIds(input.referencedEntities);
  const subject = movementTool
    ? ("movements" as const)
    : entityIds.length > 0
      ? ("entities" as const)
      : null;

  if (!subject) return input.previous ?? null;

  const orderedIds = subject === "movements" ? movementIds : entityIds;
  const now = input.contextPack.received_at;
  const expiresAt = addMilliseconds(now, FOCUS_SET_TTL_MS);
  const relevantTools = input.contextPack.tool_results.filter(
    (tool) =>
      tool.status === "called" &&
      (tool.tool_name === "query_movements" ||
        tool.tool_name === "get_debt_summary" ||
        tool.tool_name === "get_debt_details" ||
        tool.tool_name === "get_recurring_summary")
  );
  const toolProvenance = relevantTools
    .map((tool) => ({
      tool_name: tool.tool_name,
      trace_id: input.traceId,
      source_ref: input.sourceRef,
      executed_at: now,
      result_count:
        tool.tool_name === "query_movements"
          ? movementIds.length
          : entityIds.length,
      result_hash: hashFocusValue({
        tool_name: tool.tool_name,
        ordered_ids: orderedIds,
        facts: tool.facts,
      }),
    }))
    .filter(
      (
        provenance
      ): provenance is ConversationFocusSet["tool_provenance"][number] =>
        isConversationToolName(provenance.tool_name)
    )
    .slice(0, 8);
  const slotProvenance: ConversationFocusSet["slot_provenance"] = [
    {
      slot: "ordered_ids",
      value: orderedIds,
      source: "tool_result",
      confidence: 1,
      confirmed_at: now,
      evidence_ref: input.sourceRef,
    },
  ];

  if (input.contextPack.query.date_range) {
    slotProvenance.push({
      slot: "date_range",
      value: input.contextPack.query.date_range,
      source: "explicit_user_message",
      confidence: input.contextPack.query.confidence,
      confirmed_at: now,
      evidence_ref: input.sourceRef,
    });
  }

  if (input.contextPack.query.movement_filters) {
    slotProvenance.push({
      slot: "movement_filters",
      value: input.contextPack.query.movement_filters,
      source: "explicit_user_message",
      confidence: input.contextPack.query.confidence,
      confirmed_at: now,
      evidence_ref: input.sourceRef,
    });
  }

  const stateHash = hashFocusValue({
    subject,
    ordered_ids: orderedIds,
    query: input.contextPack.query,
    tool_provenance: toolProvenance,
  });

  return {
    version: "v1",
    revision: (input.previous?.revision ?? 0) + 1,
    focus_id: `focus:${input.sourceRef ?? input.traceId ?? stateHash}`,
    subject,
    ordered_ids: orderedIds,
    visible_order: "tool_result_order",
    query: input.contextPack.query,
    tool_provenance: toolProvenance,
    slot_provenance: slotProvenance,
    state_hash: stateHash,
    created_at: now,
    updated_at: now,
    expires_at: expiresAt,
  };
}

function buildOutcomeFocusSet(input: {
  movements: ConversationReferencedMovement[];
  entities: Array<Record<string, unknown>>;
  previous: ConversationFocusSet | null | undefined;
  sourceRef: string | null;
  now: string;
}): ConversationFocusSet | null {
  const movementIds = input.movements.map((movement) => movement.id).slice(0, 80);
  const entityIds = extractEntityIds(input.entities);
  const subject =
    movementIds.length > 0
      ? ("movements" as const)
      : entityIds.length > 0
        ? ("entities" as const)
        : null;
  if (!subject) return input.previous ?? null;

  const orderedIds = subject === "movements" ? movementIds : entityIds;
  const query: ConversationQuery = {
    kind: subject === "movements" ? "movement_search" : "unsupported",
    normalized_text: "resultado financiero confirmado del turno anterior",
    requested_amount: null,
    date_range: null,
    movement_filters: null,
    confidence: 1,
  };
  const stateHash = hashFocusValue({
    subject,
    ordered_ids: orderedIds,
    source_ref: input.sourceRef,
  });

  return {
    version: "v1",
    revision: (input.previous?.revision ?? 0) + 1,
    focus_id: `focus:${input.sourceRef ?? stateHash}`,
    subject,
    ordered_ids: orderedIds,
    visible_order: "tool_result_order",
    query,
    tool_provenance: [],
    slot_provenance: [
      {
        slot: "ordered_ids",
        value: orderedIds,
        source: "core_confirmed",
        confidence: 1,
        confirmed_at: input.now,
        evidence_ref: input.sourceRef,
      },
    ],
    state_hash: stateHash,
    created_at: input.now,
    updated_at: input.now,
    expires_at: addMilliseconds(input.now, FOCUS_SET_TTL_MS),
  };
}

function addMilliseconds(value: string, milliseconds: number): string {
  const timestamp = Date.parse(value);
  return new Date(
    (Number.isFinite(timestamp) ? timestamp : Date.now()) + milliseconds
  ).toISOString();
}

function hashFocusValue(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function goalForCompiledPlan(
  compiled: CompiledOrchestrationPlan,
): ConversationWorkingSet["goal"] {
  if (compiled.goal === "record" || compiled.goal === "mixed") return "capture";
  if (compiled.goal === "correction") return "correct";
  if (compiled.goal === "confirmation") return "confirm";
  if (compiled.goal === "review") return "review";
  if (compiled.goal === "help") return "help";
  return "query";
}

function isConversationToolName(value: string): value is ConversationToolName {
  return (
    value === "get_balance_snapshot" ||
    value === "query_movements" ||
    value === "get_pending_summary" ||
    value === "get_debt_summary" ||
    value === "get_debt_details" ||
    value === "get_recurring_summary" ||
    value === "search_financial_memory"
  );
}

function topicForQuery(
  kind: ConversationContextPack["query"]["kind"]
): ConversationWorkingSet["topic"] {
  if (kind === "movement_search") return "movement";
  if (kind === "balance_snapshot") return "balance";
  if (kind === "pending_summary") return "pending";
  if (kind === "debt_summary") return "debt";
  if (kind === "recurring_summary") return "recurring";
  if (kind === "financial_memory_search") return "memory";
  return "support";
}

function extractEntityIds(entities: Array<Record<string, unknown>>): string[] {
  return entities
    .map((entity) => entity.id)
    .filter((id): id is string => typeof id === "string")
    .slice(0, 20);
}

function extractReferencedMovements(
  contextPack: ConversationContextPack
): ConversationReferencedMovement[] {
  const movementTool = contextPack.tool_results.find(
    (tool) => tool.tool_name === "query_movements" && tool.status === "called"
  );
  const movements = (movementTool?.data.movements ?? []) as Array<
    Partial<ConversationReferencedMovement>
  >;

  return movements
    .filter((movement) => typeof movement.id === "string")
    .slice(0, 10)
    .map((movement) => ({
      id: String(movement.id),
      type: typeof movement.type === "string" ? movement.type : "movimiento",
      amount: typeof movement.amount === "number" ? movement.amount : 0,
      currency: movement.currency === "USD" ? "USD" : "PEN",
      description:
        typeof movement.description === "string" ? movement.description : null,
      merchant: typeof movement.merchant === "string" ? movement.merchant : null,
      category_id:
        typeof movement.category_id === "string" ? movement.category_id : null,
      category_label:
        typeof movement.category_label === "string"
          ? movement.category_label
          : null,
      occurred_at:
        typeof movement.occurred_at === "string" ? movement.occurred_at : null,
      source: typeof movement.source === "string" ? movement.source : null,
      source_ref:
        typeof movement.source_ref === "string" ? movement.source_ref : null,
      account_origin_id:
        typeof movement.account_origin_id === "string"
          ? movement.account_origin_id
          : null,
      account_origin_name:
        typeof movement.account_origin_name === "string"
          ? movement.account_origin_name
          : null,
      account_destination_id:
        typeof movement.account_destination_id === "string"
          ? movement.account_destination_id
          : null,
      account_destination_name:
        typeof movement.account_destination_name === "string"
          ? movement.account_destination_name
          : null,
      confidence:
        typeof movement.confidence === "number" ? movement.confidence : null,
      requires_review: movement.requires_review === true,
    }));
}

function extractReferencedEntities(
  contextPack: ConversationContextPack
): Array<Record<string, unknown>> {
  const entities: Array<Record<string, unknown>> = [];

  for (const tool of contextPack.tool_results) {
    if (tool.status !== "called") continue;

    if (tool.tool_name === "get_debt_summary") {
      entities.push(
        ...readRecordArray(tool.data.debts).slice(0, 10),
        ...readRecordArray(tool.data.installments).slice(0, 10)
      );
    }

    if (tool.tool_name === "get_debt_details") {
      for (const detail of readRecordArray(tool.data.details).slice(0, 10)) {
        entities.push(detail);
        entities.push(...readRecordArray(detail.installments).slice(0, 10));
        entities.push(...readRecordArray(detail.payments).slice(0, 10));
      }
    }

    if (tool.tool_name === "get_recurring_summary") {
      entities.push(
        ...readRecordArray(tool.data.commitments).slice(0, 10),
        ...readRecordArray(tool.data.rules).slice(0, 10)
      );
    }

    if (tool.tool_name === "search_financial_memory") {
      entities.push(
        ...readRecordArray(
          (tool.data.active_conversation as Record<string, unknown> | null)
            ?.referenced_entities
        ).slice(0, 10)
      );
    }
  }

  return entities.slice(0, 20);
}

function readRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && !Array.isArray(item))
  );
}

function summarizeAnswer(answer: string): string {
  const normalized = answer.replace(/\s+/g, " ").trim();
  return normalized.length > 500 ? `${normalized.slice(0, 497)}...` : normalized;
}

function buildContinuityHint(
  contextPack: ConversationContextPack,
  referencedMovements: ConversationReferencedMovement[],
  referencedEntities: Array<Record<string, unknown>>
): string | null {
  if (contextPack.query.kind === "movement_search") {
    const label =
      contextPack.query.date_range?.label ??
      contextPack.active_conversation_state.last_query_date_range?.label ??
      "la ultima busqueda de movimientos";
    return referencedMovements.length > 0
      ? `El usuario puede referirse a ${referencedMovements.length} movimientos de ${label}.`
      : `El usuario pregunto por movimientos de ${label}, sin resultados confirmados.`;
  }

  if (contextPack.query.kind === "balance_snapshot") {
    return "El usuario puede hacer seguimiento sobre dinero libre, saldo, cajas o compromisos.";
  }

  if (contextPack.query.kind === "pending_summary") {
    return "El usuario puede hacer seguimiento sobre pendientes por revisar.";
  }

  if (contextPack.query.kind === "debt_summary") {
    return referencedEntities.length > 0
      ? `El usuario puede referirse a ${referencedEntities.length} deudas, cuotas o personas mencionadas.`
      : "El usuario pregunto por deudas, sin entidades activas encontradas.";
  }

  if (contextPack.query.kind === "recurring_summary") {
    return referencedEntities.length > 0
      ? `El usuario puede referirse a ${referencedEntities.length} pagos que vienen o recurrentes mencionados.`
      : "El usuario pregunto por pagos que vienen, sin compromisos activos encontrados.";
  }

  if (contextPack.query.kind === "financial_memory_search") {
    return "El usuario puede hacer seguimiento sobre preferencias, correcciones o contexto recordado.";
  }

  return null;
}
