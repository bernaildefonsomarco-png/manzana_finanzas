import { describe, expect, it } from "vitest";
import { readAgentRuntimeConfig } from "./config";
import { getAgentRuntimeReadiness } from "./readiness";

describe("AgentRuntime readiness", () => {
  it("expone el fixture como development_only en local sin revelar secretos", () => {
    const report = getAgentRuntimeReadiness(
      readAgentRuntimeConfig({
        APP_ENV: "local",
      })
    );

    expect(report.overall_ready).toBe(true);
    expect(report.production_safe).toBe(false);
    expect(report.summary).toEqual({
      ready: 0,
      development_only: 15,
      inactive: 0,
      blocked: 0,
    });
    expect(report.agents[0]).toMatchObject({
      effective_provider: "local_fixture",
      status: "development_only",
    });
  });

  it("bloquea todos los agentes si produccion pide API sin configurarla", () => {
    const report = getAgentRuntimeReadiness(
      readAgentRuntimeConfig({
        APP_ENV: "production",
      })
    );

    expect(report.overall_ready).toBe(false);
    expect(report.production_safe).toBe(false);
    expect(report.summary.blocked).toBe(15);
    expect(report.agents[0].reasons).toContain("api_endpoint_missing");
  });

  it("declara produccion segura con OpenAI, modelo y credenciales configurados", () => {
    const report = getAgentRuntimeReadiness(
      readAgentRuntimeConfig({
        APP_ENV: "production",
        AGENT_RUNTIME_API_KIND: "openai",
        AGENT_RUNTIME_API_MODEL: "gpt-test",
        OPENAI_API_KEY: "secret-value-that-must-not-be-exposed",
        AGENT_RUNTIME_FALLBACK_LOCAL: "true",
      })
    );

    expect(report.overall_ready).toBe(true);
    expect(report.production_safe).toBe(true);
    expect(report.local_fallback_requested).toBe(true);
    expect(report.local_fallback_effective).toBe(false);
    expect(report.summary.ready).toBe(15);
    expect(report.agents[0]).toMatchObject({
      runtime_kind: "openai",
      model_name: "gpt-test",
      credentials_configured: true,
      effective_fallback: null,
      status: "ready",
    });
    expect(JSON.stringify(report)).not.toContain(
      "secret-value-that-must-not-be-exposed"
    );
  });

  it("muestra como bloqueado un override local en staging", () => {
    const report = getAgentRuntimeReadiness(
      readAgentRuntimeConfig({
        APP_ENV: "staging",
        AGENT_RUNTIME_API_KIND: "openai",
        AGENT_RUNTIME_API_MODEL: "gpt-test",
        OPENAI_API_KEY: "secret",
        AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER: "local_fixture",
      })
    );
    const responseAgent = report.agents.find(
      (agent) => agent.agent_name === "response_agent"
    );

    expect(responseAgent).toMatchObject({
      effective_provider: "local_fixture",
      status: "blocked",
      reasons: ["local_fixture_forbidden_outside_development_and_test"],
    });
    expect(report.production_safe).toBe(false);
  });

  it("en active no exige los cinco LLM interactivos legados", () => {
    const report = getAgentRuntimeReadiness(
      readAgentRuntimeConfig({
        APP_ENV: "production",
        CONVERSATIONAL_EXECUTIVE_MODE: "active",
        AGENT_RUNTIME_API_KIND: "openai",
        AGENT_RUNTIME_API_MODEL: "gpt-test",
        OPENAI_API_KEY: "secret",
        AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER: "local_fixture",
        AGENT_RUNTIME_DATA_AGENT_PROVIDER: "local_fixture",
        AGENT_RUNTIME_CONVERSATION_AGENT_PROVIDER: "local_fixture",
        AGENT_RUNTIME_CORRECTION_AGENT_PROVIDER: "local_fixture",
        AGENT_RUNTIME_ORCHESTRATION_PLANNING_AGENT_PROVIDER: "local_fixture",
      })
    );

    expect(report.conversational_executive_mode).toBe("active");
    expect(report.summary).toEqual({
      ready: 10,
      development_only: 0,
      inactive: 5,
      blocked: 0,
    });
    expect(report.production_safe).toBe(true);
    expect(
      report.agents.filter((agent) => agent.execution_role === "inactive"),
    ).toHaveLength(5);
    expect(
      report.agents.find(
        (agent) => agent.agent_name === "conversational_executive_agent",
      ),
    ).toMatchObject({
      execution_role: "required",
      required_for_readiness: true,
      status: "ready",
    });
  });
});
