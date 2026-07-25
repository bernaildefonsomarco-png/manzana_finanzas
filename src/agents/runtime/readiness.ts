import {
  getAgentRuntimeProvider,
  readAgentRuntimeConfig,
  type AgentRuntimeConfig,
} from "./config";
import {
  AGENT_NAMES,
  type AgentName,
  type RuntimeProvider,
} from "./types";

export type AgentRuntimeReadinessStatus =
  | "ready"
  | "development_only"
  | "inactive"
  | "blocked";

export type AgentRuntimeReadinessItem = {
  agent_name: AgentName;
  execution_role: "required" | "shadow" | "inactive";
  required_for_readiness: boolean;
  effective_provider: RuntimeProvider;
  runtime_kind: "local_fixture" | "openai" | "http";
  model_name: string | null;
  endpoint_configured: boolean;
  credentials_configured: boolean;
  effective_fallback: "local_fixture" | null;
  status: AgentRuntimeReadinessStatus;
  reasons: string[];
};

export type AgentRuntimeReadinessReport = {
  app_environment: string;
  conversational_executive_mode: AgentRuntimeConfig["conversationalExecutiveMode"];
  local_fixture_allowed: boolean;
  local_fallback_requested: boolean;
  local_fallback_effective: boolean;
  overall_ready: boolean;
  production_safe: boolean;
  summary: {
    ready: number;
    development_only: number;
    inactive: number;
    blocked: number;
  };
  agents: AgentRuntimeReadinessItem[];
};

export function getAgentRuntimeReadiness(
  config: AgentRuntimeConfig = readAgentRuntimeConfig()
): AgentRuntimeReadinessReport {
  const agents = AGENT_NAMES.map((agentName) => {
    const executionRole = getAgentExecutionRole(agentName, config);
    return getAgentReadiness(agentName, executionRole, config);
  });
  const summary = agents.reduce(
    (result, agent) => {
      result[agent.status] += 1;
      return result;
    },
    {
      ready: 0,
      development_only: 0,
      inactive: 0,
      blocked: 0,
    }
  );
  const overallReady = summary.blocked === 0;

  return {
    app_environment: config.appEnvironment,
    conversational_executive_mode: config.conversationalExecutiveMode,
    local_fixture_allowed: config.localFixtureAllowed,
    local_fallback_requested: config.fallbackToLocalRequested,
    local_fallback_effective: config.fallbackToLocal,
    overall_ready: overallReady,
    production_safe:
      !config.localFixtureAllowed &&
      overallReady &&
      agents
        .filter((agent) => agent.required_for_readiness)
        .every((agent) => agent.effective_provider !== "local_fixture"),
    summary,
    agents,
  };
}

function getAgentReadiness(
  agentName: AgentName,
  executionRole: AgentRuntimeReadinessItem["execution_role"],
  config: AgentRuntimeConfig,
): AgentRuntimeReadinessItem {
  const provider = getAgentRuntimeProvider(agentName, config);
  const effectiveFallback = config.fallbackToLocal
    ? ("local_fixture" as const)
    : null;
  const requiredForReadiness = executionRole !== "inactive";

  if (!requiredForReadiness) {
    return {
      agent_name: agentName,
      execution_role: executionRole,
      required_for_readiness: false,
      effective_provider: provider,
      runtime_kind: getRuntimeKind(provider, config),
      model_name: getModelName(provider, config),
      endpoint_configured: false,
      credentials_configured: false,
      effective_fallback: null,
      status: "inactive",
      reasons: [
        `inactive_for_conversational_executive_mode_${config.conversationalExecutiveMode}`,
      ],
    };
  }

  if (provider === "local_fixture") {
    const allowed = config.localFixtureAllowed;
    return {
      agent_name: agentName,
      execution_role: executionRole,
      required_for_readiness: true,
      effective_provider: provider,
      runtime_kind: "local_fixture",
      model_name: "local-fixture-v1",
      endpoint_configured: true,
      credentials_configured: true,
      effective_fallback: null,
      status: allowed ? "development_only" : "blocked",
      reasons: [
        allowed
          ? "local_fixture_enabled_for_development_or_test"
          : "local_fixture_forbidden_outside_development_and_test",
      ],
    };
  }

  if (provider === "api") {
    if (config.api.kind === "openai") {
      const reasons = [
        ...(!config.api.token ? ["openai_credentials_missing"] : []),
        ...(!config.api.modelName ? ["openai_model_missing"] : []),
      ];
      return {
        agent_name: agentName,
        execution_role: executionRole,
        required_for_readiness: true,
        effective_provider: provider,
        runtime_kind: "openai",
        model_name: config.api.modelName,
        endpoint_configured: true,
        credentials_configured: Boolean(config.api.token),
        effective_fallback: effectiveFallback,
        status: reasons.length === 0 ? "ready" : "blocked",
        reasons,
      };
    }

    const reasons = config.api.endpoint ? [] : ["api_endpoint_missing"];
    return {
      agent_name: agentName,
      execution_role: executionRole,
      required_for_readiness: true,
      effective_provider: provider,
      runtime_kind: "http",
      model_name: config.api.modelName,
      endpoint_configured: Boolean(config.api.endpoint),
      credentials_configured: Boolean(config.api.token),
      effective_fallback: effectiveFallback,
      status: reasons.length === 0 ? "ready" : "blocked",
      reasons,
    };
  }

  const reasons = config.codex.endpoint ? [] : ["codex_endpoint_missing"];
  return {
    agent_name: agentName,
    execution_role: executionRole,
    required_for_readiness: true,
    effective_provider: provider,
    runtime_kind: "http",
    model_name: config.codex.modelName,
    endpoint_configured: Boolean(config.codex.endpoint),
    credentials_configured: Boolean(config.codex.token),
    effective_fallback: effectiveFallback,
    status: reasons.length === 0 ? "ready" : "blocked",
    reasons,
  };
}

const LEGACY_INTERACTIVE_AGENTS = new Set<AgentName>([
  "orchestration_planning_agent",
  "data_agent",
  "conversation_agent",
  "correction_agent",
  "response_agent",
]);

function getAgentExecutionRole(
  agentName: AgentName,
  config: AgentRuntimeConfig,
): AgentRuntimeReadinessItem["execution_role"] {
  if (agentName === "conversational_executive_agent") {
    return config.conversationalExecutiveMode === "off"
      ? "inactive"
      : config.conversationalExecutiveMode === "shadow"
        ? "shadow"
        : "required";
  }
  if (LEGACY_INTERACTIVE_AGENTS.has(agentName)) {
    return config.conversationalExecutiveMode === "active"
      ? "inactive"
      : "required";
  }
  return "required";
}

function getRuntimeKind(
  provider: RuntimeProvider,
  config: AgentRuntimeConfig,
): AgentRuntimeReadinessItem["runtime_kind"] {
  if (provider === "local_fixture") return "local_fixture";
  if (provider === "api" && config.api.kind === "openai") return "openai";
  return "http";
}

function getModelName(
  provider: RuntimeProvider,
  config: AgentRuntimeConfig,
): string | null {
  if (provider === "local_fixture") return "local-fixture-v1";
  return provider === "api" ? config.api.modelName : config.codex.modelName;
}
