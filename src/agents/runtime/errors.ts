import type { RuntimeProvider } from "./types";

export type AgentRuntimeErrorCode =
  | "RUNTIME_PROVIDER_UNAVAILABLE"
  | "RUNTIME_LOCAL_FIXTURE_FORBIDDEN"
  | "RUNTIME_HTTP_ERROR"
  | "RUNTIME_INVALID_RESPONSE"
  | "RUNTIME_TIMEOUT"
  | "RUNTIME_UNEXPECTED_ERROR";

export class AgentRuntimeError extends Error {
  constructor(
    readonly code: AgentRuntimeErrorCode,
    message: string,
    readonly details: {
      provider: RuntimeProvider;
      status?: number;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "AgentRuntimeError";
  }
}

export function isAgentRuntimeError(error: unknown): error is AgentRuntimeError {
  return error instanceof AgentRuntimeError;
}
