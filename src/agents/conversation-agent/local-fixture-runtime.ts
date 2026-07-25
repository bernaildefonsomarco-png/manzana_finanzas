import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime/types";
import type { ConversationContextPack } from "./types";
import { composeConversationAnswer } from "@/core/conversation/grounded-response-composer";

export class LocalFixtureConversationAgentRuntime implements AgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    if (request.agent_name !== "conversation_agent") {
      throw new Error(
        "LocalFixtureConversationAgentRuntime solo soporta conversation_agent",
      );
    }

    const startedAt = Date.now();
    const output = composeConversationAnswer(
      request.context_pack as ConversationContextPack,
    );

    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: output.used_tools.map((toolName) => ({
        tool_name: toolName,
        status: "called" as const,
      })),
      runtime: {
        provider: "local_fixture",
        model_name: "local-conversation-fixture-v1",
        latency_ms: Date.now() - startedAt,
        cost_estimate: 0,
      },
      safety: {
        policy_flags: output.safety_flags,
        redaction_applied: false,
      },
    };
  }
}

export { composeConversationAnswer } from "@/core/conversation/grounded-response-composer";
