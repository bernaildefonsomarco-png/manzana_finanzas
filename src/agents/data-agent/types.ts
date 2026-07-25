import { z } from "zod";
import {
  CATEGORY_IDS,
  MOVEMENT_TYPES,
  type CategoryId,
  type MovementType,
} from "@/shared/types/domain";

export const DataAgentIntentSchema = z.enum([
  "record_movement",
  "record_multiple_movements",
  "correction",
  "conversation",
  "unknown",
]);
export type DataAgentIntent = z.infer<typeof DataAgentIntentSchema>;

export const EvidenceSignalSchema = z.object({
  field: z.string(),
  value: z.string(),
  source: z.enum(["user_text", "context_pack", "rule", "tool"]),
});
export type EvidenceSignal = z.infer<typeof EvidenceSignalSchema>;

export const AmbiguitySchema = z.object({
  field: z.string(),
  reason: z.string(),
  scope: z
    .enum(["financial_action", "conversation_follow_up", "context"])
    .optional(),
  action_id: z.string().nullable().optional(),
  options: z.array(z.string()).optional(),
  question: z.string().nullable().optional(),
  risk_level: z.enum(["low", "medium", "high", "sensitive"]),
});
export type Ambiguity = z.infer<typeof AmbiguitySchema>;

export const DebtHintSchema = z
  .object({
    operation: z
      .enum(["existing_debt_payment", "create_debt"])
      .nullable()
      .optional(),
    direction: z.enum(["i_owe", "they_owe_me"]).nullable().optional(),
    kind: z
      .enum([
        "personal",
        "bank_loan",
        "credit_card",
        "installment_purchase",
        "service_or_bill",
        "other",
      ])
      .nullable()
      .optional(),
    debt_id: z.string().uuid().nullable().optional(),
    debt_name: z.string().trim().min(1).max(160).nullable().optional(),
    related_person_id: z.string().uuid().nullable().optional(),
    person_name: z.string().trim().min(1).max(120).nullable().optional(),
    installment_id: z.string().uuid().nullable().optional(),
    installment_number: z.number().int().positive().nullable().optional(),
    installment_count: z
      .number()
      .int()
      .min(1)
      .max(240)
      .nullable()
      .optional(),
    installment_amount: z.number().positive().nullable().optional(),
    first_due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .strict();
export type DebtHint = z.infer<typeof DebtHintSchema>;

export const ProposedActionSchema = z.object({
  action_id: z.string(),
  movement_type: z.enum(MOVEMENT_TYPES),
  amount: z.number().positive().nullable(),
  currency: z.enum(["PEN", "USD"]),
  occurred_at: z.string().datetime({ offset: true }).nullable(),
  description: z.string().nullable(),
  category_id: z.enum(CATEGORY_IDS).nullable(),
  subcategory_id: z.string().uuid().nullable(),
  tags: z.array(z.string()),
  account_origin_id: z.string().uuid().nullable(),
  account_destination_id: z.string().uuid().nullable(),
  box_origin_id: z.string().uuid().nullable(),
  box_destination_id: z.string().uuid().nullable(),
  debt_hint: DebtHintSchema.nullable(),
  recurring_hint: z.record(z.string(), z.unknown()).nullable(),
  related_person_hint: z.record(z.string(), z.unknown()).nullable(),
  source_evidence: z.array(EvidenceSignalSchema),
  confidence: z.number().min(0).max(1),
});
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

export const DataAgentOutputSchema = z.object({
  intent: DataAgentIntentSchema,
  confidence: z.number().min(0).max(1),
  result: z.array(ProposedActionSchema),
  ambiguities: z.array(AmbiguitySchema),
  requires_confirmation: z.boolean(),
  evidence_signals: z.array(EvidenceSignalSchema),
  safe_explanation: z.string().nullable(),
});
export type DataAgentOutput = z.infer<typeof DataAgentOutputSchema>;

export type DataContextPack = {
  context_pack_type: "data_context";
  version: "v2";
  user_id: string;
  locale: "es-PE";
  timezone: string;
  channel: "whatsapp" | "dashboard" | "email" | "worker";
  discreet_mode: boolean;
  preferences_summary: Record<string, unknown>;
  risk_context: Record<string, unknown>;
  original_message: string;
  received_at: string;
  categories: Array<{
    id: CategoryId;
    label: string;
    is_sensitive: boolean;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currency: "PEN" | "USD";
    is_default: boolean;
  }>;
  boxes: Array<{
    id: string;
    account_id: string;
    name: string;
    type: string;
    current_balance: number;
    target_amount: number | null;
    target_date: string | null;
  }>;
  subcategories: Array<{
    id: string;
    category_id: CategoryId;
    label: string;
    normalized_label: string;
  }>;
  tags: Array<{
    id: string;
    key: string;
    label: string;
    type: string;
    is_system: boolean;
  }>;
  related_people: Array<{
    id: string;
    display_name: string;
    kind: string | null;
    relationship_label: string | null;
    aliases: string[];
  }>;
  active_debts?: Array<{
    id: string;
    name: string;
    direction: "i_owe" | "they_owe_me";
    status: "active" | "due_soon" | "overdue";
    current_balance: number;
    currency: "PEN" | "USD";
    due_date: string | null;
    next_payment_date: string | null;
    related_person_id: string | null;
    related_person_name: string | null;
    related_person_aliases: string[];
    installments: Array<{
      id: string;
      number: number;
      due_date: string;
      expected_amount: number;
      paid_amount: number;
      status: "pending" | "due_soon" | "overdue";
    }>;
  }>;
  recent_movements: Array<{
    id: string;
    type: string;
    amount: number;
    currency: "PEN" | "USD";
    description: string | null;
    merchant: string | null;
    category_id: CategoryId | null;
    subcategory_id: string | null;
    related_person_id: string | null;
    occurred_at: string;
    account_origin_id: string | null;
    account_destination_id: string | null;
    status: string;
    source: string;
  }>;
  recent_corrections: Array<{
    action: string;
    field_name: string | null;
    movement_id: string | null;
    summary: string;
    created_at: string;
  }>;
  learned_vocabulary: Array<{
    term: string;
    meaning: string;
    kind: "alias" | "correction_pattern";
    confidence: number;
    evidence_source: string;
  }>;
  active_capture_draft?: {
    state_id: string;
    reason: string;
    original_message: string;
    created_at: string;
    data_agent_output: DataAgentOutput | null;
    financial_plan: {
      kind: string;
      reason: string;
      blocked_reasons: string[];
      proposed_actions_count: number;
    } | null;
  } | null;
};

export type LocalDataMovementDraft = {
  movementType: MovementType;
  amount: number | null;
  description: string | null;
  categoryId: CategoryId | null;
  confidence: number;
  evidenceValue: string;
};
