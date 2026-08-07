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
import { compileExecutiveEvidenceAndPolicy } from "./evidence-and-policy-compiler";

export type ConversationalExecutiveToolExecutor = (
  toolName: ConversationToolName,
  input: ExecutiveToolCallInput
) => Promise<ConversationToolResult>;

export type ConversationalExecutiveRunResult = {
  output: ConversationalExecutiveOutput;
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

      try {
        const output = ConversationalExecutiveOutputSchema.parse(
          response.output,
        );
        validateExecutiveConsistency({
          contextPack,
          output,
          toolResults,
          traceId,
        });
        const compilation = compileExecutiveEvidenceAndPolicy({
          contextPack,
          output,
          toolResults,
        });
        if (!compilation.accepted) {
          throw new AgentRuntimeError(
            "RUNTIME_INVALID_RESPONSE",
            `EvidenceAndPolicyCompiler rechazo la salida: ${compilation.issues
              .map((issue) => issue.message)
              .join(" ")}`,
            {
              provider: getAgentRuntimeProvider(
                "conversational_executive_agent",
              ),
              cause: {
                trace_id: traceId,
                issues: compilation.issues,
              },
            },
          );
        }

        return {
          output,
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
      } catch (error) {
        if (
          attempt === 1 &&
          error instanceof AgentRuntimeError &&
          error.code === "RUNTIME_INVALID_RESPONSE"
        ) {
          const feedback = extractValidationFeedback(error);
          attemptContext = {
            ...withoutConversationHistory(contextPack),
            validation_feedback: {
              attempt: 2,
              issue_codes: feedback.issueCodes,
              instructions: feedback.instructions,
            },
          };
          continue;
        }
        throw error;
      }
    }

    throw new AgentRuntimeError(
      "RUNTIME_INVALID_RESPONSE",
      "ConversationalExecutiveAgent no produjo una salida valida.",
      {
        provider: getAgentRuntimeProvider("conversational_executive_agent"),
      },
    );
  }
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

function extractValidationFeedback(error: AgentRuntimeError): {
  issueCodes: string[];
  instructions: string[];
} {
  const cause =
    error.details.cause &&
    typeof error.details.cause === "object" &&
    "issues" in error.details.cause
      ? (error.details.cause as { issues?: unknown }).issues
      : null;
  if (!Array.isArray(cause)) {
    return {
      issueCodes: ["runtime_invalid_response"],
      instructions: [error.message],
    };
  }

  const issueCodes = cause.map((issue) =>
    issue && typeof issue === "object" && "code" in issue
      ? String((issue as { code: unknown }).code)
      : "consistency_error",
  );
  const instructions = cause.map((issue) =>
    issue && typeof issue === "object" && "message" in issue
      ? String((issue as { message: unknown }).message)
      : String(issue),
  );
  return { issueCodes, instructions };
}

function validateExecutiveConsistency(input: {
  contextPack: ConversationalExecutiveContextPack;
  output: ConversationalExecutiveOutput;
  toolResults: ConversationToolResult[];
  traceId: string;
}) {
  const { output } = input;
  const issues: string[] = [];

  if (
    output.turn_interpretation.goal !== output.orchestration_plan.goal ||
    output.turn_interpretation.workflow !== output.orchestration_plan.workflow
  ) {
    issues.push("turn_interpretation y orchestration_plan no coinciden.");
  }

  if (
    output.orchestration_plan.semantic_query !== null &&
    JSON.stringify(output.turn_interpretation.semantic_query) !==
      JSON.stringify(output.orchestration_plan.semantic_query)
  ) {
    issues.push("semantic_query difiere entre interpretacion y plan.");
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
    issues.push(
      `reference_resolution invento IDs: ${inventedMovementIds.join(",")}.`
    );
  }

  const selectedTools = new Set(output.orchestration_plan.selected_tools);
  for (const request of output.tool_requests) {
    if (!selectedTools.has(request.tool_name)) {
      issues.push(
        `tool_request ${request.tool_name} no esta autorizada por el plan.`
      );
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
    issues.push(...groundingIssues);
  }

  if (issues.length > 0) {
    throw new AgentRuntimeError(
      "RUNTIME_INVALID_RESPONSE",
      `ConversationalExecutiveAgent devolvio modulos inconsistentes: ${issues.join(
        " "
      )}`,
      {
        provider: getAgentRuntimeProvider("conversational_executive_agent"),
        cause: {
          trace_id: input.traceId,
          issues,
        },
      }
    );
  }
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
  get_financial_structure: "Consulta cuentas, cajas y estructura financiera.",
  get_insights: "Consulta Descubrimientos vigentes.",
  get_insight_evidence: "Consulta evidencia de un Descubrimiento.",
  get_record_provenance: "Consulta origen y trazabilidad de movimientos.",
  get_user_context_summary:
    "Consulta preferencias, aliases, correcciones y contexto permitido.",
  get_spending_summary:
    "Agrupa movimientos confirmados por dimensiones financieras.",
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
