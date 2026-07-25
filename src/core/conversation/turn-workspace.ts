import { createHash } from "node:crypto";

import type { ConversationContextPack } from "@/agents/conversation-agent/types";
import type { DataContextPack } from "@/agents/data-agent/types";
import type { OrchestrationPlanningContextPack } from "@/agents/orchestration-planning-agent/types";

export type TurnWorkspaceSlot = {
  name: string;
  required_for: string;
  value: unknown;
  source: "explicit" | "inherited" | "tool" | "default";
  confidence: number;
  confirmed_at: string | null;
  evidence_ref: string | null;
};

export type TurnWorkspace = {
  version: "v1";
  turn_id: string;
  user_id: string;
  channel: "whatsapp" | "dashboard";
  user_message: string;
  received_at: string;
  timezone: string;
  active_goal: string | null;
  focus_set: {
    focus_id: string;
    version: string;
    revision: number;
    kind: "movements" | "entities";
    ordered_refs: string[];
    visible_order_refs: string[];
    source_tool_call_ids: string[];
    filters: Record<string, unknown>;
    period: {
      start: string;
      end: string;
      label: string;
    } | null;
    state_hash: string;
    expires_at: string;
  } | null;
  unresolved_slots: TurnWorkspaceSlot[];
  pending_operation: {
    kind: "capture_draft" | "pending_item" | "domain_action";
    target_ref: string | null;
    confirmable: boolean;
  } | null;
  recent_claims: Array<{
    claim_id: string;
    value: unknown;
    evidence_refs: string[];
  }>;
  allowed_capabilities: string[];
  permissions: {
    read_only_tools: true;
    can_model_mutate_financial_data: false;
  };
  state_hash: string;
};

export function buildTurnWorkspace(input: {
  turnId: string;
  planningContext: OrchestrationPlanningContextPack;
  dataContext: DataContextPack;
  conversationContext: ConversationContextPack;
}): TurnWorkspace {
  const workingSet =
    input.conversationContext.active_conversation_state.working_set;
  const focus = workingSet?.focus_set ?? null;
  const focusSet = focus
    ? {
        focus_id: focus.focus_id,
        version: focus.version,
        revision: focus.revision,
        kind: focus.subject,
        ordered_refs: [...focus.ordered_ids],
        visible_order_refs: [...focus.ordered_ids],
        source_tool_call_ids: focus.tool_provenance.map(
          (provenance) =>
            `${provenance.trace_id ?? "no-trace"}:${provenance.tool_name}`,
        ),
        filters: {
          query_kind: focus.query.kind,
          movement_filters: focus.query.movement_filters,
        },
        period: focus.query.date_range,
        state_hash: focus.state_hash,
        expires_at: focus.expires_at,
      }
    : null;
  const pendingOperation = resolvePendingOperation(input.planningContext);
  const focusSlots: TurnWorkspaceSlot[] =
    focus?.slot_provenance.map((slot) => ({
      name: slot.slot,
      required_for: workingSet?.goal ?? "active_goal",
      value: slot.value,
      source: mapSlotSource(slot.source),
      confidence: slot.confidence,
      confirmed_at: slot.confirmed_at,
      evidence_ref: slot.evidence_ref,
    })) ?? [];
  const focusSlotNames = new Set(focusSlots.map((slot) => slot.name));
  const unresolvedSlots: TurnWorkspaceSlot[] = [
    ...focusSlots,
    ...(workingSet?.unresolved_slots ?? [])
      .filter((slot) => !focusSlotNames.has(slot))
      .map((slot) => ({
        name: slot,
        required_for: workingSet?.goal ?? "active_goal",
        value: null,
        source: "inherited" as const,
        confidence: 1,
        confirmed_at: null,
        evidence_ref: workingSet?.last_action?.source_ref ?? null,
      })),
  ];
  const recentClaims =
    workingSet?.last_assistant_result_summary
      ? [
          {
            claim_id: `previous_result:${workingSet.updated_at}`,
            value: workingSet.last_assistant_result_summary,
            evidence_refs:
              focus?.tool_provenance.flatMap((provenance) => [
                `${provenance.trace_id ?? "no-trace"}:${provenance.tool_name}`,
                ...(provenance.source_ref ? [provenance.source_ref] : []),
              ]) ?? [],
          },
        ]
      : [];
  const workspaceWithoutHash = {
    version: "v1" as const,
    turn_id: input.turnId,
    user_id: input.planningContext.user_id,
    channel: input.planningContext.channel,
    user_message: input.planningContext.original_message,
    received_at: input.planningContext.received_at,
    timezone: input.planningContext.timezone,
    active_goal: workingSet?.goal ?? null,
    focus_set: focusSet,
    unresolved_slots: unresolvedSlots,
    pending_operation: pendingOperation,
    recent_claims: recentClaims,
    allowed_capabilities: input.planningContext.capability_catalog.map(
      (capability) => capability.name,
    ),
    permissions: {
      read_only_tools: true as const,
      can_model_mutate_financial_data: false as const,
    },
  };

  return {
    ...workspaceWithoutHash,
    state_hash: hashWorkspace(workspaceWithoutHash),
  };
}

function resolvePendingOperation(
  planningContext: OrchestrationPlanningContextPack,
): TurnWorkspace["pending_operation"] {
  const captureDraft = planningContext.active_financial_state.capture_draft;
  if (captureDraft) {
    return {
      kind: "capture_draft",
      target_ref: captureDraft.state_id,
      confirmable: captureDraft.missing_facts.length === 0,
    };
  }
  const pending = planningContext.active_financial_state.pending_candidates[0];
  if (pending) {
    return {
      kind: "pending_item",
      target_ref: pending.pending_code,
      confirmable: Boolean(pending.proposed_action),
    };
  }
  return null;
}

function mapSlotSource(
  source:
    | "explicit_user_message"
    | "conversation_memory"
    | "tool_result"
    | "core_confirmed",
): TurnWorkspaceSlot["source"] {
  if (source === "explicit_user_message") return "explicit";
  if (source === "tool_result" || source === "core_confirmed") return "tool";
  return "inherited";
}

function hashWorkspace(value: unknown): string {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
