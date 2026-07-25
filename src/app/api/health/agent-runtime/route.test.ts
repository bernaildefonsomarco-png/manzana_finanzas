import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalValues = new Map(
  [
    "APP_ENV",
    "AGENT_RUNTIME_DEFAULT_PROVIDER",
    "AGENT_RUNTIME_API_KIND",
    "AGENT_RUNTIME_API_MODEL",
    "AGENT_RUNTIME_FALLBACK_LOCAL",
    "CONVERSATIONAL_EXECUTIVE_MODE",
    "OPENAI_API_KEY",
  ].map((key) => [key, process.env[key]])
);

afterEach(() => {
  for (const [key, value] of originalValues) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("GET /api/health/agent-runtime", () => {
  it("devuelve 503 y detalle por agente cuando produccion no esta lista", async () => {
    process.env.APP_ENV = "production";
    delete process.env.AGENT_RUNTIME_DEFAULT_PROVIDER;
    delete process.env.AGENT_RUNTIME_API_KIND;
    delete process.env.AGENT_RUNTIME_API_MODEL;
    delete process.env.OPENAI_API_KEY;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.overall_ready).toBe(false);
    expect(body.summary.blocked).toBe(15);
    expect(body.agents).toHaveLength(15);
  });

  it("devuelve 200 con configuracion OpenAI completa y no filtra la key", async () => {
    process.env.APP_ENV = "production";
    process.env.AGENT_RUNTIME_DEFAULT_PROVIDER = "api";
    process.env.AGENT_RUNTIME_API_KIND = "openai";
    process.env.AGENT_RUNTIME_API_MODEL = "gpt-test";
    process.env.OPENAI_API_KEY = "must-not-leak";
    process.env.AGENT_RUNTIME_FALLBACK_LOCAL = "true";

    const response = await GET();
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(body.production_safe).toBe(true);
    expect(body.local_fallback_effective).toBe(false);
    expect(text).not.toContain("must-not-leak");
  });
});
