import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";

type Client = SupabaseClient<Database>;

export type UserDataExport = {
  schema_version: "manzana_user_export_v2";
  generated_at: string;
  profile: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  accounts: Array<Record<string, unknown>>;
  boxes: Array<Record<string, unknown>>;
  movements: Array<Record<string, unknown>>;
  budgets: Array<Record<string, unknown>>;
  goals: Array<Record<string, unknown>>;
  budget_progress_snapshots: Array<Record<string, unknown>>;
  budget_suggestion_decisions: Array<Record<string, unknown>>;
  debts: Array<Record<string, unknown>>;
  debt_payments: Array<Record<string, unknown>>;
  recurring_rules: Array<Record<string, unknown>>;
  recurring_occurrences: Array<Record<string, unknown>>;
  custom_subcategories: Array<Record<string, unknown>>;
  custom_tags: Array<Record<string, unknown>>;
  active_pending_items: Array<Record<string, unknown>>;
  nudge_preferences: Array<Record<string, unknown>>;
  learning_preferences: Record<string, unknown> | null;
  financial_memory: Array<Record<string, unknown>>;
  learning_candidates: Array<Record<string, unknown>>;
  learning_evidence: Array<Record<string, unknown>>;
  learning_history: Array<Record<string, unknown>>;
  conversation_memory: Array<Record<string, unknown>>;
  source_summary: {
    gmail: Array<Record<string, unknown>>;
    whatsapp_linked: boolean;
  };
};

export class PrivacyRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivacyRepositoryError";
  }
}

export async function exportUserData(
  client: Client,
  userId: string,
): Promise<UserDataExport> {
  const [
    profile,
    preferences,
    accounts,
    boxes,
    movements,
    budgets,
    goals,
    budgetProgressSnapshots,
    budgetSuggestionDecisions,
    debts,
    debtPayments,
    recurringRules,
    recurringOccurrences,
    customSubcategories,
    customTags,
    pendingItems,
    nudgePreferences,
    gmailConnections,
    learningPreferences,
    financialMemory,
    learningCandidates,
    learningEvidence,
    learningHistory,
    conversationMemory,
  ] = await Promise.all([
    client
      .from("profiles")
      .select(
        "display_name,phone_e164,default_currency,timezone,locale,onboarding_status,created_at,updated_at",
      )
      .eq("id", userId)
      .maybeSingle(),
    client
      .from("user_preferences")
      .select(
        "default_account_id,whatsapp_opt_in,email_opt_in,nudge_opt_in,quiet_hours_start,quiet_hours_end,discreet_mode_enabled,tone_style,created_at,updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("accounts")
      .select(
        "id,name,type,currency,institution,initial_balance,current_balance,is_default,created_at,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("boxes")
      .select(
        "id,account_id,name,type,current_balance,target_amount,target_date,linked_debt_id,linked_recurring_id,created_at,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("movements")
      .select(
        "id,type,amount,currency,occurred_at,description,merchant,category_id,subcategory_id,account_origin_id,account_destination_id,box_origin_id,box_destination_id,related_person_id,debt_id,recurring_rule_id,recurring_occurrence_id,source,status,requires_review,created_at,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("occurred_at"),
    client
      .from("budgets")
      .select(
        "id,category_id,currency,period_kind,period_start,period_end,base_amount,rollover_amount,amount,kind,rollover,auto_renew,alerted_thresholds,source,status,created_at,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("goals")
      .select(
        "id,name,target_amount,target_date,box_id,currency,status,created_at,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("budget_progress_snapshots")
      .select("id,budget_id,as_of,spent,remaining,pct,created_at")
      .eq("user_id", userId)
      .order("as_of"),
    client
      .from("budget_suggestion_decisions")
      .select(
        "id,suggestion_key,category_id,period_kind,evidence_start,evidence_end,evidence,proposed_amount,resolution,budget_id,result,created_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("debts")
      .select(
        "id,name,direction,kind,principal_amount,current_balance,currency,opened_at,due_date,next_payment_date,installment_amount,installment_count,last_payment_at,status,related_person_id,source,created_at,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("debt_payments")
      .select(
        "id,debt_id,movement_id,amount,currency,paid_at,source,created_at",
      )
      .eq("user_id", userId)
      .order("paid_at"),
    client
      .from("recurring_rules")
      .select(
        "id,name,merchant_pattern,expected_amount,currency,amount_variability,frequency,day_of_month,date_window_start_day,date_window_end_day,next_expected_date,last_paid_at,last_paid_amount,status,category_id,subcategory_id,default_account_id,linked_debt_id,linked_box_id,requires_confirmation_for_payment,source,created_at,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("recurring_occurrences")
      .select(
        "id,recurring_rule_id,expected_date,expected_amount,status,paid_movement_id,paid_at,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("expected_date"),
    client
      .from("user_subcategories")
      .select(
        "id,category_id,label,normalized_label,created_by,created_at,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("tags")
      .select("id,key,label,type,is_system,created_at,updated_at,deleted_at")
      .eq("user_id", userId)
      .eq("is_system", false)
      .order("created_at"),
    client
      .from("pending_items")
      .select(
        "id,type,source,status,proposed_action,normalized_summary,risk_level,dedup_status,expires_at,created_at,updated_at",
      )
      .eq("user_id", userId)
      .in("status", ["pending", "sent_for_confirmation", "user_edited"])
      .order("created_at"),
    client
      .from("nudge_preferences")
      .select(
        "id,nudge_type,channel,enabled,paused_until,quiet_hours_override,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("email_connections")
      .select(
        "provider,email_address,status,watch_status,created_at,updated_at,deleted_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("learning_preferences")
      .select(
        "enabled,allow_narrative_memory,allow_sensitive_memory,consent_version,updated_by,created_at,updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("financial_memory_items")
      .select(
        "id,kind,canonical_key,summary,evidence_source,evidence_ref,confidence,confirmation_status,lifecycle_status,sensitivity,valid_until,superseded_at,positive_evidence_refs,negative_evidence_refs,positive_evidence_count,negative_evidence_count,explanation,review_at,suspended_at,revoked_at,revoked_reason,sensitive_confirmed_at,source_candidate_id,supersedes_memory_id,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("learning_candidates")
      .select(
        "id,kind,canonical_key,proposal_summary,basis,evidence_sources,evidence_refs,evidence_count,positive_evidence_refs,negative_evidence_refs,positive_evidence_count,negative_evidence_count,positive_evidence_weight,negative_evidence_weight,confidence,sensitivity,requires_user_confirmation,status,decision_reason,valid_until,review_at,last_evidence_at,last_conflict_at,promoted_memory_id,decided_at,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("learning_evidence")
      .select(
        "id,candidate_id,memory_id,evidence_ref,polarity,source_type,source_entity_type,source_entity_id,weight,observed_at,claim_value,sensitivity,created_at",
      )
      .eq("user_id", userId)
      .order("observed_at"),
    client
      .from("learning_memory_events")
      .select(
        "id,candidate_id,memory_id,event_type,actor_type,reason,source_ref,previous_state,next_state,created_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("conversation_memory_states")
      .select(
        "id,channel,scope,last_intent,last_query_kind,last_query_text,last_query_date_range,last_result_summary,last_tool_name,referenced_movements,referenced_entities,continuity_hint,source_ref,expires_at,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("created_at"),
  ]);

  const results = [
    profile,
    preferences,
    accounts,
    boxes,
    movements,
    budgets,
    goals,
    budgetProgressSnapshots,
    budgetSuggestionDecisions,
    debts,
    debtPayments,
    recurringRules,
    recurringOccurrences,
    customSubcategories,
    customTags,
    pendingItems,
    nudgePreferences,
    gmailConnections,
    learningPreferences,
    financialMemory,
    learningCandidates,
    learningEvidence,
    learningHistory,
    conversationMemory,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw new PrivacyRepositoryError(
      `No se pudo preparar la exportacion: ${failed.error.message}`,
    );
  }

  const profileData = asRecordOrNull(profile.data);
  return {
    schema_version: "manzana_user_export_v2",
    generated_at: new Date().toISOString(),
    profile: profileData,
    preferences: asRecordOrNull(preferences.data),
    accounts: asRecords(accounts.data),
    boxes: asRecords(boxes.data),
    movements: asRecords(movements.data),
    budgets: asRecords(budgets.data),
    goals: asRecords(goals.data),
    budget_progress_snapshots: asRecords(budgetProgressSnapshots.data),
    budget_suggestion_decisions: asRecords(budgetSuggestionDecisions.data),
    debts: asRecords(debts.data),
    debt_payments: asRecords(debtPayments.data),
    recurring_rules: asRecords(recurringRules.data),
    recurring_occurrences: asRecords(recurringOccurrences.data),
    custom_subcategories: asRecords(customSubcategories.data),
    custom_tags: asRecords(customTags.data),
    active_pending_items: asRecords(pendingItems.data),
    nudge_preferences: asRecords(nudgePreferences.data),
    learning_preferences: asRecordOrNull(learningPreferences.data),
    financial_memory: asRecords(financialMemory.data),
    learning_candidates: asRecords(learningCandidates.data),
    learning_evidence: asRecords(learningEvidence.data),
    learning_history: asRecords(learningHistory.data),
    conversation_memory: asRecords(conversationMemory.data),
    source_summary: {
      gmail: asRecords(gmailConnections.data),
      whatsapp_linked:
        typeof profileData?.phone_e164 === "string" &&
        profileData.phone_e164.length > 0,
    },
  };
}

export async function prepareUserAccountDeletion(
  client: Client,
  input: {
    userId: string;
    traceId: string;
  },
): Promise<void> {
  const { error } = await client.rpc("prepare_user_account_deletion", {
    p_trace_id: input.traceId,
    p_user_id: input.userId,
  });
  if (error) {
    throw new PrivacyRepositoryError(
      `No se pudo preparar la eliminacion: ${error.message}`,
    );
  }
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.map((item) => asRecordOrNull(item) ?? {})
    : [];
}

function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
