import { readAgentRuntimeConfig, type AgentRuntimeConfig } from "./config";
import { HttpAgentRuntime } from "./http-agent-runtime";
import { LocalFixtureAgentRuntime } from "./local-fixture-runtime";
import { OpenAIAgentRuntime } from "./openai-agent-runtime";
import { RuntimeRouter } from "./runtime-router";
import type { AgentRuntime } from "./types";

export function createDefaultAgentRuntime(
  config: AgentRuntimeConfig = readAgentRuntimeConfig()
): AgentRuntime {
  const localFallback = new LocalFixtureAgentRuntime();

  return new RuntimeRouter({
    fallbackToLocal: config.fallbackToLocal,
    localFixtureAllowed: config.localFixtureAllowed,
    localFallback,
    runtimes: {
      local_fixture: localFallback,
      api:
        config.api.kind === "openai"
          ? new OpenAIAgentRuntime({
              apiKey: config.api.token,
              modelName: config.api.modelName,
              endpoint: config.api.endpoint,
            })
          : new HttpAgentRuntime({
              provider: "api",
              endpoint: config.api.endpoint,
              token: config.api.token,
              modelName: config.api.modelName,
            }),
      codex: new HttpAgentRuntime({
        provider: "codex",
        endpoint: config.codex.endpoint,
        token: config.codex.token,
        modelName: config.codex.modelName,
      }),
    },
  });
}
