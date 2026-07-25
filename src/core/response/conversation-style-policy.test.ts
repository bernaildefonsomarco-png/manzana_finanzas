import { describe, expect, it } from "vitest";
import type {
  ConversationStyleProfile,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import {
  buildResponseStyleContract,
  countAuthoredLines,
  countEmoji,
} from "./conversation-style-policy";

describe("conversation style policy", () => {
  it("convierte cualquier instruccion explicita en un contrato aplicable", () => {
    const contract = buildResponseStyleContract({
      style: profile({
        instruction:
          "Explica con analogias de arquitectura, con calidez y sin rodeos.",
        warmth: "warm",
        directness: "direct",
        scope: "persistent",
      }),
      scenario: "conversation_answer",
      turnState: turnState(),
      discreetMode: false,
      riskLevel: "low",
      baseText: "Hoy gastaste S/20.00.",
    });

    expect(contract).toMatchObject({
      active: true,
      scope: "persistent",
      attempt: 1,
      retry_feedback: null,
      requested_dimensions: ["free_instruction", "warmth", "directness"],
      allowed_dimensions: ["free_instruction", "warmth", "directness"],
      blocked_dimensions: [],
      must_apply: true,
    });
  });

  it("exige un solo emoji solo cuando el contexto es seguro y breve", () => {
    const contract = buildResponseStyleContract({
      style: profile({ emoji_policy: "limited" }),
      scenario: "movement_created",
      turnState: turnState(),
      discreetMode: false,
      riskLevel: "low",
      baseText: "Listo. Cafe por S/8.00 registrado.",
    });

    expect(contract.emoji_mode).toBe("required");
    expect(countEmoji("Cafe listo ☕")).toBe(1);
    expect(countAuthoredLines("Uno\n\nDos")).toBe(2);
  });

  it("conserva dimensiones seguras y bloquea expresividad en escenarios sensibles", () => {
    const contract = buildResponseStyleContract({
      style: profile({
        playfulness: "playful",
        directness: "direct",
        emoji_policy: "limited",
      }),
      scenario: "correction_needs_confirmation",
      turnState: turnState(),
      discreetMode: false,
      riskLevel: "medium",
      baseText: "Creo que te refieres al ultimo gasto. ¿Lo elimino?",
    });

    expect(contract.allowed_dimensions).toEqual([
      "free_instruction",
      "directness",
    ]);
    expect(contract.blocked_dimensions).toEqual([
      "playfulness",
      "emoji_policy",
    ]);
    expect(contract.emoji_mode).toBe("forbidden");
  });
});

function profile(
  overrides: Partial<ConversationStyleProfile> = {},
): ConversationStyleProfile {
  return {
    instruction: "Responde con un estilo personalizado.",
    response_length: "inherit",
    formality: "inherit",
    warmth: "inherit",
    playfulness: "inherit",
    directness: "inherit",
    emoji_policy: "inherit",
    scope: "session",
    source: "explicit_user_request",
    updated_at: "2026-07-21T01:00:00.000-05:00",
    ...overrides,
  };
}

function turnState(): ConversationTurnState {
  return {
    act: "financial_question",
    continuity: "follow_up",
    emotional_state: "neutral",
    experience_mode: "deep_analysis",
    should_use_active_memory: true,
    should_route_to_conversation_agent: true,
    should_ask_clarification_first: false,
    response_guidance: [],
    personalization_cues: [],
    risk_notes: [],
  };
}
