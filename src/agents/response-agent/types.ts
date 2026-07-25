import { z } from "zod";
import type {
  ConversationContinuity,
  ConversationEmotionalState,
  ConversationExperienceMode,
  ConversationStyleProfile,
} from "@/agents/conversation-agent";

export const ResponseScenarioSchema = z.enum([
  "movement_created",
  "movements_created",
  "pending_created",
  "pending_confirmed",
  "pending_discarded",
  "pending_listed",
  "pending_resolution_needs_clarification",
  "capture_draft_discarded",
  "capture_draft_needs_clarification",
  "correction_applied",
  "correction_cancelled",
  "correction_needs_confirmation",
  "correction_needs_selection",
  "correction_needs_clarification",
  "blocked_financial_action",
  "conversation_greeting",
  "conversation_help",
  "conversation_thanks",
  "conversation_answer",
  "local_auto_ack",
]);
export type ResponseScenario = z.infer<typeof ResponseScenarioSchema>;

export const ResponseStyleDimensionSchema = z.enum([
  "free_instruction",
  "response_length",
  "formality",
  "warmth",
  "playfulness",
  "directness",
  "emoji_policy",
]);
export type ResponseStyleDimension = z.infer<
  typeof ResponseStyleDimensionSchema
>;

export const ResponseStyleAdherenceSchema = z.enum([
  "applied",
  "not_applicable",
  "blocked_for_safety",
]);
export type ResponseStyleAdherence = z.infer<
  typeof ResponseStyleAdherenceSchema
>;

export const ResponseEmojiModeSchema = z.enum([
  "forbidden",
  "optional",
  "required",
]);
export type ResponseEmojiMode = z.infer<typeof ResponseEmojiModeSchema>;

export const ResponseAgentOutputSchema = z.object({
  response_text: z.string().trim().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  preserved_facts: z.array(z.string()),
  safety_flags: z.array(z.string()),
  style_notes: z.array(z.string()),
  style_adherence: ResponseStyleAdherenceSchema,
  applied_style_dimensions: z.array(ResponseStyleDimensionSchema),
  style_evidence: z.array(
    z.object({
      dimension: ResponseStyleDimensionSchema,
      evidence: z.string().trim().min(1).max(160),
    }),
  ),
  style_exceptions: z.array(z.string()),
});
export type ResponseAgentOutput = z.infer<typeof ResponseAgentOutputSchema>;

export type ResponseStyleContract = {
  active: boolean;
  instruction: string | null;
  scope: ConversationStyleProfile["scope"] | null;
  attempt: 1 | 2;
  retry_feedback: string | null;
  requested_dimensions: ResponseStyleDimension[];
  allowed_dimensions: ResponseStyleDimension[];
  blocked_dimensions: ResponseStyleDimension[];
  blocked_reasons: string[];
  must_apply: boolean;
  emoji_mode: ResponseEmojiMode;
  max_emoji_count: 1;
  max_lines_with_emoji: 2;
};

export type ResponseContextPack = {
  context_pack_type: "response_context";
  version: "v2";
  user_id: string;
  locale: "es-PE";
  timezone: string;
  channel: "whatsapp";
  scenario: ResponseScenario;
  base_text: string;
  original_user_text: string;
  constraints: {
    max_chars: number;
    preserve_amounts: boolean;
    preserve_pending_codes: boolean;
    preserve_links: boolean;
    no_emoji: boolean;
    discreet_mode: boolean;
  };
  style_contract: ResponseStyleContract;
  facts: {
    amounts: string[];
    pending_codes: string[];
    links: string[];
    movement_count: number | null;
    pending_count: number | null;
    risk_level: "low" | "medium" | "high" | "sensitive" | null;
  };
  experience: {
    emotional_state: ConversationEmotionalState;
    continuity: ConversationContinuity;
    experience_mode: ConversationExperienceMode;
    response_guidance: string[];
    personalization_cues: string[];
    preferred_tone: string | null;
    conversation_style: ConversationStyleProfile | null;
    last_result_summary: string | null;
    working_goal:
      | "capture"
      | "query"
      | "correct"
      | "confirm"
      | "review"
      | "help"
      | null;
    avoid_repetition: boolean;
  };
};
