import { z } from "zod";
import {
  CATEGORY_IDS,
  MOVEMENT_SOURCES,
  MOVEMENT_TYPES,
} from "@/shared/types/domain";

export const ConversationQueryKindSchema = z.enum([
  "balance_snapshot",
  "movement_search",
  "pending_summary",
  "debt_summary",
  "recurring_summary",
  "financial_memory_search",
  "unsupported",
]);
export type ConversationQueryKind = z.infer<typeof ConversationQueryKindSchema>;

export const ConversationToolNameSchema = z.enum([
  "get_balance_snapshot",
  "query_movements",
  "get_pending_summary",
  "get_debt_summary",
  "get_debt_details",
  "get_recurring_summary",
  "search_financial_memory",
  "get_classification_catalog",
  "get_pending_details",
  "get_financial_structure",
  "get_insights",
  "get_insight_evidence",
  "get_record_provenance",
  "get_user_context_summary",
  "get_spending_summary",
  // `20b` S5: la consulta abierta — de/donde/agrupar_por/medir/ordenar,
  // compilada contra el modelo del dominio de `src/core/semantics`. Unica
  // entidad compilable hoy: `movimientos` (`WEB-D257`, `WEB-D259`).
  "consultar_datos_abiertos",
]);
export type ConversationToolName = z.infer<typeof ConversationToolNameSchema>;

export const ConversationDateRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
  label: z.string(),
});
export type ConversationDateRange = z.infer<typeof ConversationDateRangeSchema>;

export const ConversationMovementFiltersSchema = z.object({
  search_terms: z
    .array(z.string().trim().min(1).max(80))
    .max(12),
  movement_types: z.array(z.enum(MOVEMENT_TYPES)).max(MOVEMENT_TYPES.length),
  category_ids: z.array(z.enum(CATEGORY_IDS)).max(CATEGORY_IDS.length),
  sources: z.array(z.enum(MOVEMENT_SOURCES)).max(MOVEMENT_SOURCES.length),
  account_terms: z.array(z.string().trim().min(1).max(80)).max(8),
  subcategory_terms: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  person_terms: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  tag_terms: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  uncategorized_only: z.boolean(),
});
export type ConversationMovementFilters = z.infer<
  typeof ConversationMovementFiltersSchema
>;

export const ConversationQuerySchema = z.object({
  kind: ConversationQueryKindSchema,
  normalized_text: z.string(),
  requested_amount: z.number().positive().nullable(),
  date_range: ConversationDateRangeSchema.nullable(),
  movement_filters: ConversationMovementFiltersSchema.nullable().optional(),
  confidence: z.number().min(0).max(1),
});
export type ConversationQuery = z.infer<typeof ConversationQuerySchema>;

export const ConversationStyleProfileSchema = z.object({
  instruction: z.string().trim().min(1).max(300),
  response_length: z.enum(["inherit", "shorter", "balanced", "detailed"]),
  formality: z.enum(["inherit", "casual", "neutral", "formal"]),
  warmth: z.enum(["inherit", "reserved", "warm"]),
  playfulness: z.enum(["inherit", "serious", "light", "playful"]),
  directness: z.enum(["inherit", "gentle", "direct"]),
  emoji_policy: z.enum(["inherit", "none", "limited"]),
  scope: z.enum(["turn", "session", "persistent"]),
  source: z.literal("explicit_user_request"),
  updated_at: z.string(),
});
export type ConversationStyleProfile = z.infer<
  typeof ConversationStyleProfileSchema
>;

export const ConversationActiveReadOperationSchema = z.object({
  operation_id: z.string().trim().min(1).max(100),
  query: ConversationQuerySchema,
  selected_tools: z.array(ConversationToolNameSchema).max(8),
  status: z.enum([
    "ready",
    "awaiting_clarification",
    "completed",
    "cancelled",
    "failed",
  ]),
  missing_slots: z.array(z.string().trim().min(1).max(120)).max(10),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ConversationActiveReadOperation = z.infer<
  typeof ConversationActiveReadOperationSchema
>;

export const ConversationFocusSlotProvenanceSchema = z.object({
  slot: z.string().trim().min(1).max(80),
  value: z.unknown(),
  source: z.enum([
    "explicit_user_message",
    "conversation_memory",
    "tool_result",
    "core_confirmed",
  ]),
  confidence: z.number().min(0).max(1),
  confirmed_at: z.string().nullable(),
  evidence_ref: z.string().nullable(),
});
export type ConversationFocusSlotProvenance = z.infer<
  typeof ConversationFocusSlotProvenanceSchema
>;

export const ConversationFocusSetSchema = z.object({
  version: z.literal("v1"),
  revision: z.number().int().positive(),
  focus_id: z.string().trim().min(1).max(160),
  subject: z.enum(["movements", "entities"]),
  ordered_ids: z.array(z.string().trim().min(1)).max(80),
  visible_order: z.literal("tool_result_order"),
  query: ConversationQuerySchema,
  tool_provenance: z
    .array(
      z.object({
        tool_name: ConversationToolNameSchema,
        trace_id: z.string().nullable(),
        source_ref: z.string().nullable(),
        executed_at: z.string(),
        result_count: z.number().int().min(0).max(1000),
        result_hash: z.string().trim().min(1).max(160),
      })
    )
    .max(8),
  slot_provenance: z.array(ConversationFocusSlotProvenanceSchema).max(24),
  state_hash: z.string().trim().min(1).max(160),
  created_at: z.string(),
  updated_at: z.string(),
  expires_at: z.string(),
});
export type ConversationFocusSet = z.infer<typeof ConversationFocusSetSchema>;

export const ConversationTurnActSchema = z.enum([
  "greeting",
  "help",
  "gratitude",
  "financial_question",
  "financial_follow_up",
  "financial_reconstruction",
  "correction",
  "financial_capture",
  "smalltalk",
  "unsupported",
]);
export type ConversationTurnAct = z.infer<typeof ConversationTurnActSchema>;

export const ConversationContinuitySchema = z.enum([
  "new_topic",
  "follow_up",
  "topic_shift",
  "repair_or_clarification",
  "cancel",
  "resume",
]);
export type ConversationContinuity = z.infer<typeof ConversationContinuitySchema>;

export const ConversationEmotionalStateSchema = z.enum([
  "neutral",
  "curious",
  "uncertain",
  "rushed",
  "anxious",
  "frustrated",
  "relieved",
]);
export type ConversationEmotionalState = z.infer<
  typeof ConversationEmotionalStateSchema
>;

export const ConversationExperienceModeSchema = z.enum([
  "quick_capture",
  "read_only_answer",
  "deep_analysis",
  "reconstruction",
  "correction",
  "support",
]);
export type ConversationExperienceMode = z.infer<
  typeof ConversationExperienceModeSchema
>;

export const ConversationTurnStateSchema = z.object({
  act: ConversationTurnActSchema,
  continuity: ConversationContinuitySchema,
  emotional_state: ConversationEmotionalStateSchema,
  experience_mode: ConversationExperienceModeSchema,
  should_use_active_memory: z.boolean(),
  should_route_to_conversation_agent: z.boolean(),
  should_ask_clarification_first: z.boolean(),
  response_guidance: z.array(z.string()),
  personalization_cues: z.array(z.string()),
  risk_notes: z.array(z.string()),
});
export type ConversationTurnState = z.infer<typeof ConversationTurnStateSchema>;

export const ConversationReferencedMovementSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: z.number(),
  currency: z.enum(["PEN", "USD"]),
  description: z.string().nullable(),
  merchant: z.string().nullable().optional(),
  category_id: z.string().nullable(),
  category_label: z.string().nullable().optional(),
  occurred_at: z.string().nullable(),
  source: z.string().nullable().optional(),
  source_ref: z.string().nullable().optional(),
  account_origin_id: z.string().nullable().optional(),
  account_origin_name: z.string().nullable().optional(),
  account_destination_id: z.string().nullable().optional(),
  account_destination_name: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  requires_review: z.boolean().optional(),
});
export type ConversationReferencedMovement = z.infer<
  typeof ConversationReferencedMovementSchema
>;

export const ConversationToolResultSchema = z.object({
  tool_name: z.string(),
  status: z.enum(["called", "skipped", "failed"]),
  facts: z.array(z.string()),
  warnings: z.array(z.string()),
  data: z.record(z.string(), z.unknown()),
});
export type ConversationToolResult = z.infer<typeof ConversationToolResultSchema>;

export const ConversationMemoryPersonSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  kind: z.string().nullable(),
  relationship_label: z.string().nullable(),
  aliases: z.array(z.string()),
  last_seen_at: z.string().nullable(),
});
export type ConversationMemoryPerson = z.infer<
  typeof ConversationMemoryPersonSchema
>;

export const ConversationMemoryCorrectionSchema = z.object({
  action: z.string(),
  field_name: z.string().nullable(),
  created_at: z.string(),
  movement_id: z.string().nullable(),
  summary: z.string(),
});
export type ConversationMemoryCorrection = z.infer<
  typeof ConversationMemoryCorrectionSchema
>;

export const ConversationWorkingSetSchema = z.object({
  version: z.literal("v1"),
  topic: z
    .enum([
      "movement",
      "balance",
      "pending",
      "debt",
      "recurring",
      "memory",
      "support",
    ])
    .nullable(),
  goal: z
    .enum(["capture", "query", "correct", "confirm", "review", "help"])
    .nullable(),
  last_user_message_summary: z.string().max(500).nullable(),
  last_assistant_result_summary: z.string().max(500).nullable(),
  last_action: z
    .object({
      kind: z.enum([
        "movement_created",
        "debt_created",
        "pending_created",
        "pending_resolved",
        "correction_proposed",
        "correction_applied",
        "correction_cancelled",
        "query_answered",
        "clarification_requested",
      ]),
      status: z.enum([
        "proposed",
        "awaiting_confirmation",
        "completed",
        "cancelled",
        "failed",
        // `23` §5b.1: una propuesta sin confirmar caduca a los 15 minutos o
        // al cambiar de tema. `expired` es ese estado: la propuesta ya no se
        // puede ejecutar con un "si" posterior (`AC-RT-13`).
        "expired",
      ]),
      source_ref: z.string().nullable(),
      movement_ids: z.array(z.string()).max(10),
      pending_item_ids: z.array(z.string()).max(10),
      command_ids: z.array(z.string()).max(5),
      // Hilo al que pertenece la accion. Opcional porque los estados escritos
      // antes de `WEB-D289` no lo tienen: sin sello, una confirmacion escrita
      // no puede ejecutarse (lado seguro).
      thread_key: z.string().max(200).nullable().optional(),
      // Momento en que deja de valer una confirmacion escrita (`23` §5b.1).
      confirmation_expires_at: z.string().nullable().optional(),
    })
    .nullable(),
  unresolved_slots: z.array(z.string().max(120)).max(10),
  movement_referents: z.array(z.string()).max(10),
  entity_referents: z.array(z.string()).max(20),
  active_read_operation: ConversationActiveReadOperationSchema.nullable().default(
    null,
  ),
  focus_set: ConversationFocusSetSchema.nullable().optional(),
  conversation_style: ConversationStyleProfileSchema.nullable().default(null),
  updated_at: z.string(),
});
export type ConversationWorkingSet = z.infer<
  typeof ConversationWorkingSetSchema
>;

export const ConversationContextPackSchema = z.object({
  context_pack_type: z.literal("conversation_context"),
  version: z.literal("v1"),
  user_id: z.string(),
  locale: z.literal("es-PE"),
  timezone: z.string(),
  original_message: z.string(),
  received_at: z.string(),
  query: ConversationQuerySchema,
  turn_state: ConversationTurnStateSchema,
  active_conversation_state: z.object({
    state_id: z.string().nullable(),
    last_intent: z.string().nullable(),
    last_query_kind: ConversationQueryKindSchema.nullable(),
    last_query_text: z.string().nullable(),
    last_query_date_range: ConversationDateRangeSchema.nullable(),
    last_result_summary: z.string().nullable(),
    referenced_movements: z.array(ConversationReferencedMovementSchema),
    referenced_entities: z.array(z.record(z.string(), z.unknown())),
    continuity_hint: z.string().nullable(),
    expires_at: z.string().nullable(),
    working_set: ConversationWorkingSetSchema.nullable(),
  }),
  preferences_summary: z.object({
    tone_style: z.string().nullable(),
    conversation_style: ConversationStyleProfileSchema.nullable(),
    discreet_mode: z.boolean(),
    whatsapp_opt_in: z.boolean(),
    email_opt_in: z.boolean(),
    quiet_hours: z
      .object({
        start: z.string().nullable(),
        end: z.string().nullable(),
      })
      .nullable(),
    default_account_id: z.string().nullable(),
  }),
  memory_summary: z.object({
    frequent_people: z.array(ConversationMemoryPersonSchema),
    recent_corrections: z.array(ConversationMemoryCorrectionSchema),
  }),
  permissions: z.object({
    read_only: z.literal(true),
    can_mutate_financial_data: z.literal(false),
  }),
  tool_results: z.array(ConversationToolResultSchema),
  data_limits: z.array(z.string()),
});
export type ConversationContextPack = z.infer<typeof ConversationContextPackSchema>;

export const ConversationalAnswerSchema = z.object({
  response_text: z.string().trim().min(1).max(1000),
  answer_kind: z.enum([
    "balance_snapshot",
    "movement_summary",
    "pending_summary",
    "debt_summary",
    "recurring_summary",
    "memory_summary",
    "clarification",
    "unsupported",
  ]),
  confidence: z.number().min(0).max(1),
  cited_facts: z.array(z.string()),
  used_tools: z.array(z.string()),
  follow_up_question: z.string().nullable(),
  safety_flags: z.array(z.string()),
});
export type ConversationalAnswer = z.infer<typeof ConversationalAnswerSchema>;
