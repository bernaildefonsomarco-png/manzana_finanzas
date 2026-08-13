export const AGENT_NAMES = [
  "conversational_executive_agent",
  "data_agent",
  "email_extraction_agent",
  "conversation_agent",
  "correction_agent",
  "response_agent",
  "orchestration_planning_agent",
  "learning_signal_agent",
  "risk_signal_agent",
  "dedup_signal_agent",
  "disclosure_experience_agent",
  "recurring_signal_agent",
  "nudge_experience_agent",
  "insight_experience_agent",
  "insight_narrator_agent",
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

export type RuntimeProvider = "codex" | "api" | "local_fixture";

export type ModelHint = "cheap" | "balanced" | "strong";

export type ToolDefinition = {
  name: string;
  description: string;
  readOnly: boolean;
  input_schema?: Record<string, unknown>;
};

export type AgentToolExecutionRequest = {
  call_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
};

export type AgentToolExecutor = (
  request: AgentToolExecutionRequest
) => Promise<unknown>;

export type ToolCallSummary = {
  tool_name: string;
  status: "skipped" | "called" | "failed";
};

/**
 * Un turno ya ocurrido del hilo, tal como debe verlo el modelo: un mensaje
 * con autor, no una linea dentro de un JSON. El Context Pack describe el
 * estado del turno actual; esto describe que se dijeron antes.
 */
export type AgentConversationTurn = {
  role: "user" | "assistant";
  text: string;
  /**
   * `077`: el turno no es contiguo — se recupero por significado de un tramo
   * del hilo que quedo fuera de la ventana reciente. Viaja marcado porque
   * presentarlo como un mensaje mas mentiria sobre cuando se dijo.
   */
  recalled?: boolean;
  /** Cuando se dijo, en ISO. Solo se usa para situar un turno recuperado. */
  said_at?: string;
};

export type AgentRuntimeRequest<TContext> = {
  agent_name: AgentName;
  provider: RuntimeProvider;
  model_hint: ModelHint;
  context_pack: TContext;
  /**
   * Historial real del hilo, mas antiguo primero y sin el mensaje del turno
   * actual (ese ya viaja en el Context Pack). Opcional: un agente sin hilo
   * — extraccion de email, senales, insights — simplemente no lo manda.
   */
  conversation_history?: AgentConversationTurn[];
  tools: ToolDefinition[];
  output_schema: string;
  trace_id: string;
  timeout_ms: number;
  tool_executor?: AgentToolExecutor;
  max_tool_rounds?: number;
};

export type AgentRuntimeResponse<TOutput> = {
  output: TOutput;
  confidence: number | null;
  tool_calls: ToolCallSummary[];
  runtime: {
    provider: RuntimeProvider;
    model_name?: string;
    latency_ms: number;
    cost_estimate?: number;
  };
  safety: {
    policy_flags: string[];
    redaction_applied: boolean;
  };
};

export interface AgentRuntime {
  run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>>;
}
