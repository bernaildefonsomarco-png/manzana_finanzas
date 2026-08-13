import {
  AgentRuntimeError,
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type ToolCallSummary,
  type ToolDefinition,
} from "@/agents/runtime";
import {
  validateConversationGrounding,
} from "@/agents/conversation-agent/conversation-agent";
import {
  ConversationToolNameSchema,
  type ConversationToolName,
  type ConversationToolResult,
} from "@/agents/conversation-agent/types";
import {
  CATEGORY_IDS,
  MOVEMENT_SOURCES,
  MOVEMENT_TYPES,
} from "@/shared/types/domain";
import {
  ConversationalExecutiveOutputSchema,
  ExecutiveToolCallInputSchema,
  type ConversationalExecutiveContextPack,
  type ConversationalExecutiveOutput,
  type ExecutiveToolCallInput,
} from "./types";
import {
  compileExecutiveEvidenceAndPolicy,
  rejectedExecutiveActionSurfaces,
  withExecutiveSurfaces,
  type ExecutiveActionSurface,
  type ExecutivePolicyIssue,
} from "./evidence-and-policy-compiler";
import { logger } from "@/shared/telemetry/logger";

export type ConversationalExecutiveToolExecutor = (
  toolName: ConversationToolName,
  input: ExecutiveToolCallInput
) => Promise<ConversationToolResult>;

/**
 * `WEB-D297`: el veredicto de validacion viaja **con** el resultado en vez de
 * desaparecer dentro de una excepcion.
 *
 * `accepted: false` significa exactamente una cosa: la respuesta compuesta por
 * el ejecutivo no se puede usar. No significa que el turno no entendio nada.
 * Lo que la persona pidio hacer sigue en `output`, salvo los modulos que el
 * propio veredicto reprocho, que ya vienen en `null` (ver
 * `rejectedExecutiveActionSurfaces`).
 */
export type ExecutiveCompilationVerdict = {
  accepted: boolean;
  issues: ExecutivePolicyIssue[];
  /**
   * Modulos de accion que el ejecutivo si trajo y este turno **no** va a
   * honrar. No es telemetria: es la lista de cosas que hay que decirle a la
   * persona que no se hicieron.
   */
  dropped_action_intents: ExecutiveActionSurface[];
};

export type ConversationalExecutiveRunResult = {
  output: ConversationalExecutiveOutput;
  compilation: ExecutiveCompilationVerdict;
  runtime: {
    provider: string;
    model_name?: string;
    latency_ms: number;
    cost_estimate?: number;
  };
  tool_calls: ToolCallSummary[];
  tool_results: ConversationToolResult[];
  safety: {
    policy_flags: string[];
    redaction_applied: boolean;
  };
};

export class ConversationalExecutiveAgent {
  constructor(
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime()
  ) {}

  async run(
    contextPack: ConversationalExecutiveContextPack,
    traceId: string,
    executeTool: ConversationalExecutiveToolExecutor
  ): Promise<ConversationalExecutiveRunResult> {
    // El historial viaja dentro del pack solo para cruzar el coordinador;
    // aqui se separa: los turnos previos van como mensajes reales del
    // runtime y el Context Pack serializado sigue describiendo solo el turno
    // actual, sin duplicar la conversacion.
    const conversationHistory = contextPack.conversation_history ?? [];
    let attemptContext = withoutConversationHistory(contextPack);
    let accumulatedLatencyMs = 0;
    let accumulatedCost = 0;
    let hasCost = false;
    const accumulatedToolCalls: ToolCallSummary[] = [];
    let lastRejection: RejectedAttempt | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const toolResults: ConversationToolResult[] = [];
      const response = await this.runtime.run<
        ConversationalExecutiveContextPack,
        ConversationalExecutiveOutput
      >({
        agent_name: "conversational_executive_agent",
        provider: getAgentRuntimeProvider("conversational_executive_agent"),
        model_hint: "strong",
        context_pack: attemptContext,
        conversation_history: conversationHistory,
        tools: EXECUTIVE_TOOLS,
        output_schema: "ConversationalExecutiveOutputSchema@v1",
        trace_id: traceId,
        timeout_ms: getAgentRuntimeTimeoutMs(
          "conversational_executive_agent",
          30_000
        ),
        max_tool_rounds: 8,
        tool_executor: async ({ tool_name, arguments: rawArguments }) => {
          const toolName = ConversationToolNameSchema.parse(tool_name);
          const input = ExecutiveToolCallInputSchema.parse(rawArguments);
          const result = await executeTool(toolName, input);
          toolResults.push(result);
          return result;
        },
      });
      accumulatedLatencyMs += response.runtime.latency_ms;
      accumulatedToolCalls.push(...response.tool_calls);
      if (typeof response.runtime.cost_estimate === "number") {
        accumulatedCost += response.runtime.cost_estimate;
        hasCost = true;
      }

      // Una salida que ni siquiera valida contra el esquema no tiene intencion
      // que rescatar: no es "lo dijo mal", es que no dijo nada tipado. Sigue
      // saliendo por excepcion y sin reintento, igual que antes de `WEB-D297`.
      const output = ConversationalExecutiveOutputSchema.parse(response.output);

      // `WEB-D297`: coherencia y evidencia se validan juntas y con la misma
      // forma. Antes la coherencia lanzaba primero y la evidencia despues, y
      // ese orden hacia que el turno perdiera cosas distintas segun cual
      // fallara; ahora hay un solo veredicto con una sola lista de reproches,
      // cada uno con el modulo al que apunta.
      const issues: ExecutivePolicyIssue[] = [
        ...validateExecutiveConsistency({ contextPack, output, toolResults }),
        ...compileExecutiveEvidenceAndPolicy({
          contextPack,
          output,
          toolResults,
        }).issues,
      ];

      if (issues.length === 0) {
        return {
          output,
          compilation: {
            accepted: true,
            issues: [],
            dropped_action_intents: [],
          },
          runtime: {
            ...response.runtime,
            latency_ms: accumulatedLatencyMs,
            ...(hasCost ? { cost_estimate: accumulatedCost } : {}),
          },
          tool_calls: accumulatedToolCalls,
          tool_results: toolResults,
          safety: {
            ...response.safety,
            policy_flags: [
              ...new Set([
                ...response.safety.policy_flags,
                "single_semantic_turn_authority",
                "typed_internal_modules",
                "evidence_and_policy_compiler_accepted",
                "no_direct_financial_write",
                ...(attempt === 2
                  ? ["structured_regeneration_applied"]
                  : []),
              ]),
            ],
          },
        };
      }

      lastRejection = { output, issues, response, toolResults };
      if (attempt === 1) {
        const feedback = feedbackFromIssues(issues);
        attemptContext = {
          ...withoutConversationHistory(contextPack),
          validation_feedback: {
            attempt: 2,
            issue_codes: feedback.issueCodes,
            instructions: feedback.instructions,
          },
        };
      }
    }

    if (!lastRejection) {
      throw new AgentRuntimeError(
        "RUNTIME_INVALID_RESPONSE",
        "ConversationalExecutiveAgent no produjo una salida valida.",
        {
          provider: getAgentRuntimeProvider("conversational_executive_agent"),
        },
      );
    }

    // `WEB-D297`: segundo rechazo. Hasta aqui esto lanzaba, el coordinador lo
    // atrapaba y el turno se quedaba sin ejecutivo: las cinco ramas de accion
    // recibian `null` y la orden que la persona acababa de dar desaparecia sin
    // que nadie se lo dijera. El rechazo es sobre **como se dice** la
    // respuesta; lo que se pidio hacer no deja de ser cierto porque el copy
    // cite mal una evidencia.
    //
    // Asi que la respuesta se descarta —el turno la compone por la via
    // degradada, como siempre— y la intencion sobrevive, salvo la que el propio
    // veredicto reprocha, que sale en `dropped_action_intents` para que el
    // turno pueda decir que no se hizo.
    const { output: honoredOutput, dropped } = quarantineActionIntents(
      lastRejection.output,
      lastRejection.issues,
    );
    logger.warn("conversational_executive.compilation_rejected", {
      trace_id: traceId,
      issue_codes: lastRejection.issues.map((issue) => issue.code),
      rejected_surfaces: [
        ...new Set(lastRejection.issues.map((issue) => issue.surface)),
      ],
      dropped_action_intents: dropped,
    });

    return {
      output: honoredOutput,
      compilation: {
        accepted: false,
        issues: lastRejection.issues,
        dropped_action_intents: dropped,
      },
      runtime: {
        ...lastRejection.response.runtime,
        latency_ms: accumulatedLatencyMs,
        ...(hasCost ? { cost_estimate: accumulatedCost } : {}),
      },
      tool_calls: accumulatedToolCalls,
      tool_results: lastRejection.toolResults,
      safety: {
        ...lastRejection.response.safety,
        policy_flags: [
          ...new Set([
            ...lastRejection.response.safety.policy_flags,
            "single_semantic_turn_authority",
            "typed_internal_modules",
            "evidence_and_policy_compiler_rejected",
            "executive_response_discarded",
            "no_direct_financial_write",
            "structured_regeneration_applied",
          ]),
        ],
      },
    };
  }
}

type RejectedAttempt = {
  output: ConversationalExecutiveOutput;
  issues: ExecutivePolicyIssue[];
  response: {
    runtime: ConversationalExecutiveRunResult["runtime"];
    safety: ConversationalExecutiveRunResult["safety"];
  };
  toolResults: ConversationToolResult[];
};

/**
 * `WEB-D297`: deja en `null` los modulos de accion que el veredicto reprocha,
 * para que nadie aguas abajo pueda leer una intencion que este turno decidio no
 * honrar. La salida y la lista de descartes salen del mismo sitio: no hay dos
 * fuentes que mantener sincronizadas.
 */
export function quarantineActionIntents(
  output: ConversationalExecutiveOutput,
  issues: ExecutivePolicyIssue[],
): {
  output: ConversationalExecutiveOutput;
  dropped: ExecutiveActionSurface[];
} {
  const rejected = new Set(rejectedExecutiveActionSurfaces(issues));
  if (rejected.size === 0) return { output, dropped: [] };

  // `!= null` y no `!== null` a proposito: un estado o fixture escrito antes de
  // que existiera un modulo trae el campo **ausente**, no en `null`, y con la
  // comparacion estricta ese hueco se anunciaba como "lo pediste y no lo hice"
  // sobre algo que la persona nunca pidio. Ausente y `null` significan lo mismo
  // aqui: este turno no pedia ese modulo.
  const dropped = [...rejected].filter((surface) => output[surface] != null);
  return {
    output: {
      ...output,
      memory_control: rejected.has("memory_control")
        ? null
        : output.memory_control,
      structure_proposal: rejected.has("structure_proposal")
        ? null
        : output.structure_proposal,
      light_action: rejected.has("light_action") ? null : output.light_action,
      profile_signal: rejected.has("profile_signal")
        ? null
        : output.profile_signal,
      preference_change: rejected.has("preference_change")
        ? null
        : output.preference_change,
      debt_action: rejected.has("debt_action") ? null : output.debt_action,
      money_action: rejected.has("money_action") ? null : output.money_action,
      movement_action: rejected.has("movement_action")
        ? null
        : output.movement_action,
    },
    dropped,
  };
}

/**
 * El pack que se serializa al modelo no lleva el historial: los turnos
 * previos ya se le entregan como mensajes propios. Duplicarlos dentro del
 * JSON solo gastaria contexto y volveria a presentar la conversacion como
 * un dato mas del formulario.
 */
function withoutConversationHistory(
  contextPack: ConversationalExecutiveContextPack,
): ConversationalExecutiveContextPack {
  if (!contextPack.conversation_history) return contextPack;
  const { conversation_history: _historial, ...rest } = contextPack;
  return rest;
}

function feedbackFromIssues(issues: ExecutivePolicyIssue[]): {
  issueCodes: string[];
  instructions: string[];
} {
  return {
    issueCodes: issues.map((issue) => issue.code),
    instructions: issues.map((issue) => issue.message),
  };
}

/**
 * `WEB-D297`: la coherencia entre modulos devuelve incidencias en vez de
 * lanzar. El cambio no relaja nada —las mismas cinco comprobaciones, los
 * mismos rechazos— pero ahora cada una dice a que modulo apunta, y eso es lo
 * que permite distinguir "no se puede decir asi" de "no se puede hacer".
 *
 * Los desacuerdos entre `turn_interpretation` y el plan salen anclados a
 * `turn_interpretation` a proposito: si el modelo se contradice sobre que turno
 * es este, tampoco se le cree lo que dice que la persona pidio hacer.
 */
function validateExecutiveConsistency(input: {
  contextPack: ConversationalExecutiveContextPack;
  output: ConversationalExecutiveOutput;
  toolResults: ConversationToolResult[];
}): ExecutivePolicyIssue[] {
  const { output } = input;
  const issues: Array<Omit<ExecutivePolicyIssue, "surface">> = [];

  if (
    output.turn_interpretation.goal !== output.orchestration_plan.goal ||
    output.turn_interpretation.workflow !== output.orchestration_plan.workflow
  ) {
    issues.push({
      code: "interpretation_plan_mismatch",
      path: "turn_interpretation.goal",
      message: "turn_interpretation y orchestration_plan no coinciden.",
    });
  }

  if (
    output.orchestration_plan.semantic_query !== null &&
    JSON.stringify(output.turn_interpretation.semantic_query) !==
      JSON.stringify(output.orchestration_plan.semantic_query)
  ) {
    issues.push({
      code: "semantic_query_mismatch",
      path: "turn_interpretation.semantic_query",
      message: "semantic_query difiere entre interpretacion y plan.",
    });
  }

  const allowedMovementIds = new Set([
    ...input.contextPack.data_context.recent_movements.map(
      (movement) => movement.id
    ),
    ...(input.contextPack.conversation_context.active_conversation_state
      .working_set?.focus_set?.ordered_ids ?? []),
  ]);
  const inventedMovementIds =
    output.reference_resolution.candidate_movement_ids.filter(
      (movementId) => !allowedMovementIds.has(movementId)
    );
  if (inventedMovementIds.length > 0) {
    issues.push({
      code: "reference_ids_invented",
      path: "reference_resolution.candidate_movement_ids",
      message: `reference_resolution invento IDs: ${inventedMovementIds.join(",")}.`,
    });
  }

  const selectedTools = new Set(output.orchestration_plan.selected_tools);
  for (const request of output.tool_requests) {
    if (!selectedTools.has(request.tool_name)) {
      issues.push({
        code: "tool_request_not_planned",
        path: `tool_requests.${request.request_id}`,
        message: `tool_request ${request.tool_name} no esta autorizada por el plan.`,
      });
    }
  }

  const effectiveConversationContext = {
    ...input.contextPack.conversation_context,
    query: output.turn_interpretation.semantic_query,
    turn_state: output.turn_interpretation.semantic_turn,
    tool_results: input.toolResults,
  };
  const groundingIssues = validateConversationGrounding(
    effectiveConversationContext,
    output.response_composition
  );
  if (
    output.orchestration_plan.workflow === "conversation_read_only" ||
    output.orchestration_plan.workflow === "support"
  ) {
    // Un fallo de grounding es un reproche a la redaccion, no a la orden: por
    // eso queda anclado a `response_composition` y no arrastra las acciones.
    issues.push(
      ...groundingIssues.map((message) => ({
        code: "grounding_without_evidence" as const,
        path: "response_composition.response_text",
        message,
      })),
    );
  }

  return withExecutiveSurfaces(issues);
}

// `20b` S5.2: la forma de "consultar_datos_abiertos" — solo lo que el
// compilador de `src/core/semantics` traduce hoy (`WEB-D257`/`WEB-D258`):
// predicados "y" de comparaciones simples, sin "o"/"no"/subconsultas.
const SEMANTIC_QUERY_INPUT_SCHEMA = {
  anyOf: [
    {
      type: "object",
      properties: {
        de: { type: "string", enum: ["movimientos"] },
        donde: {
          anyOf: [
            {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["comparacion"] },
                dimension: { type: "string" },
                comparador: {
                  type: "string",
                  enum: ["=", "!=", ">", ">=", "<", "<=", "entre", "en", "contiene"],
                },
                valor: {
                  anyOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                    { type: "array", items: { type: "string" } },
                    { type: "array", items: { type: "number" } },
                    {
                      type: "object",
                      properties: { desde: { type: "string" }, hasta: { type: "string" } },
                      required: ["desde", "hasta"],
                      additionalProperties: false,
                    },
                  ],
                },
              },
              required: ["kind", "dimension", "comparador", "valor"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["y"] },
                de: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: ["comparacion"] },
                      dimension: { type: "string" },
                      comparador: {
                        type: "string",
                        enum: ["=", "!=", ">", ">=", "<", "<=", "entre", "en", "contiene"],
                      },
                      valor: {
                        anyOf: [
                          { type: "string" },
                          { type: "number" },
                          { type: "boolean" },
                          { type: "array", items: { type: "string" } },
                          { type: "array", items: { type: "number" } },
                          {
                            type: "object",
                            properties: { desde: { type: "string" }, hasta: { type: "string" } },
                            required: ["desde", "hasta"],
                            additionalProperties: false,
                          },
                        ],
                      },
                    },
                    required: ["kind", "dimension", "comparador", "valor"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["kind", "de"],
              additionalProperties: false,
            },
            { type: "null" },
          ],
        },
        agrupar_por: { type: "array", items: { type: "string" } },
        medir: { type: "array", items: { type: "string" } },
        ordenar: {
          anyOf: [
            {
              type: "object",
              properties: {
                por: { type: "string" },
                direccion: { type: "string", enum: ["asc", "desc"] },
              },
              required: ["por", "direccion"],
              additionalProperties: false,
            },
            { type: "null" },
          ],
        },
        limitar: { anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }] },
      },
      required: ["de", "donde", "agrupar_por", "medir", "ordenar", "limitar"],
      additionalProperties: false,
    },
    { type: "null" },
  ],
} as const;

const EXECUTIVE_TOOL_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      anyOf: [
      {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: [
            "balance_snapshot",
            "movement_search",
            "pending_summary",
            "debt_summary",
            "recurring_summary",
            "financial_memory_search",
            "unsupported",
          ],
        },
        normalized_text: { type: "string" },
        requested_amount: {
          anyOf: [{ type: "number", exclusiveMinimum: 0 }, { type: "null" }],
        },
        date_range: {
          anyOf: [
            {
              type: "object",
              properties: {
                start: { type: "string" },
                end: { type: "string" },
                label: { type: "string" },
              },
              required: ["start", "end", "label"],
              additionalProperties: false,
            },
            { type: "null" },
          ],
        },
        movement_filters: {
          anyOf: [
            {
              type: "object",
              properties: {
                search_terms: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 12,
                },
                movement_types: {
                  type: "array",
                  items: { type: "string", enum: [...MOVEMENT_TYPES] },
                },
                category_ids: {
                  type: "array",
                  items: { type: "string", enum: [...CATEGORY_IDS] },
                },
                sources: {
                  type: "array",
                  items: { type: "string", enum: [...MOVEMENT_SOURCES] },
                },
                account_terms: {
                  type: "array",
                  items: { type: "string" },
                },
                subcategory_terms: {
                  type: "array",
                  items: { type: "string" },
                },
                person_terms: {
                  type: "array",
                  items: { type: "string" },
                },
                tag_terms: {
                  type: "array",
                  items: { type: "string" },
                },
                uncategorized_only: { type: "boolean" },
              },
              required: [
                "search_terms",
                "movement_types",
                "category_ids",
                "sources",
                "account_terms",
                "subcategory_terms",
                "person_terms",
                "tag_terms",
                "uncategorized_only",
              ],
              additionalProperties: false,
            },
            { type: "null" },
          ],
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: [
        "kind",
        "normalized_text",
        "requested_amount",
        "date_range",
        "movement_filters",
        "confidence",
      ],
      additionalProperties: false,
    },
      { type: "null" },
      ],
    },
    // Solo para "consultar_datos_abiertos" (`20b` S5.2, `WEB-D259`); nulo
    // para las otras 15 tools.
    semantic_query: SEMANTIC_QUERY_INPUT_SCHEMA,
    should_use_active_memory: { type: "boolean" },
  },
  required: ["query", "semantic_query", "should_use_active_memory"],
  additionalProperties: false,
} as const;

const TOOL_DESCRIPTIONS: Record<ConversationToolName, string> = {
  get_balance_snapshot:
    "Consulta saldos confirmados, cajas, compromisos y dinero libre.",
  query_movements:
    "Consulta movimientos confirmados respetando periodo, filtros y focus_set.",
  get_pending_summary:
    "Consulta pendientes sin tratarlos como saldos confirmados.",
  get_debt_summary: "Consulta resumen de deudas, personas y cuotas.",
  get_debt_details:
    "Consulta calendario, pagos y detalle de una deuda referenciada.",
  get_recurring_summary: "Consulta Pagos que vienen y recurrentes.",
  search_financial_memory:
    "Consulta memoria financiera confirmada y continuidad read-only.",
  get_classification_catalog:
    "Consulta categorias, subcategorias, tags y personas disponibles.",
  get_pending_details: "Consulta detalle seguro de pendientes.",
  get_financial_structure:
    "Consulta cuentas, cajas y metas de ahorro con su avance y ritmo mensual.",
  get_insights: "Consulta Descubrimientos vigentes.",
  get_insight_evidence: "Consulta evidencia de un Descubrimiento.",
  get_record_provenance: "Consulta origen y trazabilidad de movimientos.",
  get_user_context_summary:
    "Consulta preferencias, aliases, correcciones y contexto permitido.",
  get_spending_summary:
    "Agrupa por categoria los movimientos ya filtrados del turno. Es una " +
    "vista conversacional sobre un conjunto acotado, no el total oficial de " +
    "un periodo: para eso usa get_report_period.",
  get_budget_summary:
    "Consulta presupuestos y limites del periodo con lo gastado, lo que " +
    "queda, el porcentaje y la banda (holgado/atencion/cerca/superado). " +
    "Usa el date_range del turno para elegir semana, quincena o mes.",
  get_report_period:
    "Consulta el reporte oficial de un periodo: gasto total, ingreso total, " +
    "desglose por categoria, comparacion con el periodo anterior y que " +
    "movimientos quedaron excluidos y por que. Es la misma cifra que " +
    "muestra la pantalla de Reportes.",
  get_projection_snapshot:
    "Consulta la proyeccion del mes en curso: dinero libre, compromisos ya " +
    "descontados, ritmo diario de gasto, dias restantes y cierre proyectado " +
    "con su rango y sus supuestos.",
  get_reminders:
    "Consulta los recordatorios del usuario con su id, titulo y estado. Es la " +
    "unica forma de saber cual posponer o descartar: el id sale de aqui.",
  get_home_preferences:
    "Consulta que bloques del Inicio estan ocultos y cuales visibles, con su " +
    "clave. Es la unica forma de saber que bloque ocultar o mostrar.",
  get_profile_summary:
    "Consulta lo que Manzana sabe de la persona: hechos de perfil confirmados " +
    "(como le pagan, a que se dedica, con quien vive, su preocupacion) y " +
    "candidatos observados que todavia NO estan confirmados. Los confirmados " +
    "se pueden usar para interpretar sus numeros; los candidatos solo para " +
    "preguntar, nunca para calcular ni afirmar.",
  get_email_status:
    "Consulta si el correo del usuario esta conectado, con que cuenta, desde " +
    "cuando y si la captura por correo esta funcionando.",
  consultar_datos_abiertos:
    "Consulta abierta (20b S5): compone de/donde/agrupar_por/medir/ordenar/limitar " +
    "sobre movimientos cuando ninguna de las otras tools cubre la pregunta. " +
    "Usa 'y' para combinar filtros; 'o' y subconsultas no estan disponibles todavia.",
};

export const EXECUTIVE_TOOLS: ToolDefinition[] = Object.entries(
  TOOL_DESCRIPTIONS
).map(([name, description]) => ({
  name,
  description,
  readOnly: true,
  input_schema: EXECUTIVE_TOOL_INPUT_SCHEMA,
}));
