import { describe, expect, it } from "vitest";
import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "./types";
import { RuntimeRouter } from "./runtime-router";

const baseRequest: AgentRuntimeRequest<{ text: string }> = {
  agent_name: "response_agent",
  provider: "api",
  model_hint: "cheap",
  context_pack: { text: "hola" },
  tools: [],
  output_schema: "TestSchema@v1",
  trace_id: "trace-1",
  timeout_ms: 1000,
};

describe("RuntimeRouter", () => {
  it("usa el runtime solicitado cuando existe", async () => {
    const router = new RuntimeRouter({
      fallbackToLocal: true,
      localFixtureAllowed: true,
      localFallback: new StaticRuntime("local_fixture"),
      runtimes: {
        api: new StaticRuntime("api"),
        local_fixture: new StaticRuntime("local_fixture"),
      },
    });

    const response = await router.run<{ text: string }, { ok: true }>(
      baseRequest
    );

    expect(response.runtime.provider).toBe("api");
    expect(response.output).toEqual({ ok: true });
  });

  it("cae a local_fixture si el provider externo falla y fallback esta activo", async () => {
    const router = new RuntimeRouter({
      fallbackToLocal: true,
      localFixtureAllowed: true,
      localFallback: new StaticRuntime("local_fixture"),
      runtimes: {
        api: new FailingRuntime(),
        local_fixture: new StaticRuntime("local_fixture"),
      },
    });

    const response = await router.run<{ text: string }, { ok: true }>(
      baseRequest
    );

    expect(response.runtime.provider).toBe("local_fixture");
    expect(response.safety.policy_flags).toContain("runtime_fallback_from_api");
  });

  it("propaga error si fallback esta apagado", async () => {
    const router = new RuntimeRouter({
      fallbackToLocal: false,
      localFixtureAllowed: true,
      localFallback: new StaticRuntime("local_fixture"),
      runtimes: {
        api: new FailingRuntime(),
      },
    });

    await expect(router.run(baseRequest)).rejects.toThrow("boom");
  });

  it("prohibe local_fixture fuera de desarrollo aunque se solicite directamente", async () => {
    const router = new RuntimeRouter({
      fallbackToLocal: true,
      localFixtureAllowed: false,
      localFallback: new StaticRuntime("local_fixture"),
      runtimes: {
        local_fixture: new StaticRuntime("local_fixture"),
      },
    });

    await expect(
      router.run({
        ...baseRequest,
        provider: "local_fixture",
      })
    ).rejects.toMatchObject({
      code: "RUNTIME_LOCAL_FIXTURE_FORBIDDEN",
    });
  });

  it("no usa local_fixture como fallback fuera de desarrollo", async () => {
    const router = new RuntimeRouter({
      fallbackToLocal: true,
      localFixtureAllowed: false,
      localFallback: new StaticRuntime("local_fixture"),
      runtimes: {
        api: new FailingRuntime(),
      },
    });

    await expect(router.run(baseRequest)).rejects.toThrow("boom");
  });
});

class StaticRuntime implements AgentRuntime {
  constructor(private readonly provider: "api" | "local_fixture") {}

  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    void request;

    return {
      output: { ok: true } as TOutput,
      confidence: 0.9,
      tool_calls: [],
      runtime: {
        provider: this.provider,
        model_name: `${this.provider}-test`,
        latency_ms: 1,
      },
      safety: {
        policy_flags: [],
        redaction_applied: false,
      },
    };
  }
}

class FailingRuntime implements AgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    void request;

    throw new Error("boom");
  }
}
