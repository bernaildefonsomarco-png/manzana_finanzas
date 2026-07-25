import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime/types";
import {
  ResponseAgentOutputSchema,
  type ResponseAgentOutput,
  type ResponseContextPack,
} from "./types";

export class LocalFixtureResponseAgentRuntime implements AgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    if (request.agent_name !== "response_agent") {
      throw new Error("LocalFixtureResponseAgentRuntime solo soporta response_agent");
    }

    const startedAt = Date.now();
    const output = composeResponseAgentOutput(
      request.context_pack as ResponseContextPack
    );

    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "local-response-fixture-v1",
        latency_ms: Date.now() - startedAt,
      },
      safety: {
        policy_flags: output.safety_flags,
        redaction_applied: false,
      },
    };
  }
}

export function composeResponseAgentOutput(
  context: ResponseContextPack
): ResponseAgentOutput {
  const responseText = composeResponseText(context);

  return ResponseAgentOutputSchema.parse({
    response_text: trimToMaxChars(responseText, context.constraints.max_chars),
    confidence: getScenarioConfidence(context.scenario),
    preserved_facts: [
      ...context.facts.amounts,
      ...context.facts.pending_codes,
      ...context.facts.links,
    ],
    safety_flags: buildSafetyFlags(context),
    style_notes: ["tono_cercano", "sin_culpa", "sin_razonamiento_interno"],
    style_adherence: context.style_contract.must_apply
      ? "not_applicable"
      : context.style_contract.active
        ? "blocked_for_safety"
        : "not_applicable",
    applied_style_dimensions: [],
    style_evidence: [],
    style_exceptions: context.style_contract.must_apply
      ? ["local_fixture_does_not_generate_free_style"]
      : context.style_contract.blocked_reasons,
  });
}

function composeResponseText(context: ResponseContextPack): string {
  const base = context.base_text.trim();

  if (
    context.scenario === "pending_listed" ||
    context.scenario === "pending_resolution_needs_clarification" ||
    context.scenario === "correction_applied" ||
    context.scenario === "correction_cancelled" ||
    context.scenario === "correction_needs_confirmation" ||
    context.scenario === "correction_needs_selection" ||
    context.scenario === "correction_needs_clarification" ||
    context.scenario === "blocked_financial_action" ||
    context.scenario === "conversation_greeting" ||
    context.scenario === "conversation_help" ||
    context.scenario === "conversation_thanks" ||
    context.scenario === "conversation_answer"
  ) {
    return base;
  }

  const links = context.facts.links;
  const baseWithoutLinks = removeLinks(base).trim();

  if (context.scenario === "movement_created") {
    return appendLinks(
      `${withoutTrailingPeriod(baseWithoutLinks)}. Ya quedó en tus movimientos.`,
      links
    );
  }

  if (context.scenario === "movements_created") {
    return appendLinks(
      `${withoutTrailingPeriod(baseWithoutLinks)}. Los dejé separados y ordenados.`,
      links
    );
  }

  if (context.scenario === "pending_created") {
    if (
      context.facts.risk_level === "sensitive" ||
      context.facts.risk_level === "high"
    ) {
      return appendLinks(
        "Lo separé para revisar con calma. No toca tu saldo hasta que confirmes.",
        links
      );
    }

    return appendLinks(
      "Lo separé para revisar. No toca tu saldo hasta que confirmes.",
      links
    );
  }

  if (context.scenario === "pending_confirmed") {
    return appendLinks(
      `${withoutTrailingPeriod(baseWithoutLinks)}. Ahora sí quedó como movimiento.`,
      links
    );
  }

  if (context.scenario === "pending_discarded") {
    return appendLinks("Listo. Lo descarté. No tocaba tu saldo.", links);
  }

  if (context.scenario === "local_auto_ack") {
    return "Te leí. Dame un momento y lo reviso contigo.";
  }

  return base;
}

function buildSafetyFlags(context: ResponseContextPack): string[] {
  const flags = ["no_financial_write", "facts_preserved"];
  if (context.constraints.discreet_mode) flags.push("discreet_mode");
  if (context.facts.risk_level === "sensitive") flags.push("sensitive_context");
  return flags;
}

function getScenarioConfidence(scenario: ResponseContextPack["scenario"]): number {
  if (
    scenario === "pending_listed" ||
    scenario === "pending_resolution_needs_clarification" ||
    scenario === "correction_applied" ||
    scenario === "correction_cancelled" ||
    scenario === "correction_needs_confirmation" ||
    scenario === "correction_needs_selection" ||
    scenario === "correction_needs_clarification" ||
    scenario === "blocked_financial_action" ||
    scenario === "conversation_greeting" ||
    scenario === "conversation_help" ||
    scenario === "conversation_thanks" ||
    scenario === "conversation_answer"
  ) {
    return 0.99;
  }

  return 0.86;
}

function appendLinks(text: string, links: string[]): string {
  if (links.length === 0) return text;
  return `${text}\n${links
    .map((link) => `También puedes abrir Pendientes: ${link}`)
    .join("\n")}`;
}

function removeLinks(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/https?:\/\/\S+/.test(line))
    .join("\n");
}

function withoutTrailingPeriod(text: string): string {
  return text.replace(/\.+$/u, "");
}

function trimToMaxChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)).trimEnd();
}
