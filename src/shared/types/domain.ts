/**
 * Tipos de dominio TypeScript para Manzana V1.
 * Espejo de los enums y contratos de 16_modelo_datos.md.
 */

// -- Enums de dominio -------------------------------------------------------

export const MOVEMENT_TYPES = [
  "gasto",
  "ingreso",
  "transferencia",
  "asignacion_interna",
  "deuda_adquirida",
  "pago_deuda",
  "prestamo_dado",
  "prestamo_recibido",
  "devolucion_recibida",
  "pago_recurrente",
  "ajuste",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_STATUSES = [
  "confirmed",
  "needs_review",
  "corrected",
  "deleted",
  "reversed",
] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

export const MOVEMENT_SOURCES = [
  "whatsapp",
  "dashboard_manual",
  "email_confirmed",
  "recurring_confirmed",
  "backfill_confirmed",
  "system_adjustment",
] as const;
export type MovementSource = (typeof MOVEMENT_SOURCES)[number];

export const PENDING_STATUSES = [
  "pending",
  "sent_for_confirmation",
  "user_confirmed",
  "user_edited",
  "discarded",
  "auto_resolved_duplicate",
  "already_registered",
  "expired",
  "archived",
] as const;
export type PendingStatus = (typeof PENDING_STATUSES)[number];

export const PENDING_SOURCES = [
  "email_pending",
  "backfill_pending",
  "recurring_candidate",
  "ambiguous_movement",
  "risk_confirmation",
] as const;
export type PendingSource = (typeof PENDING_SOURCES)[number];

export const PENDING_TYPES = [
  "email_detected",
  "ambiguous_movement",
  "recurring_candidate",
  "backfill_item",
  "data_quality",
  "risk_confirmation",
] as const;
export type PendingType = (typeof PENDING_TYPES)[number];

export const RISK_LEVELS = ["low", "medium", "high", "sensitive"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const ACCOUNT_TYPES = ["digital", "banco", "fisico", "tarjeta"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const BOX_TYPES = ["compromiso", "objetivo", "emergencia"] as const;
export type BoxType = (typeof BOX_TYPES)[number];

export const DEBT_DIRECTIONS = ["i_owe", "they_owe_me"] as const;
export type DebtDirection = (typeof DEBT_DIRECTIONS)[number];

export const DEBT_KINDS = [
  "personal",
  "bank_loan",
  "credit_card",
  "installment_purchase",
  "service_or_bill",
  "other",
] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];

export const DEBT_STATUSES = [
  "draft",
  "active",
  "due_soon",
  "overdue",
  "paid",
  "cancelled",
  "archived",
] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

export const INSTALLMENT_STATUSES = [
  "pending",
  "due_soon",
  "overdue",
  "paid",
  "rescheduled",
  "skipped",
] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const RECURRING_STATUSES = [
  "suggested",
  "active",
  "paused",
  "cancelled",
  "archived",
] as const;
export type RecurringStatus = (typeof RECURRING_STATUSES)[number];

export const RECURRING_OCCURRENCE_STATUSES = [
  "expected",
  "due_soon",
  "pending_confirmation",
  "paid",
  "skipped",
  "overdue",
  "rejected",
] as const;
export type RecurringOccurrenceStatus =
  (typeof RECURRING_OCCURRENCE_STATUSES)[number];

export const RECURRING_CANDIDATE_STATUSES = [
  "candidate",
  "ready_to_suggest",
  "suggested",
  "confirmed",
  "dismissed",
  "expired",
] as const;
export type RecurringCandidateStatus =
  (typeof RECURRING_CANDIDATE_STATUSES)[number];

export const INSIGHT_TYPES = [
  "learning_progress",
  "comparative",
  "category_concentration",
  "temporal_pattern",
  "anomaly",
  "projection",
  "free_money",
  "recurring",
  "debt",
  "box_saving",
  "contextual",
  "progress",
  "data_quality",
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const INSIGHT_STATUSES = [
  "candidate",
  "validated",
  "ranked",
  "narrated",
  "displayed",
  "sent",
  "acted",
  "dismissed",
  "ignored",
  "outdated",
  "expired",
] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export const NUDGE_TYPES = [
  "daily_reconstruction",
  "missing_activity",
  "payment_due",
  "debt_due",
  "overdue_payment",
  "pending_review",
  "weekly_review",
  "insight_prompt",
  "anomaly_alert",
  "progress_positive",
  "budget_goal",
  "reengagement",
] as const;
export type NudgeType = (typeof NUDGE_TYPES)[number];

export const NUDGE_STATUSES = [
  "candidate",
  "approved",
  "deferred",
  "rejected",
  "scheduled",
  "sent",
  "delivered",
  "responded",
  "acted",
  "dismissed",
  "failed",
  "expired",
] as const;
export type NudgeStatus = (typeof NUDGE_STATUSES)[number];

export const RECURRING_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
  "custom_window",
] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const RECURRING_AMOUNT_VARIABILITIES = [
  "fixed",
  "variable",
  "estimated",
] as const;
export type RecurringAmountVariability =
  (typeof RECURRING_AMOUNT_VARIABILITIES)[number];

export const ONBOARDING_STATUSES = [
  "not_started",
  "started",
  "first_value_reached",
  "activated_light",
  "activated_strong",
  "completed",
  "paused",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

/** Los 12 IDs canónicos de categoría. Definidos en 05f_categorias.md. */
export const CATEGORY_IDS = [
  "alimentacion",
  "transporte",
  "vivienda_hogar",
  "servicios_suscripciones",
  "salud",
  "educacion",
  "ocio_salidas",
  "compras_personales",
  "familia_apoyo",
  "deudas",
  "trabajo_productividad",
  "otros",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** IDs de etiquetas contextuales de sistema. */
export const SYSTEM_TAG_KEYS = [
  "necesario",
  "gusto",
  "impulso",
  "recurrente",
  "social",
  "trabajo",
  "estres",
  "fin_de_semana",
] as const;
export type SystemTagKey = (typeof SYSTEM_TAG_KEYS)[number];

// -- Entidades de dominio ---------------------------------------------------

export type Profile = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  timezone: string;
  locale: string;
  default_currency: string;
  onboarding_status: OnboardingStatus;
  created_at: string;
  updated_at: string;
};

export type UserPreferences = {
  user_id: string;
  tone_style: string | null;
  discreet_mode_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  whatsapp_opt_in: boolean;
  email_opt_in: boolean;
  nudge_opt_in: Record<string, boolean>;
  default_account_id: string | null;
  metadata: Record<string, unknown>;
};

export type Category = {
  id: CategoryId;
  label: string;
  description: string | null;
  is_system: boolean;
  sort_order: number;
  is_sensitive: boolean;
};

export type UserSubcategory = {
  id: string;
  user_id: string;
  category_id: CategoryId;
  label: string;
  normalized_label: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
};

export type Tag = {
  id: string;
  user_id: string | null;
  key: string;
  label: string;
  type: "contextual" | "custom";
  is_system: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  type: AccountType;
  currency: string;
  initial_balance: number;
  current_balance: number;
  is_default: boolean;
  color: string | null;
  icon: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Box = {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  type: BoxType;
  current_balance: number;
  target_amount: number | null;
  target_date: string | null;
  linked_debt_id: string | null;
  linked_recurring_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type RelatedPerson = {
  id: string;
  user_id: string;
  display_name: string;
  normalized_name: string;
  kind: string;
  relationship_label: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Debt = {
  id: string;
  user_id: string;
  direction: DebtDirection;
  kind: DebtKind;
  status: DebtStatus;
  related_person_id: string | null;
  name: string;
  principal_amount: number;
  current_balance: number;
  currency: "PEN" | "USD";
  opened_at: string;
  due_date: string | null;
  next_payment_date: string | null;
  installment_count: number | null;
  installment_amount: number | null;
  interest_notes: string | null;
  source: string;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_payment_at: string | null;
  closed_at: string | null;
};

export type DebtPayment = {
  id: string;
  user_id: string;
  debt_id: string;
  movement_id: string | null;
  amount: number;
  currency: "PEN" | "USD";
  paid_at: string;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DebtPaymentAllocation = {
  id: string;
  user_id: string;
  debt_id: string;
  debt_payment_id: string;
  debt_installment_id: string;
  movement_id: string;
  allocated_amount: number;
  allocation_order: number;
  policy: string;
  reversed_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DebtInstallment = {
  id: string;
  user_id: string;
  debt_id: string;
  number: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  status: InstallmentStatus;
  movement_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RecurringRule = {
  id: string;
  user_id: string;
  status: RecurringStatus;
  name: string;
  merchant_pattern: string | null;
  expected_amount: number | null;
  amount_variability: RecurringAmountVariability;
  currency: "PEN" | "USD";
  frequency: RecurringFrequency;
  day_of_month: number | null;
  date_window_start_day: number | null;
  date_window_end_day: number | null;
  next_expected_date: string | null;
  category_id: CategoryId | null;
  subcategory_id: string | null;
  default_account_id: string | null;
  linked_box_id: string | null;
  linked_debt_id: string | null;
  source: string;
  confidence: number | null;
  creation_idempotency_key?: string | null;
  creation_request_hash?: string | null;
  requires_confirmation_for_payment: boolean;
  last_paid_at: string | null;
  last_paid_amount: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  cancelled_at: string | null;
};

export type RecurringOccurrence = {
  id: string;
  user_id: string;
  recurring_rule_id: string;
  expected_date: string;
  expected_amount: number | null;
  status: RecurringOccurrenceStatus;
  paid_at: string | null;
  paid_movement_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RecurringCandidate = {
  id: string;
  user_id: string;
  merchant_key: string;
  category_id: CategoryId | null;
  evidence: Record<string, unknown>;
  confidence: number;
  status: RecurringCandidateStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type NudgePreference = {
  id: string;
  user_id: string;
  nudge_type: NudgeType;
  enabled: boolean;
  channel: string;
  quiet_hours_override: Record<string, unknown> | null;
  paused_until: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type NudgeCandidate = {
  id: string;
  user_id: string;
  type: NudgeType;
  source_entity_type: string;
  source_entity_id: string;
  priority: number;
  risk_level: RiskLevel;
  status: NudgeStatus;
  scheduled_for: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type NudgeDelivery = {
  id: string;
  user_id: string;
  nudge_candidate_id: string | null;
  channel: string;
  status: NudgeStatus;
  sent_at: string | null;
  delivered_at: string | null;
  responded_at: string | null;
  response_summary: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type InsightCandidate = {
  id: string;
  user_id: string;
  type: InsightType;
  fingerprint: string;
  status: InsightStatus;
  period_start: string;
  period_end: string;
  confidence: number;
  quality_score: number;
  rank_score: number;
  risk_level: RiskLevel;
  title: string;
  body: string;
  evidence_text: string;
  evidence: Record<string, unknown>;
  source_facts: Record<string, unknown>;
  source_entity_ids: string[];
  action: Record<string, unknown> | null;
  expires_at: string | null;
  narrated_at: string | null;
  displayed_at: string | null;
  outdated_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type InsightDelivery = {
  id: string;
  user_id: string;
  insight_candidate_id: string | null;
  channel: "dashboard" | "whatsapp";
  status: "planned" | "sent" | "delivered" | "seen" | "failed";
  delivered_at: string | null;
  seen_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type Movement = {
  id: string;
  user_id: string;
  type: MovementType;
  status: MovementStatus;
  amount: number;
  currency: "PEN" | "USD";
  occurred_at: string;
  description: string | null;
  merchant: string | null;
  category_id: CategoryId | null;
  subcategory_id: string | null;
  source: MovementSource;
  source_ref: string | null;
  idempotency_key: string;
  confidence: number | null;
  requires_review: boolean;
  account_origin_id: string | null;
  account_destination_id: string | null;
  box_origin_id: string | null;
  box_destination_id: string | null;
  debt_id: string | null;
  recurring_rule_id: string | null;
  recurring_occurrence_id: string | null;
  related_person_id: string | null;
  affects_total_balance: boolean;
  affects_account_balance: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
};

export type MovementAuditLog = {
  id: string;
  user_id: string;
  movement_id: string | null;
  entity_type: string;
  entity_id: string;
  action:
    | "created"
    | "updated"
    | "corrected"
    | "deleted"
    | "reversed"
    | "restored";
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  source: string;
  actor_type: "user" | "agent" | "system" | "worker";
  actor_id: string | null;
  trace_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type MovementTag = {
  movement_id: string;
  tag_id: string;
  confidence: number | null;
  source: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type PendingItem = {
  id: string;
  user_id: string;
  type: PendingType;
  status: PendingStatus;
  source: PendingSource;
  source_ref: string | null;
  proposed_action: Record<string, unknown>;
  normalized_summary: {
    title?: string;
    subtitle?: string;
    amount?: number;
    currency?: "PEN" | "USD";
    occurred_at?: string;
    category_id?: CategoryId | null;
    account_hint?: string | null;
    confidence_label?: string | null;
  };
  dedup_status: string | null;
  risk_level: RiskLevel;
  /** RUL-PEND-01: calculado al crear/completar, nunca en el cliente. */
  confirmable: boolean;
  confirm_command: Record<string, unknown> | null;
  expires_at: string | null;
  sent_for_confirmation_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};
