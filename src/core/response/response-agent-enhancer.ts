import {
  ResponseAgent,
  type ResponseAgentOutput,
  type ResponseScenario,
  type ResponseStyleContract,
} from "@/agents/response-agent";
import type {
  ConversationStyleProfile,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import type { ConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import type { ExternalEventLog } from "@/core/events/domain-events";
import { evaluateOutputGuard } from "@/core/disclosure/output-guard";
import {
  buildResponseStyleContract,
  countAuthoredLines,
  countEmoji,
} from "./conversation-style-policy";
import type { ResponsePlannerResult } from "./response-planner";

type ResponseAgentEnhancementOutcome =
  | {
      status: "not_applicable";
      reason: "not_sendable" | "disabled";
      confidence: null;
      provider: null;
      model_name: null;
      latency_ms: null;
      safety_flags: string[];
    }
  | {
      status: "completed";
      reason: "accepted";
      confidence: number | null;
      provider: string;
      model_name: string | null;
      latency_ms: number;
      safety_flags: string[];
    }
  | {
      status: "rejected";
      reason:
        | "empty_text"
        | "too_long"
        | "missing_amount"
        | "invented_amount"
        | "missing_code"
        | "invented_code"
        | "missing_link"
        | "invented_link"
        | "missing_safety_phrase"
        | "invented_account_context"
        | "operation_state_changed"
        | "style_not_applied"
        | "emoji_not_allowed"
        | "emoji_required"
        | "too_many_emojis"
        | "emoji_multiline";
      confidence: number | null;
      provider: string;
      model_name: string | null;
      latency_ms: number;
      safety_flags: string[];
    }
  | {
      status: "failed";
      reason: "agent_error";
      confidence: null;
      provider: null;
      model_name: null;
      latency_ms: null;
      safety_flags: string[];
    };

export type ResponseAgentEnhancementTrace = ResponseAgentEnhancementOutcome & {
  style_active?: boolean;
  style_scope?: ConversationStyleProfile["scope"] | null;
  style_adherence?: ResponseAgentOutput["style_adherence"] | null;
  style_blocked_reasons?: string[];
  attempt_count?: number;
};

export async function maybeEnhanceWhatsAppResponseWithAgent(params: {
  responsePlan: ResponsePlannerResult;
  externalEvent: ExternalEventLog;
  responseAgent: ResponseAgent;
  traceId: string;
  timezone?: string;
  discreetMode?: boolean;
  conversationTurnState: ConversationTurnState;
  activeConversationState?: ConversationMemoryState | null;
  preferredTone?: string | null;
  conversationStyle?: ConversationStyleProfile | null;
}): Promise<{
  responsePlan: ResponsePlannerResult;
  trace: ResponseAgentEnhancementTrace;
}> {
  if (!isSendablePlan(params.responsePlan)) {
    return {
      responsePlan: params.responsePlan,
      trace: {
        status: "not_applicable",
        reason: "not_sendable",
        confidence: null,
        provider: null,
        model_name: null,
        latency_ms: null,
        safety_flags: [],
      },
    };
  }

  const baseText = params.responsePlan.text;
  const riskLevel = inferRiskLevel(params.conversationTurnState.risk_notes) ?? "low";
  const styleContract = buildResponseStyleContract({
    style: params.conversationStyle ?? null,
    legacyInstruction: params.preferredTone,
    scenario: params.responsePlan.reason as ResponseScenario,
    turnState: params.conversationTurnState,
    discreetMode: params.discreetMode === true,
    riskLevel,
    baseText,
  });
  const disclosureGuard = evaluateOutputGuard({
    channel: "whatsapp",
    initiatedBySystem: false,
    authenticatedSession: false,
    verifiedRecipient: Boolean(params.externalEvent.user_id),
    discreetMode: params.discreetMode === true,
    riskLevel,
    facts: {
      amounts: extractMoneyTokens(baseText),
      pending_codes: extractPendingCodes(baseText),
      links: extractLinks(baseText),
    },
    sensitiveFactKeys: ["amounts"],
  });
  const contextPack = {
    context_pack_type: "response_context" as const,
    version: "v2" as const,
    user_id: params.externalEvent.user_id!,
    locale: "es-PE" as const,
    timezone: params.timezone ?? "America/Lima",
    channel: "whatsapp" as const,
    scenario: params.responsePlan.reason as ResponseScenario,
    base_text: baseText,
    original_user_text: readString(params.externalEvent.metadata.text) ?? "",
    constraints: {
      max_chars: 900,
      preserve_amounts: true,
      preserve_pending_codes: true,
      preserve_links: true,
      no_emoji: styleContract.emoji_mode === "forbidden",
      discreet_mode: params.discreetMode === true,
    },
    style_contract: styleContract,
    facts: {
      amounts: extractMoneyTokens(baseText),
      pending_codes: extractPendingCodes(baseText),
      links: extractLinks(baseText),
      movement_count: extractCount(baseText, "movimiento"),
      pending_count: extractCount(baseText, "pendiente"),
      risk_level: riskLevel,
    },
    experience: {
      emotional_state: params.conversationTurnState.emotional_state,
      continuity: params.conversationTurnState.continuity,
      experience_mode: params.conversationTurnState.experience_mode,
      response_guidance: params.conversationTurnState.response_guidance,
      personalization_cues: params.conversationTurnState.personalization_cues,
      preferred_tone: params.preferredTone ?? null,
      conversation_style: params.conversationStyle ?? null,
      last_result_summary:
        params.activeConversationState?.last_result_summary ?? null,
      working_goal:
        params.activeConversationState?.working_set?.goal ?? null,
      avoid_repetition:
        params.conversationTurnState.continuity !== "new_topic" ||
        params.conversationTurnState.act === "greeting",
    },
  };

  try {
    let lastResult: Awaited<ReturnType<ResponseAgent["compose"]>> | null = null;
    let attemptCount = 0;
    let lastValidation: Extract<
      ResponseAgentEnhancementTrace,
      { status: "rejected" }
    >["reason"] | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      attemptCount = attempt;
      const requestStyleContract: ResponseStyleContract = {
        ...styleContract,
        attempt: attempt as 1 | 2,
        retry_feedback:
          attempt === 1 || !lastValidation ? null : lastValidation,
      };
      const result = await params.responseAgent.compose(
        {
          ...contextPack,
          style_contract: requestStyleContract,
        },
        params.traceId,
      );
      const validation = validateAgentOutput({
        baseText,
        output: result.output,
        styleContract,
        scenario: params.responsePlan.reason as ResponseScenario,
      });
      lastResult = result;
      lastValidation = validation;

      if (!validation) {
        return {
          responsePlan: replaceResponsePlanText(
            params.responsePlan,
            result.output.response_text,
          ),
          trace: {
            status: "completed",
            reason: "accepted",
            confidence: result.output.confidence,
            provider: result.runtime.provider,
            model_name: result.runtime.model_name ?? null,
            latency_ms: result.runtime.latency_ms,
            safety_flags: [
              ...result.safety.policy_flags,
              ...disclosureGuard.reasons.map((reason) => `disclosure:${reason}`),
            ],
            ...styleTrace(styleContract, result.output, attempt),
          },
        };
      }

      if (!isRetryableStyleRejection(validation)) break;
    }

    return {
      responsePlan: params.responsePlan,
      trace: {
        status: "rejected",
        reason: lastValidation ?? "empty_text",
        confidence: lastResult?.output.confidence ?? null,
        provider: lastResult?.runtime.provider ?? "unknown",
        model_name: lastResult?.runtime.model_name ?? null,
        latency_ms: lastResult?.runtime.latency_ms ?? 0,
        safety_flags: [
          ...(lastResult?.safety.policy_flags ?? []),
          ...disclosureGuard.reasons.map((reason) => `disclosure:${reason}`),
        ],
        ...styleTrace(styleContract, lastResult?.output ?? null, attemptCount),
      },
    };
  } catch {
    return {
      responsePlan: params.responsePlan,
      trace: {
        status: "failed",
        reason: "agent_error",
        confidence: null,
        provider: null,
        model_name: null,
        latency_ms: null,
        safety_flags: [],
        ...styleTrace(styleContract, null, 0),
      },
    };
  }
}

function isSendablePlan(
  responsePlan: ResponsePlannerResult
): responsePlan is Extract<
  ResponsePlannerResult,
  { kind: "whatsapp_freeform" | "whatsapp_interactive" }
> {
  return (
    responsePlan.kind === "whatsapp_freeform" ||
    responsePlan.kind === "whatsapp_interactive"
  );
}

function replaceResponsePlanText(
  responsePlan: Extract<
    ResponsePlannerResult,
    { kind: "whatsapp_freeform" | "whatsapp_interactive" }
  >,
  text: string
): ResponsePlannerResult {
  if (responsePlan.kind === "whatsapp_interactive") {
    return {
      ...responsePlan,
      text,
      interactive: {
        ...responsePlan.interactive,
        bodyText: text,
      },
    };
  }

  return {
    ...responsePlan,
    text,
  };
}

function validateAgentOutput(params: {
  baseText: string;
  output: ResponseAgentOutput;
  styleContract: ResponseStyleContract;
  scenario: ResponseScenario;
}): Extract<ResponseAgentEnhancementTrace, { status: "rejected" }>["reason"] | null {
  const text = params.output.response_text.trim();
  if (!text) return "empty_text";
  if (text.length > 1000) return "too_long";

  const baseAmounts = extractMoneyTokens(params.baseText);
  const candidateAmounts = extractMoneyTokens(text);
  if (!containsAll(candidateAmounts, baseAmounts)) {
    return "missing_amount";
  }
  if (!containsAll(baseAmounts, candidateAmounts)) return "invented_amount";

  const baseCodes = extractPendingCodes(params.baseText);
  const candidateCodes = extractPendingCodes(text);
  if (!containsAll(candidateCodes, baseCodes)) {
    return "missing_code";
  }
  if (!containsAll(baseCodes, candidateCodes)) return "invented_code";

  const baseLinks = extractLinks(params.baseText);
  const candidateLinks = extractLinks(text);
  if (!containsAll(candidateLinks, baseLinks)) {
    return "missing_link";
  }
  if (!containsAll(baseLinks, candidateLinks)) return "invented_link";

  if (!preservesRequiredSafetyPhrases(params.baseText, text)) {
    return "missing_safety_phrase";
  }
  if (!preservesFinancialAccountContext(params.baseText, text)) {
    return "invented_account_context";
  }
  if (!preservesCompletedOperationState(params.scenario, text)) {
    return "operation_state_changed";
  }

  const emojiCount = countEmoji(text);
  if (params.styleContract.emoji_mode === "forbidden" && emojiCount > 0) {
    return "emoji_not_allowed";
  }
  if (emojiCount > params.styleContract.max_emoji_count) {
    return "too_many_emojis";
  }
  if (
    emojiCount > 0 &&
    countAuthoredLines(text) > params.styleContract.max_lines_with_emoji
  ) {
    return "emoji_multiline";
  }
  if (params.styleContract.emoji_mode === "required" && emojiCount !== 1) {
    return "emoji_required";
  }
  if (
    params.styleContract.must_apply &&
    (params.output.style_adherence !== "applied" ||
      !params.styleContract.allowed_dimensions.every((dimension) =>
        params.output.applied_style_dimensions.includes(dimension),
      ) ||
      !params.styleContract.allowed_dimensions.every((dimension) =>
        params.output.style_evidence.some(
          (entry) =>
            entry.dimension === dimension && text.includes(entry.evidence),
        ),
      ))
  ) {
    return "style_not_applied";
  }

  return null;
}

function preservesFinancialAccountContext(
  baseText: string,
  candidateText: string,
): boolean {
  const base = normalizeForSafetyValidation(baseText);
  const candidate = normalizeForSafetyValidation(candidateText);
  const financialAccountPattern =
    /\b(?:cuenta de origen|cuenta de destino|cuenta elegida|cuenta principal|saldo de (?:la |tu )?cuenta|desde (?:la |tu |mi )?cuenta)\b/;

  return (
    !financialAccountPattern.test(candidate) ||
    financialAccountPattern.test(base)
  );
}

function preservesCompletedOperationState(
  scenario: ResponseScenario,
  candidateText: string,
): boolean {
  if (scenario !== "movement_created" && scenario !== "movements_created") {
    return true;
  }

  const text = normalizeForSafetyValidation(candidateText);
  const contradictsCompletedState = [
    /\bpara (?:poder )?(?:registrar|anotar|guardar|aplicar)\b/,
    /\b(?:me )?confirmas\b/,
    /\b(?:confirmar|confirmame|cuando (?:me )?confirmes|si (?:me )?confirmas)\b/,
    /\b(?:registraria|anotaria|guardaria|aplicaria|quedaria)\b/,
    /\bquieres que (?:lo )?(?:registre|anote|guarde|aplique)\b/,
  ].some((pattern) => pattern.test(text));
  if (contradictsCompletedState) return false;

  return /\b(?:listo|registre|registrad[oa]s?|anote|anotad[oa]s?|guarde|guardad[oa]s?|aplique|aplicad[oa]s?)\b/.test(
    text,
  );
}

function isRetryableStyleRejection(
  reason: Extract<
    ResponseAgentEnhancementTrace,
    { status: "rejected" }
  >["reason"],
): boolean {
  return (
    reason === "style_not_applied" ||
    reason === "emoji_not_allowed" ||
    reason === "emoji_required" ||
    reason === "too_many_emojis" ||
    reason === "emoji_multiline"
  );
}

function styleTrace(
  contract: ResponseStyleContract,
  output: ResponseAgentOutput | null,
  attemptCount: number,
) {
  return {
    style_active: contract.active,
    style_scope: contract.scope,
    style_adherence: output?.style_adherence ?? null,
    style_blocked_reasons: contract.blocked_reasons,
    attempt_count: attemptCount,
  };
}

function containsAll(values: string[], expected: string[]): boolean {
  return expected.every((token) => values.includes(token));
}

function extractMoneyTokens(text: string): string[] {
  return unique(text.match(/(?:S\/|\$)\d+(?:\.\d{2})?/g) ?? []);
}

function extractPendingCodes(text: string): string[] {
  return unique(text.match(/P-[A-Z0-9]{8}/g) ?? []);
}

function extractLinks(text: string): string[] {
  return unique(text.match(/https?:\/\/\S+/g) ?? []);
}

function extractCount(text: string, word: "movimiento" | "pendiente"): number | null {
  const pattern = new RegExp(`\\b(\\d+)\\s+${word}s?\\b`, "i");
  const match = text.match(pattern);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function preservesRequiredSafetyPhrases(
  baseText: string,
  candidateText: string
): boolean {
  const base = normalizeForSafetyValidation(baseText);
  const candidate = normalizeForSafetyValidation(candidateText);

  if (mentionsNoBalanceImpact(base) && !mentionsNoBalanceImpact(candidate)) {
    return false;
  }

  if (base.includes("hasta que confirmes") && !candidate.includes("confirm")) {
    return false;
  }

  if (base.includes("no cambie nada") && !candidate.includes("no cambi")) {
    return false;
  }

  if (base.includes("no pude aplicar") && !candidate.includes("no pude aplicar")) {
    return false;
  }

  return true;
}

function mentionsNoBalanceImpact(text: string): boolean {
  return (
    /\bno toca(?:ba|n)? tu saldo\b/.test(text) ||
    /\bno toca(?:ba|n)? tus saldos\b/.test(text)
  );
}

function normalizeForSafetyValidation(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function inferRiskLevel(
  riskNotes: string[]
): "low" | "medium" | "high" | "sensitive" | null {
  if (riskNotes.some((note) => note.includes("sensible"))) return "sensitive";
  if (riskNotes.some((note) => note.includes("accion financiera"))) return "high";
  if (riskNotes.length > 0) return "low";
  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
