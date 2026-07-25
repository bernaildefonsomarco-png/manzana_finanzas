import type {
  ConversationStyleProfile,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import type {
  ResponseScenario,
  ResponseStyleContract,
  ResponseStyleDimension,
} from "@/agents/response-agent";

const EXPRESSIVE_DIMENSIONS: ResponseStyleDimension[] = [
  "free_instruction",
  "playfulness",
  "emoji_policy",
];

const NO_EMOJI_SCENARIOS = new Set<ResponseScenario>([
  "pending_resolution_needs_clarification",
  "capture_draft_needs_clarification",
  "correction_applied",
  "correction_cancelled",
  "correction_needs_confirmation",
  "correction_needs_selection",
  "correction_needs_clarification",
  "blocked_financial_action",
]);

export function buildResponseStyleContract(input: {
  style: ConversationStyleProfile | null;
  legacyInstruction?: string | null;
  scenario: ResponseScenario;
  turnState: ConversationTurnState;
  discreetMode: boolean;
  riskLevel: "low" | "medium" | "high" | "sensitive" | null;
  baseText: string;
}): ResponseStyleContract {
  const instruction =
    input.style?.instruction ?? cleanString(input.legacyInstruction);
  const requestedDimensions = requestedStyleDimensions(input.style, instruction);
  const blockedReasons = styleBlockingReasons(input);
  const blockedDimensions = blockedStyleDimensions({
    requestedDimensions,
    blockedReasons,
  });
  const allowedDimensions = requestedDimensions.filter(
    (dimension) => !blockedDimensions.includes(dimension),
  );
  const emojiMode = resolveEmojiMode({
    style: input.style,
    blockedReasons,
    baseText: input.baseText,
  });

  return {
    active: Boolean(instruction),
    instruction,
    scope: input.style?.scope ?? (instruction ? "persistent" : null),
    attempt: 1,
    retry_feedback: null,
    requested_dimensions: requestedDimensions,
    allowed_dimensions: allowedDimensions,
    blocked_dimensions: blockedDimensions,
    blocked_reasons: blockedReasons,
    must_apply: Boolean(instruction) && allowedDimensions.length > 0,
    emoji_mode: emojiMode,
    max_emoji_count: 1,
    max_lines_with_emoji: 2,
  };
}

export function countEmoji(text: string): number {
  return Array.from(text.matchAll(/\p{Extended_Pictographic}/gu)).length;
}

export function countAuthoredLines(text: string): number {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function requestedStyleDimensions(
  style: ConversationStyleProfile | null,
  instruction: string | null,
): ResponseStyleDimension[] {
  if (!instruction) return [];

  const dimensions: ResponseStyleDimension[] = ["free_instruction"];
  if (!style) return dimensions;
  if (style.response_length !== "inherit") dimensions.push("response_length");
  if (style.formality !== "inherit") dimensions.push("formality");
  if (style.warmth !== "inherit") dimensions.push("warmth");
  if (style.playfulness !== "inherit") dimensions.push("playfulness");
  if (style.directness !== "inherit") dimensions.push("directness");
  if (style.emoji_policy !== "inherit") dimensions.push("emoji_policy");
  return dimensions;
}

function styleBlockingReasons(input: {
  scenario: ResponseScenario;
  turnState: ConversationTurnState;
  discreetMode: boolean;
  riskLevel: "low" | "medium" | "high" | "sensitive" | null;
}): string[] {
  const reasons: string[] = [];
  if (input.discreetMode) reasons.push("discreet_mode");
  if (input.riskLevel === "high" || input.riskLevel === "sensitive") {
    reasons.push(`risk_${input.riskLevel}`);
  }
  if (input.turnState.emotional_state === "frustrated") {
    reasons.push("user_frustration");
  }
  if (NO_EMOJI_SCENARIOS.has(input.scenario)) {
    reasons.push("sensitive_response_scenario");
  }
  return reasons;
}

function blockedStyleDimensions(input: {
  requestedDimensions: ResponseStyleDimension[];
  blockedReasons: string[];
}): ResponseStyleDimension[] {
  if (input.blockedReasons.length === 0) return [];

  const requestedExpressive = input.requestedDimensions.filter((dimension) =>
    EXPRESSIVE_DIMENSIONS.includes(dimension),
  );
  const requestedSafe = input.requestedDimensions.filter(
    (dimension) => !EXPRESSIVE_DIMENSIONS.includes(dimension),
  );

  return requestedSafe.length === 0
    ? requestedExpressive
    : requestedExpressive.filter((dimension) => dimension !== "free_instruction");
}

function resolveEmojiMode(input: {
  style: ConversationStyleProfile | null;
  blockedReasons: string[];
  baseText: string;
}): ResponseStyleContract["emoji_mode"] {
  if (
    input.blockedReasons.length > 0 ||
    !input.style ||
    input.style.emoji_policy !== "limited"
  ) {
    return "forbidden";
  }

  return countAuthoredLines(input.baseText) <= 2 ? "required" : "optional";
}

function cleanString(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
