import { AgentRuntimeError, isAgentRuntimeError } from "./errors";
import {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
  RuntimeProvider,
} from "./types";

export type RuntimeRouterOptions = {
  fallbackToLocal: boolean;
  localFixtureAllowed: boolean;
  localFallback: AgentRuntime;
  runtimes: Partial<Record<RuntimeProvider, AgentRuntime>>;
};

export class RuntimeRouter implements AgentRuntime {
  constructor(private readonly options: RuntimeRouterOptions) {}

  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    if (
      request.provider === "local_fixture" &&
      !this.options.localFixtureAllowed
    ) {
      throw new AgentRuntimeError(
        "RUNTIME_LOCAL_FIXTURE_FORBIDDEN",
        `local_fixture esta prohibido para ${request.agent_name} fuera de desarrollo y pruebas.`,
        { provider: "local_fixture" }
      );
    }

    const runtime = this.options.runtimes[request.provider];
    if (!runtime) {
      return this.runFallback(request, "runtime_missing");
    }

    try {
      return await runtime.run<TContext, TOutput>(request);
    } catch (error) {
      if (
        !this.options.localFixtureAllowed ||
        !this.options.fallbackToLocal ||
        request.provider === "local_fixture"
      ) {
        throw error;
      }

      return this.runFallback(
        request,
        isAgentRuntimeError(error) ? error.code : "runtime_error"
      );
    }
  }

  private async runFallback<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
    reason: string
  ): Promise<AgentRuntimeResponse<TOutput>> {
    if (
      !this.options.localFixtureAllowed ||
      !this.options.fallbackToLocal ||
      request.provider === "local_fixture"
    ) {
      throw new Error(
        `No hay runtime disponible para ${request.agent_name} con provider ${request.provider}.`
      );
    }

    const fallbackResponse = await this.options.localFallback.run<
      TContext,
      TOutput
    >({
      ...request,
      provider: "local_fixture",
    });

    return {
      ...fallbackResponse,
      safety: {
        ...fallbackResponse.safety,
        policy_flags: [
          ...fallbackResponse.safety.policy_flags,
          `runtime_fallback_from_${request.provider}`,
          `runtime_fallback_reason_${reason}`,
        ],
      },
    };
  }
}
