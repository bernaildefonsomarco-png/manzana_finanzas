import { z } from "zod";
import {
  ConversationContinuitySchema,
  ConversationEmotionalStateSchema,
  ConversationExperienceModeSchema,
  ConversationQueryKindSchema,
  ConversationQuerySchema,
  ConversationStyleProfileSchema,
  ConversationToolNameSchema,
  ConversationTurnActSchema,
  ConversationTurnStateSchema,
  type ConversationQuery,
  type ConversationToolName,
  type ConversationTurnState,
} from "@/agents/conversation-agent/types";
import {
  CATEGORY_IDS,
  type CategoryId,
} from "@/shared/types/domain";

export const PlanningGoalSchema = z.enum([
  "record",
  "query",
  "correction",
  "confirmation",
  "review",
  "help",
  "mixed",
]);
export type PlanningGoal = z.infer<typeof PlanningGoalSchema>;

export const PlanningWorkflowSchema = z.enum([
  "financial_capture",
  "conversation_read_only",
  "correction_review",
  "pending_resolution",
  "review_pending",
  "support",
  "mixed_capture_and_query",
]);
export type PlanningWorkflow = z.infer<typeof PlanningWorkflowSchema>;

export const PlanningStepKindSchema = z.enum([
  "agent",
  "tool",
  "policy_check",
  "core_command",
  "response",
]);
export type PlanningStepKind = z.infer<typeof PlanningStepKindSchema>;

export const PlanningCapabilitySchema = z.enum([
  "data_agent",
  "conversation_agent",
  "correction_agent",
  "response_agent",
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
  "policy_gate",
  "command_dispatcher",
]);
export type PlanningCapability = z.infer<typeof PlanningCapabilitySchema>;

export const PlanningStepSchema = z.object({
  step_id: z.string().trim().min(1).max(80),
  kind: PlanningStepKindSchema,
  capability: PlanningCapabilitySchema,
  depends_on: z.array(z.string().trim().min(1).max(80)).max(8),
  purpose: z.string().trim().min(1).max(300),
});
export type PlanningStep = z.infer<typeof PlanningStepSchema>;

export const PlanningFinancialResolutionSchema = z.object({
  action: z.enum([
    "none",
    "list",
    "review",
    "assign_transfer",
    "classify_expense",
    "classify_income",
    "confirm",
    "discard",
  ]),
  target: z.enum(["none", "pending_item", "capture_draft"]),
  pending_code: z
    .string()
    .trim()
    .regex(/^P-[A-F0-9]{8}$/)
    .nullable(),
  account_origin_id: z.string().uuid().nullable(),
  account_destination_id: z.string().uuid().nullable(),
  category_id: z.enum(CATEGORY_IDS).nullable(),
  learn_account_aliases: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type PlanningFinancialResolution = z.infer<
  typeof PlanningFinancialResolutionSchema
>;

export const OrchestrationPlanSchema = z.object({
  goal: PlanningGoalSchema,
  workflow: PlanningWorkflowSchema,
  steps: z.array(PlanningStepSchema).min(1).max(8),
  conversation_query_kind: ConversationQueryKindSchema.nullable(),
  semantic_query: ConversationQuerySchema.nullable(),
  semantic_turn: z.object({
    act: ConversationTurnActSchema,
    continuity: ConversationContinuitySchema,
    emotional_state: ConversationEmotionalStateSchema,
    experience_mode: ConversationExperienceModeSchema,
    should_use_active_memory: z.boolean(),
    should_route_to_conversation_agent: z.boolean(),
    should_ask_clarification_first: z.boolean(),
    response_guidance: z.array(z.string().trim().min(1).max(180)).max(10),
    personalization_cues: z.array(z.string().trim().min(1).max(180)).max(8),
    risk_notes: z.array(z.string().trim().min(1).max(180)).max(8),
  }),
  pending_operation_resolution: z.enum([
    "none",
    "execute",
    "replace",
    "cancel",
  ]),
  financial_resolution: PlanningFinancialResolutionSchema,
  style_update: z
    .object({
      operation: z.enum(["none", "set", "reset"]),
      instruction: z.string().trim().min(1).max(300).nullable(),
      response_length: ConversationStyleProfileSchema.shape.response_length,
      formality: ConversationStyleProfileSchema.shape.formality,
      warmth: ConversationStyleProfileSchema.shape.warmth,
      playfulness: ConversationStyleProfileSchema.shape.playfulness,
      directness: ConversationStyleProfileSchema.shape.directness,
      emoji_policy: ConversationStyleProfileSchema.shape.emoji_policy,
      scope: z.enum(["turn", "session", "persistent"]),
      confidence: z.number().min(0).max(1),
    })
    .nullable(),
  selected_tools: z.array(ConversationToolNameSchema).max(8),
  response_strategy: z.enum([
    "acknowledge",
    "clarify",
    "confirm",
    "explain",
    "mixed",
  ]),
  requires_confirmation: z.boolean(),
  risk_flags: z.array(z.string().trim().min(1).max(120)).max(8),
  confidence: z.number().min(0).max(1),
});
export type OrchestrationPlan = z.infer<typeof OrchestrationPlanSchema>;

export type OrchestrationPlanningContextPack = {
  context_pack_type: "orchestration_context";
  version: "v1";
  user_id: string;
  locale: "es-PE";
  timezone: string;
  channel: "whatsapp" | "dashboard";
  original_message: string;
  received_at: string;
  kernel_hint: {
    query: ConversationQuery;
    turn_state: ConversationTurnState;
  };
  active_conversation_state: {
    state_id: string | null;
    last_intent: string | null;
    last_query_kind: string | null;
    last_query_text: string | null;
    last_result_summary: string | null;
    referenced_movement_count: number;
    referenced_entity_count: number;
    continuity_hint: string | null;
    expires_at: string | null;
    working_set: import("@/agents/conversation-agent/types").ConversationWorkingSet | null;
  };
  active_financial_state: {
    capture_draft: {
      state_id: string;
      reason: string;
      original_message: string;
      created_at: string;
      proposed_actions_count: number;
      missing_facts: string[];
    } | null;
    pending_candidates: Array<{
      pending_code: string;
      title: string | null;
      subtitle: string | null;
      amount: number | null;
      currency: "PEN" | "USD" | null;
      occurred_at: string | null;
      created_at: string;
      proposed_action: string | null;
      movement_type: string | null;
      account_hint: string | null;
      account_origin_hint: string | null;
      account_destination_hint: string | null;
      account_origin_id: string | null;
      account_destination_id: string | null;
    }>;
    account_options: Array<{
      account_id: string;
      name: string;
      institution: string | null;
      currency: string;
      is_default: boolean;
    }>;
    category_options: Array<{
      category_id: CategoryId;
      label: string;
    }>;
  };
  capability_catalog: Array<{
    name: PlanningCapability;
    kind: PlanningStepKind;
    read_only: boolean;
    description: string;
  }>;
  constraints: string[];
};

export type OrchestrationPlanningResult = {
  output: OrchestrationPlan;
  runtime: {
    provider: string;
    model_name?: string;
    latency_ms: number;
    cost_estimate?: number;
  };
  tool_calls: Array<{
    tool_name: string;
    status: "skipped" | "called" | "failed";
  }>;
  safety: {
    policy_flags: string[];
    redaction_applied: boolean;
  };
};

export const ORCHESTRATION_CAPABILITY_CATALOG: OrchestrationPlanningContextPack["capability_catalog"] = [
  {
    name: "data_agent",
    kind: "agent",
    read_only: false,
    description: "Extrae propuestas financieras estructuradas; no escribe dinero.",
  },
  {
    name: "conversation_agent",
    kind: "agent",
    read_only: true,
    description: "Responde preguntas financieras a partir de evidencia read-only.",
  },
  {
    name: "correction_agent",
    kind: "agent",
    read_only: false,
    description: "Propone correcciones; nunca las aplica sin flujo seguro.",
  },
  {
    name: "response_agent",
    kind: "response",
    read_only: true,
    description: "Redacta la respuesta final sin cambiar hechos ni decisiones.",
  },
  {
    name: "get_balance_snapshot",
    kind: "tool",
    read_only: true,
    description: "Consulta saldos, cajas, compromisos y dinero libre.",
  },
  {
    name: "query_movements",
    kind: "tool",
    read_only: true,
    description: "Busca movimientos confirmados y referencias activas.",
  },
  {
    name: "get_pending_summary",
    kind: "tool",
    read_only: true,
    description: "Consulta pendientes sin afectar saldos.",
  },
  {
    name: "get_debt_summary",
    kind: "tool",
    read_only: true,
    description: "Consulta deudas, personas y cuotas.",
  },
  {
    name: "get_debt_details",
    kind: "tool",
    read_only: true,
    description:
      "Consulta el detalle completo de una deuda: calendario de cuotas, pagos, asignaciones y diferencias entre saldo actual y calendario.",
  },
  {
    name: "get_recurring_summary",
    kind: "tool",
    read_only: true,
    description: "Consulta pagos que vienen y recurrentes.",
  },
  {
    name: "search_financial_memory",
    kind: "tool",
    read_only: true,
    description: "Consulta preferencias, personas, correcciones y estado resumido.",
  },
  {
    name: "get_classification_catalog",
    kind: "tool",
    read_only: true,
    description: "Consulta categorias, subcategorias, tags y personas disponibles para clasificar sin inventar IDs.",
  },
  {
    name: "get_pending_details",
    kind: "tool",
    read_only: true,
    description: "Consulta el detalle seguro de pendientes y su estado sin tocar saldos.",
  },
  {
    name: "get_financial_structure",
    kind: "tool",
    read_only: true,
    description: "Consulta cuentas, cajas, moneda, saldos y relaciones de estructura financiera.",
  },
  {
    name: "get_insights",
    kind: "tool",
    read_only: true,
    description: "Consulta descubrimientos vigentes, estado, evidencia resumida y siguiente accion.",
  },
  {
    name: "get_insight_evidence",
    kind: "tool",
    read_only: true,
    description: "Consulta la evidencia trazable de un descubrimiento cuando existe una referencia resoluble.",
  },
  {
    name: "get_record_provenance",
    kind: "tool",
    read_only: true,
    description: "Consulta origen, trazabilidad y auditoria resumida de movimientos referenciados.",
  },
  {
    name: "get_user_context_summary",
    kind: "tool",
    read_only: true,
    description: "Consulta preferencias, estilo, personas, correcciones y memoria relevante sin exponer historial crudo.",
  },
  {
    name: "get_spending_summary",
    kind: "tool",
    read_only: true,
    description: "Agrupa movimientos confirmados por categoria, subcategoria, persona o tag para responder analisis.",
  },
  {
    name: "policy_gate",
    kind: "policy_check",
    read_only: true,
    description: "Aplica privacidad, riesgo y confirmaciones obligatorias.",
  },
  {
    name: "command_dispatcher",
    kind: "core_command",
    read_only: false,
    description: "Unica via autorizada para que Core ejecute dinero tras validacion.",
  },
];

export function defaultToolsForConversationQuery(
  kind: ConversationQuery["kind"]
): ConversationToolName[] {
  switch (kind) {
    case "balance_snapshot":
      return ["get_balance_snapshot"];
    case "movement_search":
      return ["query_movements"];
    case "pending_summary":
      return ["get_pending_summary"];
    case "debt_summary":
      return ["get_debt_summary", "get_debt_details"];
    case "recurring_summary":
      return ["get_recurring_summary"];
    case "financial_memory_search":
      return ["search_financial_memory"];
    default:
      return [];
  }
}

export function buildSafePlanningContext(input: {
  userId: string;
  timezone: string;
  channel: "whatsapp" | "dashboard";
  originalMessage: string;
  receivedAt: string;
  query: ConversationQuery;
  turnState: ConversationTurnState;
  activeMemoryState?: OrchestrationPlanningContextPack["active_conversation_state"];
  activeFinancialState?: OrchestrationPlanningContextPack["active_financial_state"];
}): OrchestrationPlanningContextPack {
  return {
    context_pack_type: "orchestration_context",
    version: "v1",
    user_id: input.userId,
    locale: "es-PE",
    timezone: input.timezone,
    channel: input.channel,
    original_message: input.originalMessage,
    received_at: input.receivedAt,
    kernel_hint: {
      query: input.query,
      turn_state: ConversationTurnStateSchema.parse(input.turnState),
    },
    active_conversation_state: input.activeMemoryState ?? {
      state_id: null,
      last_intent: null,
      last_query_kind: null,
      last_query_text: null,
      last_result_summary: null,
      referenced_movement_count: 0,
      referenced_entity_count: 0,
      continuity_hint: null,
      expires_at: null,
      working_set: null,
    },
    active_financial_state: input.activeFinancialState ?? {
      capture_draft: null,
      pending_candidates: [],
      account_options: [],
      category_options: [],
    },
    capability_catalog: ORCHESTRATION_CAPABILITY_CATALOG,
    constraints: [
      "El plan no puede escribir base de datos ni ejecutar comandos financieros.",
      "Solo ToolGateway ejecuta herramientas read-only autorizadas.",
      "Solo PolicyGate y CommandDispatcher pueden habilitar una escritura financiera.",
      "No uses historial crudo, secretos, SQL ni datos fuera del Context Pack.",
      "Pendientes no afectan saldos hasta confirmacion explicita.",
      "El plan puede interpretar revision, asignacion, reclasificacion, confirmacion o descarte, pero el dominio valida el objetivo exacto, los IDs, la moneda y la autorizacion antes de editar o ejecutar.",
      "Solo selecciona account_id y category_id presentes en active_financial_state; nunca inventes IDs.",
      "Reclasificar o asignar una cuenta solo edita el Pendiente y debe volver a pedir confirmacion.",
      "learn_account_aliases solo puede ser true si el usuario pide recordar la relacion o asocia explicitamente una pista bancaria con una cuenta.",
      "La respuesta final debe separarse de la decision y basarse en evidencia.",
    ],
  };
}
