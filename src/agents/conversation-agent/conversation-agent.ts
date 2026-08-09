import {
  createDefaultAgentRuntime,
  AgentRuntimeError,
  getAgentRuntimeTimeoutMs,
  getAgentRuntimeProvider,
  readAgentRuntimeConfig,
  type AgentRuntime,
  type ToolCallSummary,
} from "@/agents/runtime";
import {
  ConversationalAnswerSchema,
  type ConversationalAnswer,
  type ConversationContextPack,
} from "./types";
import { composeConversationAnswer } from "./local-fixture-runtime";

export class ConversationAgent {
  constructor(
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime(),
    private readonly allowDeterministicGroundingFallback: boolean =
      readAgentRuntimeConfig().localFixtureAllowed
  ) {}

  async answer(contextPack: ConversationContextPack, traceId: string): Promise<{
    output: ConversationalAnswer;
    runtime: {
      provider: string;
      model_name?: string;
      latency_ms: number;
      cost_estimate?: number;
    };
    tool_calls: ToolCallSummary[];
    safety: {
      policy_flags: string[];
      redaction_applied: boolean;
    };
  }> {
    const availableResults = new Map(
      contextPack.tool_results.map((result) => [result.tool_name, result])
    );
    const tools = CONVERSATION_TOOLS.filter((tool) =>
      availableResults.has(tool.name)
    );
    const run = (context: ConversationContextPack, runTraceId: string) =>
      this.runtime.run<ConversationContextPack, ConversationalAnswer>({
        agent_name: "conversation_agent",
        provider: getAgentRuntimeProvider("conversation_agent"),
        model_hint: "balanced",
        context_pack: context,
        tools,
        output_schema: "ConversationalAnswerSchema@v1",
        trace_id: runTraceId,
        timeout_ms: getAgentRuntimeTimeoutMs("conversation_agent", 20_000),
        max_tool_rounds: 4,
        tool_executor: async ({ tool_name }) => {
          const result = availableResults.get(tool_name);
          if (!result) {
            throw new Error(`Tool no autorizada para este turno: ${tool_name}.`);
          }
          return result;
        },
      });

    const response = await run(contextPack, traceId);
    const output = ConversationalAnswerSchema.parse(response.output);
    const groundingIssues = validateConversationGrounding(contextPack, output);

    if (groundingIssues.length === 0) {
      return {
        output,
        runtime: response.runtime,
        tool_calls: response.tool_calls,
        safety: response.safety,
      };
    }

    const repairedResponse = await run(
      {
        ...contextPack,
        data_limits: [
          ...contextPack.data_limits,
          `GROUNDING_REPAIR_REQUIRED: ${groundingIssues.join(" ")} Responde completamente en este turno usando los tool_results disponibles. No anuncies trabajo futuro.`,
        ],
      },
      `${traceId}-grounding-repair`
    );
    const repairedOutput = ConversationalAnswerSchema.parse(
      repairedResponse.output
    );
    const repairedIssues = validateConversationGrounding(
      contextPack,
      repairedOutput
    );

    if (repairedIssues.length === 0) {
      return {
        output: {
          ...repairedOutput,
          safety_flags: [
            ...new Set([
              ...repairedOutput.safety_flags,
              "grounding_repair_applied",
            ]),
          ],
        },
        runtime: {
          ...repairedResponse.runtime,
          latency_ms:
            response.runtime.latency_ms + repairedResponse.runtime.latency_ms,
        },
        tool_calls: repairedResponse.tool_calls,
        safety: {
          ...repairedResponse.safety,
          policy_flags: [
            ...new Set([
              ...repairedResponse.safety.policy_flags,
              "grounding_repair_applied",
            ]),
          ],
        },
      };
    }

    if (!this.allowDeterministicGroundingFallback) {
      throw new AgentRuntimeError(
        "RUNTIME_INVALID_RESPONSE",
        "ConversationAgent no logro una respuesta grounded despues del intento de reparacion.",
        {
          provider: getAgentRuntimeProvider("conversation_agent"),
          cause: {
            grounding_issues: repairedIssues,
            trace_id: traceId,
          },
        }
      );
    }

    const fallback = composeConversationAnswer(contextPack);

    return {
      output: {
        ...fallback,
        safety_flags: [
          ...new Set([...fallback.safety_flags, "grounding_fallback_applied"]),
        ],
      },
      runtime: {
        ...repairedResponse.runtime,
        model_name: `${repairedResponse.runtime.model_name ?? "unknown"}+grounding-fallback`,
        latency_ms:
          response.runtime.latency_ms + repairedResponse.runtime.latency_ms,
      },
      tool_calls: fallback.used_tools.map((toolName) => ({
        tool_name: toolName,
        status: "called" as const,
      })),
      safety: {
        policy_flags: [
          ...new Set([
            ...repairedResponse.safety.policy_flags,
            "grounding_fallback_applied",
          ]),
        ],
        redaction_applied: repairedResponse.safety.redaction_applied,
      },
    };
  }
}

export function validateConversationGrounding(
  contextPack: ConversationContextPack,
  answer: ConversationalAnswer
): string[] {
  const issues: string[] = [];
  const calledTools = new Set(
    contextPack.tool_results
      .filter((result) => result.status === "called")
      .map((result) => result.tool_name)
  );
  const normalizedText = normalizeForPolicy(answer.response_text);

  for (const toolName of answer.used_tools) {
    if (!calledTools.has(toolName)) {
      issues.push(`La respuesta atribuye datos a una herramienta no ejecutada: ${toolName}.`);
    }
  }

  if (
    contextPack.query.kind !== "unsupported" &&
    calledTools.size > 0 &&
    answer.answer_kind !== "clarification" &&
    answer.answer_kind !== "unsupported" &&
    answer.used_tools.length === 0
  ) {
    issues.push("La respuesta financiera no cita ninguna herramienta ejecutada.");
  }

  if (containsUnsupportedDeferredPromise(normalizedText)) {
    issues.push("La respuesta promete trabajo futuro que no existe en este turno.");
  }

  if (
    calledTools.has("query_movements") &&
    /\b(no puedo confirmar si hubo|todavia no tengo una consulta|aun no tengo una consulta)\b/.test(
      normalizedText
    )
  ) {
    issues.push("La respuesta niega una consulta de movimientos que ya fue ejecutada.");
  }

  return issues;
}

function containsUnsupportedDeferredPromise(text: string): boolean {
  return (
    /\b(volvere|te avisare|te escribire|lo hare despues|lo hare luego|consultare despues|revisare despues|revisare luego)\b/.test(
      text
    ) ||
    /\b(por ahora|de momento)\b.{0,100}\b(no puedo confirmar|luego|despues|mas adelante)\b/.test(
      text
    )
  );
}

function normalizeForPolicy(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const EMPTY_TOOL_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

const CONVERSATION_TOOLS = [
  {
    name: "get_balance_snapshot",
    description:
      "Consulta el resumen confirmado de saldos, cajas, compromisos y dinero libre.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "query_movements",
    description:
      "Consulta movimientos confirmados para el periodo y filtros ya resueltos en el Context Pack.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_pending_summary",
    description:
      "Consulta pendientes activos; estos datos no afectan saldos hasta confirmacion.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_debt_summary",
    description:
      "Consulta deudas, personas y cuotas relevantes sin modificar su estado.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_debt_details",
    description:
      "Consulta el detalle completo de una deuda nombrada: calendario de cuotas, pagos, asignaciones y diferencias entre saldo actual y calendario, sin modificar su estado.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_recurring_summary",
    description:
      "Consulta pagos que vienen y recurrentes relevantes sin marcarlos como pagados.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "search_financial_memory",
    description:
      "Consulta memoria resumida autorizada: preferencias, aliases, personas, correcciones y continuidad.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_classification_catalog",
    description:
      "Consulta categorias, subcategorias, tags y personas disponibles para clasificar con evidencia.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_pending_details",
    description:
      "Consulta el detalle seguro de pendientes y su estado sin afectar saldos.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_financial_structure",
    description:
      "Consulta cuentas, cajas, monedas y saldos de la estructura financiera.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_insights",
    description:
      "Consulta descubrimientos vigentes, su estado y acciones sugeridas.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_insight_evidence",
    description:
      "Consulta evidencia trazable de un descubrimiento referenciado por la conversacion.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_record_provenance",
    description:
      "Consulta origen y auditoria resumida de movimientos referenciados.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_user_context_summary",
    description:
      "Consulta preferencias, estilo, personas, correcciones y memoria relevante.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_spending_summary",
    description:
      "Agrupa por categoria los movimientos ya filtrados del turno.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_budget_summary",
    description:
      "Consulta presupuestos del periodo con lo gastado, lo que queda y su banda.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_report_period",
    description:
      "Consulta el reporte oficial del periodo: gasto, ingreso, categorias y exclusiones.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
  {
    name: "get_projection_snapshot",
    description:
      "Consulta la proyeccion del mes: dinero libre, ritmo diario y cierre proyectado.",
    readOnly: true,
    input_schema: EMPTY_TOOL_INPUT_SCHEMA,
  },
] as const;
