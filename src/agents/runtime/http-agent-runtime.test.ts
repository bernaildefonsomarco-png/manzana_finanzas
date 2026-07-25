import { describe, expect, it } from "vitest";
import { AgentRuntimeError } from "./errors";
import { HttpAgentRuntime } from "./http-agent-runtime";
import type { AgentRuntimeRequest } from "./types";

const request: AgentRuntimeRequest<{ text: string }> = {
  agent_name: "response_agent",
  provider: "api",
  model_hint: "cheap",
  context_pack: { text: "hola" },
  tools: [],
  output_schema: "TestSchema@v1",
  trace_id: "trace-1",
  timeout_ms: 1000,
};

describe("HttpAgentRuntime", () => {
  it("falla como provider no disponible si no hay endpoint", async () => {
    const runtime = new HttpAgentRuntime({
      provider: "api",
      endpoint: null,
      token: null,
    });

    await expect(runtime.run(request)).rejects.toMatchObject({
      code: "RUNTIME_PROVIDER_UNAVAILABLE",
    } satisfies Partial<AgentRuntimeError>);
  });

  it("envia el request al endpoint configurado y normaliza la respuesta", async () => {
    const runtime = new HttpAgentRuntime({
      provider: "api",
      endpoint: "https://agent-runtime.test/run",
      token: "secret",
      modelName: "cheap-json-model",
      fetcher: async (url, init) => {
        expect(url).toBe("https://agent-runtime.test/run");
        expect(init?.headers).toMatchObject({
          "Content-Type": "application/json",
          Authorization: "Bearer secret",
        });

        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          agent_name: "response_agent",
          provider: "api",
          model_name: "cheap-json-model",
          output_schema: "TestSchema@v1",
        });

        return new Response(
          JSON.stringify({
            output: { response_text: "Listo." },
            confidence: 0.8,
            safety: {
              policy_flags: ["api_runtime"],
              redaction_applied: false,
            },
          }),
          { status: 200 }
        );
      },
    });

    const response = await runtime.run<
      { text: string },
      { response_text: string }
    >(request);

    expect(response).toMatchObject({
      output: { response_text: "Listo." },
      confidence: 0.8,
      runtime: {
        provider: "api",
        model_name: "cheap-json-model",
      },
      safety: {
        policy_flags: ["api_runtime"],
      },
    });
  });
});
