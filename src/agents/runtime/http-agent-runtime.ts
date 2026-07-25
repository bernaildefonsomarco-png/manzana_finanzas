import { AgentRuntimeError } from "./errors";
import {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
  RuntimeProvider,
} from "./types";

type Fetcher = typeof fetch;

export type HttpAgentRuntimeConfig = {
  provider: Extract<RuntimeProvider, "api" | "codex">;
  endpoint: string | null;
  token: string | null;
  modelName?: string | null;
  fetcher?: Fetcher;
};

export class HttpAgentRuntime implements AgentRuntime {
  private readonly fetcher: Fetcher;

  constructor(private readonly config: HttpAgentRuntimeConfig) {
    this.fetcher = config.fetcher ?? fetch;
  }

  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    if (!this.config.endpoint) {
      throw new AgentRuntimeError(
        "RUNTIME_PROVIDER_UNAVAILABLE",
        `${this.config.provider} runtime no tiene endpoint configurado.`,
        { provider: this.config.provider }
      );
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms);

    try {
      const response = await this.fetcher(this.config.endpoint, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          ...request,
          provider: this.config.provider,
          model_name: this.config.modelName ?? undefined,
        }),
        signal: controller.signal,
      });

      const body = await readJson(response);
      if (!response.ok) {
        throw new AgentRuntimeError(
          "RUNTIME_HTTP_ERROR",
          `${this.config.provider} runtime respondio con HTTP ${response.status}.`,
          {
            provider: this.config.provider,
            status: response.status,
            cause: body,
          }
        );
      }

      return normalizeAgentRuntimeResponse<TOutput>({
        body,
        provider: this.config.provider,
        modelName: this.config.modelName,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      if (error instanceof AgentRuntimeError) throw error;

      throw new AgentRuntimeError(
        "RUNTIME_UNEXPECTED_ERROR",
        `${this.config.provider} runtime fallo antes de devolver una respuesta valida.`,
        {
          provider: this.config.provider,
          cause: error,
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }

    return headers;
  }
}

function normalizeAgentRuntimeResponse<TOutput>(params: {
  body: unknown;
  provider: Extract<RuntimeProvider, "api" | "codex">;
  modelName?: string | null;
  latencyMs: number;
}): AgentRuntimeResponse<TOutput> {
  if (!isRecord(params.body) || !("output" in params.body)) {
    throw new AgentRuntimeError(
      "RUNTIME_INVALID_RESPONSE",
      `${params.provider} runtime devolvio una respuesta sin output.`,
      { provider: params.provider, cause: params.body }
    );
  }

  const runtime = isRecord(params.body.runtime) ? params.body.runtime : {};
  const safety = isRecord(params.body.safety) ? params.body.safety : {};

  return {
    output: params.body.output as TOutput,
    confidence:
      typeof params.body.confidence === "number"
        ? params.body.confidence
        : null,
    tool_calls: Array.isArray(params.body.tool_calls)
      ? params.body.tool_calls
      : [],
    runtime: {
      provider: params.provider,
      model_name:
        typeof runtime.model_name === "string"
          ? runtime.model_name
          : params.modelName ?? undefined,
      latency_ms:
        typeof runtime.latency_ms === "number"
          ? runtime.latency_ms
          : params.latencyMs,
      cost_estimate:
        typeof runtime.cost_estimate === "number"
          ? runtime.cost_estimate
          : undefined,
    },
    safety: {
      policy_flags: Array.isArray(safety.policy_flags)
        ? safety.policy_flags.filter((flag): flag is string => typeof flag === "string")
        : [],
      redaction_applied:
        typeof safety.redaction_applied === "boolean"
          ? safety.redaction_applied
          : false,
    },
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
