import type { AgentName, RuntimeProvider } from "./types";

const PROVIDERS: RuntimeProvider[] = ["local_fixture", "codex", "api"];

export type AgentRuntimeConfig = {
  appEnvironment: string;
  localFixtureAllowed: boolean;
  conversationalExecutiveMode: "off" | "shadow" | "active";
  defaultProvider: RuntimeProvider;
  perAgentProvider: Partial<Record<AgentName, RuntimeProvider>>;
  fallbackToLocalRequested: boolean;
  fallbackToLocal: boolean;
  api: {
    kind: "http" | "openai";
    endpoint: string | null;
    token: string | null;
    modelName: string | null;
  };
  codex: {
    endpoint: string | null;
    token: string | null;
    modelName: string | null;
  };
};

export function readAgentRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): AgentRuntimeConfig {
  const appEnvironment = resolveAppEnvironment(env);
  const localFixtureAllowed = isLocalFixtureAllowed(env);
  const defaultProvider = readProvider(env.AGENT_RUNTIME_DEFAULT_PROVIDER) ??
    readProvider(env.AGENT_RUNTIME_PROVIDER) ??
    (localFixtureAllowed ? "local_fixture" : "api");
  const fallbackToLocalRequested = readBoolean(
    env.AGENT_RUNTIME_FALLBACK_LOCAL,
    localFixtureAllowed
  );

  return {
    appEnvironment,
    localFixtureAllowed,
    conversationalExecutiveMode: readConversationalExecutiveMode(env),
    defaultProvider,
    perAgentProvider: {
      conversational_executive_agent: readProvider(
        env.AGENT_RUNTIME_CONVERSATIONAL_EXECUTIVE_AGENT_PROVIDER
      ),
      data_agent: readProvider(env.AGENT_RUNTIME_DATA_AGENT_PROVIDER),
      email_extraction_agent: readProvider(
        env.AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER
      ),
      response_agent: readProvider(env.AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER),
      conversation_agent: readProvider(env.AGENT_RUNTIME_CONVERSATION_AGENT_PROVIDER),
      correction_agent: readProvider(env.AGENT_RUNTIME_CORRECTION_AGENT_PROVIDER),
      orchestration_planning_agent: readProvider(
        env.AGENT_RUNTIME_ORCHESTRATION_PLANNING_AGENT_PROVIDER
      ),
      learning_signal_agent: readProvider(
        env.AGENT_RUNTIME_LEARNING_SIGNAL_AGENT_PROVIDER
      ),
      risk_signal_agent: readProvider(
        env.AGENT_RUNTIME_RISK_SIGNAL_AGENT_PROVIDER
      ),
      dedup_signal_agent: readProvider(
        env.AGENT_RUNTIME_DEDUP_SIGNAL_AGENT_PROVIDER
      ),
      disclosure_experience_agent: readProvider(
        env.AGENT_RUNTIME_DISCLOSURE_EXPERIENCE_AGENT_PROVIDER
      ),
      recurring_signal_agent: readProvider(
        env.AGENT_RUNTIME_RECURRING_SIGNAL_AGENT_PROVIDER
      ),
      nudge_experience_agent: readProvider(
        env.AGENT_RUNTIME_NUDGE_EXPERIENCE_AGENT_PROVIDER
      ),
      insight_experience_agent: readProvider(
        env.AGENT_RUNTIME_INSIGHT_EXPERIENCE_AGENT_PROVIDER
      ),
      insight_narrator_agent: readProvider(
        env.AGENT_RUNTIME_INSIGHT_NARRATOR_AGENT_PROVIDER
      ),
    },
    fallbackToLocalRequested,
    fallbackToLocal: localFixtureAllowed && fallbackToLocalRequested,
    api: {
      kind: readApiRuntimeKind(env),
      endpoint: readString(env.AGENT_RUNTIME_API_URL),
      token:
        readString(env.AGENT_RUNTIME_API_TOKEN) ??
        readString(env.OPENAI_API_KEY),
      modelName: readString(env.AGENT_RUNTIME_API_MODEL),
    },
    codex: {
      endpoint: readString(env.AGENT_RUNTIME_CODEX_URL),
      token: readString(env.AGENT_RUNTIME_CODEX_TOKEN),
      modelName: readString(env.AGENT_RUNTIME_CODEX_MODEL),
    },
  };
}

export function readConversationalExecutiveMode(
  env: Record<string, string | undefined> = process.env,
): "off" | "shadow" | "active" {
  const value = readString(
    env.CONVERSATIONAL_EXECUTIVE_MODE,
  )?.toLowerCase();
  if (value === "off" || value === "shadow" || value === "active") {
    return value;
  }
  const explicitEnvironment = readString(env.APP_ENV)?.toLowerCase();
  if (
    explicitEnvironment === "production" ||
    explicitEnvironment === "staging"
  ) {
    return "shadow";
  }
  return env.NODE_ENV === "test" || explicitEnvironment === "test"
    ? "off"
    : "shadow";
}

export function resolveAppEnvironment(
  env: Record<string, string | undefined> = process.env
): string {
  const explicit = readString(env.APP_ENV)?.toLowerCase();
  if (explicit) return explicit;
  if (env.NODE_ENV === "test") return "test";
  if (env.NODE_ENV === "production") return "production";
  return "local";
}

export function isLocalFixtureAllowed(
  env: Record<string, string | undefined> = process.env
): boolean {
  const environment = resolveAppEnvironment(env);
  return environment === "local" || environment === "test";
}

function readApiRuntimeKind(env: Record<string, string | undefined>) {
  const explicit = readString(env.AGENT_RUNTIME_API_KIND);
  if (explicit === "http" || explicit === "openai") return explicit;

  if (readString(env.OPENAI_API_KEY) && !readString(env.AGENT_RUNTIME_API_URL)) {
    return "openai";
  }

  return "http";
}

export function getAgentRuntimeProvider(
  agentName: AgentName,
  config: AgentRuntimeConfig = readAgentRuntimeConfig()
): RuntimeProvider {
  return config.perAgentProvider[agentName] ?? config.defaultProvider;
}

export function getAgentRuntimeTimeoutMs(
  agentName: AgentName,
  defaultValue: number,
  env: Record<string, string | undefined> = process.env
): number {
  const key = `AGENT_RUNTIME_${agentName.toUpperCase()}_TIMEOUT_MS`;
  const parsed = Number(env[key]);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(Math.trunc(parsed), 1_000), 30_000);
}

function readProvider(value: string | undefined): RuntimeProvider | undefined {
  const clean = readString(value);
  if (!clean) return undefined;
  return PROVIDERS.includes(clean as RuntimeProvider)
    ? (clean as RuntimeProvider)
    : undefined;
}

function readString(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBoolean(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}
