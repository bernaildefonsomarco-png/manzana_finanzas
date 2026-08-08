import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  DataAgentOutputSchema,
  type DataAgentOutput,
} from "@/agents/data-agent";
import type { ConversationTurnState } from "@/agents/conversation-agent";
import {
  getActiveConversationMemoryState,
  upsertConversationMemoryState,
  type ConversationMemoryChannel,
  type ConversationMemoryState,
} from "@/data/repositories/conversation-memory.repository";
import type { Database } from "@/data/supabase/types";
import type { DataActionPlan } from "./data-action-policy";
import type { PendingResolutionResult } from "./pending-resolution-from-text";

type Client = SupabaseClient<Database>;

export const CAPTURE_DRAFT_SCOPE = "capture_draft";

const CAPTURE_DRAFT_TTL_MS = 30 * 60 * 1000;

const CaptureDraftReasonSchema = z.enum([
  "financial_capture_no_action",
  "financial_action_blocked",
]);
export type CaptureDraftReason = z.infer<typeof CaptureDraftReasonSchema>;

const CaptureDraftMetadataSchema = z.object({
  version: z.literal("v1"),
  reason: CaptureDraftReasonSchema,
  original_message: z.string().min(1),
  received_at: z.string().min(1),
  source_ref: z.string().nullable(),
  created_at: z.string().min(1),
  data_agent_output: z.unknown().nullable(),
  financial_plan: z
    .object({
      kind: z.string(),
      reason: z.string(),
      blocked_reasons: z.array(z.string()),
      proposed_actions_count: z.number(),
    })
    .nullable(),
});

export type CaptureDraftMemory = {
  state_id: string;
  reason: CaptureDraftReason;
  original_message: string;
  received_at: string;
  source_ref: string | null;
  created_at: string;
  data_agent_output: DataAgentOutput | null;
  financial_plan: {
    kind: string;
    reason: string;
    blocked_reasons: string[];
    proposed_actions_count: number;
  } | null;
};

export type CaptureDraftResolutionResult =
  | {
      kind: "not_applicable";
      reason: "pending_resolution_not_capture_draft_candidate";
      action: null;
      draft: null;
    }
  | {
      kind: "ready_to_replay";
      reason: "active_capture_draft_found";
      action: "confirm";
      draft: CaptureDraftMemory;
    }
  | {
      kind: "discarded";
      reason: "active_capture_draft_discarded";
      action: "discard";
      draft: CaptureDraftMemory;
    }
  | {
      kind: "needs_clarification";
      reason: "no_active_capture_draft" | "invalid_capture_draft";
      action: "confirm" | "discard";
      draft: CaptureDraftMemory | null;
    };

export async function rememberCaptureDraft(input: {
  client: Client;
  userId: string;
  channel: ConversationMemoryChannel;
  /**
   * Hilo del turno (`resolveTurnThreadKey`). Con la migracion `069` aplicada,
   * el borrador vive en su conversacion y no lo ve otra.
   */
  threadKey?: string;
  originalMessage: string;
  receivedAt: string;
  sourceRef: string | null;
  reason: CaptureDraftReason;
  dataAgentOutput: DataAgentOutput | null;
  financialActionPlan?: DataActionPlan | null;
  now?: Date;
}): Promise<ConversationMemoryState | null> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + CAPTURE_DRAFT_TTL_MS).toISOString();
  const metadata = buildCaptureDraftMetadata({
    reason: input.reason,
    originalMessage: input.originalMessage,
    receivedAt: input.receivedAt,
    sourceRef: input.sourceRef,
    dataAgentOutput: input.dataAgentOutput,
    financialActionPlan: input.financialActionPlan ?? null,
    now,
  });

  return upsertConversationMemoryState(input.client, {
    userId: input.userId,
    channel: input.channel,
    threadKey: input.threadKey,
    scope: CAPTURE_DRAFT_SCOPE,
    lastIntent: input.dataAgentOutput?.intent ?? "record_movement",
    lastQueryKind: null,
    lastQueryText: input.originalMessage,
    lastQueryDateRange: null,
    lastToolName: "data_agent",
    lastResultSummary: summarizeDraft(input.originalMessage, input.reason),
    referencedMovements: [],
    referencedEntities: [],
    continuityHint:
      "El usuario puede confirmar, descartar o completar este borrador de captura financiera reciente.",
    sourceRef: input.sourceRef,
    expiresAt,
    metadata: {
      capture_draft: metadata,
    },
  });
}

export async function clearCaptureDraftMemory(input: {
  client: Client;
  userId: string;
  channel: ConversationMemoryChannel;
  threadKey?: string;
  reason: "confirmed" | "discarded" | "superseded" | "expired_or_invalid";
  now?: Date;
}): Promise<ConversationMemoryState | null> {
  const now = input.now ?? new Date();

  return upsertConversationMemoryState(input.client, {
    userId: input.userId,
    channel: input.channel,
    threadKey: input.threadKey,
    scope: CAPTURE_DRAFT_SCOPE,
    lastIntent: null,
    lastQueryKind: null,
    lastQueryText: null,
    lastQueryDateRange: null,
    lastToolName: null,
    lastResultSummary: "Borrador de captura cerrado.",
    referencedMovements: [],
    referencedEntities: [],
    continuityHint: null,
    sourceRef: null,
    expiresAt: now.toISOString(),
    metadata: {
      capture_draft_cleared: {
        reason: input.reason,
        cleared_at: now.toISOString(),
      },
    },
  });
}

export async function getActiveCaptureDraftMemory(input: {
  client: Client;
  userId: string;
  channel: ConversationMemoryChannel;
  threadKey?: string;
  now?: string;
}): Promise<CaptureDraftMemory | null> {
  const state = await getActiveConversationMemoryState(input.client, {
    userId: input.userId,
    channel: input.channel,
    threadKey: input.threadKey,
    scope: CAPTURE_DRAFT_SCOPE,
    now: input.now,
  });

  return parseCaptureDraftFromMemoryState(state);
}

export async function resolveCaptureDraftFromNoActivePending(input: {
  client: Client;
  userId: string;
  channel: ConversationMemoryChannel;
  threadKey?: string;
  pendingResolution: PendingResolutionResult;
  now?: string;
}): Promise<CaptureDraftResolutionResult> {
  if (
    input.pendingResolution.kind !== "needs_clarification" ||
    input.pendingResolution.reason !== "no_active_pending" ||
    (input.pendingResolution.action !== "confirm" &&
      input.pendingResolution.action !== "discard")
  ) {
    return {
      kind: "not_applicable",
      reason: "pending_resolution_not_capture_draft_candidate",
      action: null,
      draft: null,
    };
  }

  const draft = await getActiveCaptureDraftMemory({
    client: input.client,
    userId: input.userId,
    channel: input.channel,
    threadKey: input.threadKey,
    now: input.now,
  });

  if (!draft) {
    return {
      kind: "needs_clarification",
      reason: "no_active_capture_draft",
      action: input.pendingResolution.action,
      draft: null,
    };
  }

  if (input.pendingResolution.action === "discard") {
    await clearCaptureDraftMemory({
      client: input.client,
      userId: input.userId,
      channel: input.channel,
      threadKey: input.threadKey,
      reason: "discarded",
      now: input.now ? new Date(input.now) : undefined,
    });

    return {
      kind: "discarded",
      reason: "active_capture_draft_discarded",
      action: "discard",
      draft,
    };
  }

  if (
    !draft.data_agent_output ||
    draft.data_agent_output.result.length === 0
  ) {
    return {
      kind: "needs_clarification",
      reason: "invalid_capture_draft",
      action: "confirm",
      draft,
    };
  }

  return {
    kind: "ready_to_replay",
    reason: "active_capture_draft_found",
    action: "confirm",
    draft,
  };
}

export function shouldRememberCaptureDraft(input: {
  turnState: ConversationTurnState;
  dataAgentOutput: DataAgentOutput;
  financialActionPlan: DataActionPlan;
}): CaptureDraftReason | null {
  if (input.turnState.act !== "financial_capture") return null;

  if (
    input.financialActionPlan.kind === "no_action" &&
    input.dataAgentOutput.result.length === 0
  ) {
    return "financial_capture_no_action";
  }

  if (
    input.financialActionPlan.kind === "blocked" &&
    input.dataAgentOutput.result.length > 0
  ) {
    return "financial_action_blocked";
  }

  return null;
}

export function getCaptureDraftMissingFacts(
  draft: Pick<CaptureDraftMemory, "data_agent_output">
): string[] {
  const output = draft.data_agent_output;
  if (!output) return ["financial_action"];

  const missing = new Set<string>();
  for (const action of output.result) {
    if (action.amount === null) missing.add("amount");
    if (action.description === null) missing.add("description");
    if (
      action.movement_type === "pago_deuda" &&
      !hasDebtReference(action.debt_hint) &&
      action.related_person_hint === null
    ) {
      missing.add("debt_reference");
    }
  }

  for (const ambiguity of output.ambiguities) {
    if (ambiguity.scope === "financial_action" || !ambiguity.scope) {
      missing.add(ambiguity.field);
    }
  }

  return Array.from(missing).slice(0, 8);
}

function hasDebtReference(
  hint: DataAgentOutput["result"][number]["debt_hint"]
): boolean {
  return Boolean(
    hint?.debt_id ||
      hint?.debt_name ||
      hint?.related_person_id ||
      hint?.person_name ||
      hint?.installment_id ||
      hint?.installment_number
  );
}

export function parseCaptureDraftFromMemoryState(
  state: ConversationMemoryState | null
): CaptureDraftMemory | null {
  if (!state) return null;
  const metadata = state.metadata.capture_draft;
  const parsed = CaptureDraftMetadataSchema.safeParse(metadata);
  if (!parsed.success) return null;

  let dataAgentOutput: DataAgentOutput | null = null;
  if (parsed.data.data_agent_output) {
    const output = DataAgentOutputSchema.safeParse(parsed.data.data_agent_output);
    if (!output.success) return null;
    dataAgentOutput = output.data;
  }

  return {
    state_id: state.id,
    reason: parsed.data.reason,
    original_message: parsed.data.original_message,
    received_at: parsed.data.received_at,
    source_ref: parsed.data.source_ref,
    created_at: parsed.data.created_at,
    data_agent_output: dataAgentOutput,
    financial_plan: parsed.data.financial_plan,
  };
}

function buildCaptureDraftMetadata(input: {
  reason: CaptureDraftReason;
  originalMessage: string;
  receivedAt: string;
  sourceRef: string | null;
  dataAgentOutput: DataAgentOutput | null;
  financialActionPlan: DataActionPlan | null;
  now: Date;
}): z.infer<typeof CaptureDraftMetadataSchema> {
  return {
    version: "v1",
    reason: input.reason,
    original_message: input.originalMessage,
    received_at: input.receivedAt,
    source_ref: input.sourceRef,
    created_at: input.now.toISOString(),
    data_agent_output: input.dataAgentOutput,
    financial_plan: input.financialActionPlan
      ? {
          kind: input.financialActionPlan.kind,
          reason: input.financialActionPlan.reason,
          blocked_reasons: Array.from(
            new Set(
              input.financialActionPlan.actions
                .filter((action) => action.decision === "blocked")
                .flatMap((action) => action.reasons)
            )
          ),
          proposed_actions_count: input.financialActionPlan.actions.length,
        }
      : null,
  };
}

function summarizeDraft(
  originalMessage: string,
  reason: CaptureDraftReason
): string {
  const text = originalMessage.replace(/\s+/g, " ").trim();
  const prefix =
    reason === "financial_action_blocked"
      ? "Borrador financiero bloqueado"
      : "Borrador financiero sin accion";
  const summary = text.length > 160 ? `${text.slice(0, 157)}...` : text;
  return `${prefix}: ${summary}`;
}
