import { describe, expect, it } from "vitest";
import {
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  readAgentRuntimeConfig,
} from "./config";

describe("AgentRuntime config", () => {
  it("usa local_fixture por defecto", () => {
    const config = readAgentRuntimeConfig({});

    expect(config.defaultProvider).toBe("local_fixture");
    expect(config.appEnvironment).toBe("local");
    expect(config.localFixtureAllowed).toBe(true);
    expect(config.fallbackToLocal).toBe(true);
    expect(getAgentRuntimeProvider("data_agent", config)).toBe("local_fixture");
  });

  it("permite mover agentes uno por uno", () => {
    const config = readAgentRuntimeConfig({
      AGENT_RUNTIME_DEFAULT_PROVIDER: "local_fixture",
      AGENT_RUNTIME_DATA_AGENT_PROVIDER: "api",
      AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER: "api",
      AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER: "codex",
      AGENT_RUNTIME_LEARNING_SIGNAL_AGENT_PROVIDER: "api",
      AGENT_RUNTIME_RISK_SIGNAL_AGENT_PROVIDER: "api",
      AGENT_RUNTIME_DEDUP_SIGNAL_AGENT_PROVIDER: "api",
      AGENT_RUNTIME_DISCLOSURE_EXPERIENCE_AGENT_PROVIDER: "codex",
      AGENT_RUNTIME_RECURRING_SIGNAL_AGENT_PROVIDER: "api",
      AGENT_RUNTIME_NUDGE_EXPERIENCE_AGENT_PROVIDER: "api",
    });

    expect(getAgentRuntimeProvider("data_agent", config)).toBe("api");
    expect(getAgentRuntimeProvider("email_extraction_agent", config)).toBe(
      "api"
    );
    expect(getAgentRuntimeProvider("response_agent", config)).toBe("codex");
    expect(getAgentRuntimeProvider("conversation_agent", config)).toBe(
      "local_fixture"
    );
    expect(getAgentRuntimeProvider("learning_signal_agent", config)).toBe(
      "api"
    );
    expect(getAgentRuntimeProvider("risk_signal_agent", config)).toBe("api");
    expect(getAgentRuntimeProvider("dedup_signal_agent", config)).toBe("api");
    expect(
      getAgentRuntimeProvider("disclosure_experience_agent", config)
    ).toBe("codex");
    expect(getAgentRuntimeProvider("recurring_signal_agent", config)).toBe(
      "api"
    );
    expect(getAgentRuntimeProvider("nudge_experience_agent", config)).toBe(
      "api"
    );
  });

  it("ignora providers invalidos", () => {
    const config = readAgentRuntimeConfig({
      AGENT_RUNTIME_DEFAULT_PROVIDER: "magic",
      AGENT_RUNTIME_DATA_AGENT_PROVIDER: "api",
    });

    expect(config.defaultProvider).toBe("local_fixture");
    expect(getAgentRuntimeProvider("data_agent", config)).toBe("api");
  });

  it("fuera de local usa API por defecto y deshabilita el fallback local", () => {
    const config = readAgentRuntimeConfig({
      APP_ENV: "production",
      AGENT_RUNTIME_FALLBACK_LOCAL: "true",
    });

    expect(config.appEnvironment).toBe("production");
    expect(config.defaultProvider).toBe("api");
    expect(config.localFixtureAllowed).toBe(false);
    expect(config.fallbackToLocalRequested).toBe(true);
    expect(config.fallbackToLocal).toBe(false);
  });

  it("mantiene bloqueado un local_fixture explicitamente configurado fuera de local", () => {
    const config = readAgentRuntimeConfig({
      APP_ENV: "staging",
      AGENT_RUNTIME_DEFAULT_PROVIDER: "local_fixture",
      AGENT_RUNTIME_DATA_AGENT_PROVIDER: "local_fixture",
    });

    expect(config.defaultProvider).toBe("local_fixture");
    expect(getAgentRuntimeProvider("data_agent", config)).toBe("local_fixture");
    expect(config.localFixtureAllowed).toBe(false);
  });

  it("detecta OpenAI como runtime API cuando hay OPENAI_API_KEY y no endpoint propio", () => {
    const config = readAgentRuntimeConfig({
      OPENAI_API_KEY: "sk-test",
      AGENT_RUNTIME_API_MODEL: "model-test",
    });

    expect(config.api.kind).toBe("openai");
    expect(config.api.token).toBe("sk-test");
    expect(config.api.modelName).toBe("model-test");
  });

  it("mantiene HTTP generico si hay endpoint API explicito", () => {
    const config = readAgentRuntimeConfig({
      OPENAI_API_KEY: "sk-test",
      AGENT_RUNTIME_API_URL: "https://runtime.example/run",
      AGENT_RUNTIME_API_TOKEN: "runtime-token",
    });

    expect(config.api.kind).toBe("http");
    expect(config.api.endpoint).toBe("https://runtime.example/run");
    expect(config.api.token).toBe("runtime-token");
  });

  it("permite un presupuesto por agente y lo mantiene dentro de limites seguros", () => {
    expect(
      getAgentRuntimeTimeoutMs("orchestration_planning_agent", 15_000, {
        AGENT_RUNTIME_ORCHESTRATION_PLANNING_AGENT_TIMEOUT_MS: "18000",
      })
    ).toBe(18_000);
    expect(
      getAgentRuntimeTimeoutMs("orchestration_planning_agent", 15_000, {
        AGENT_RUNTIME_ORCHESTRATION_PLANNING_AGENT_TIMEOUT_MS: "999999",
      })
    ).toBe(30_000);
    expect(
      getAgentRuntimeTimeoutMs("orchestration_planning_agent", 15_000, {})
    ).toBe(15_000);
  });
});
