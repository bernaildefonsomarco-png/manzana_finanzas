import { describe, expect, it } from "vitest";
import type { ConversationStyleProfile } from "@/agents/conversation-agent";
import {
  readPersistentConversationStyle,
  writePersistentConversationStyle,
} from "./conversation-style-preferences";

describe("persistent conversation style", () => {
  it("preserva la instruccion libre y todas sus dimensiones", () => {
    const persistent = style({
      instruction:
        "Usa analogias de cocina, respuestas cortas y un tono formal pero calido.",
      response_length: "shorter",
      formality: "formal",
      warmth: "warm",
      directness: "direct",
      scope: "persistent",
    });
    const metadata = writePersistentConversationStyle({
      metadata: { source: "existing" },
      style: persistent,
    });

    expect(readPersistentConversationStyle({ metadata })).toEqual(persistent);
    expect(metadata.source).toBe("existing");
  });

  it("no persiste estilos limitados al turno o a la sesion", () => {
    expect(
      writePersistentConversationStyle({
        metadata: { keep_me: true },
        style: style({ scope: "session" }),
      }),
    ).toEqual({ keep_me: true });
  });

  it("elimina solo la preferencia de estilo al restablecerla", () => {
    const metadata = writePersistentConversationStyle({
      metadata: {
        conversation_style: style({ scope: "persistent" }),
        keep_me: true,
      },
      style: null,
    });

    expect(metadata).toEqual({ keep_me: true });
  });

  it("migra una preferencia historica de tono sin perder compatibilidad", () => {
    const parsed = readPersistentConversationStyle({
      metadata: null,
      legacyToneStyle: "Breve y directo",
      now: "2026-07-21T01:00:00.000-05:00",
    });

    expect(parsed).toMatchObject({
      instruction: "Breve y directo",
      scope: "persistent",
      source: "explicit_user_request",
    });
  });
});

function style(
  overrides: Partial<ConversationStyleProfile> = {},
): ConversationStyleProfile {
  return {
    instruction: "Responde de forma natural y cercana.",
    response_length: "inherit",
    formality: "inherit",
    warmth: "inherit",
    playfulness: "inherit",
    directness: "inherit",
    emoji_policy: "inherit",
    scope: "persistent",
    source: "explicit_user_request",
    updated_at: "2026-07-21T01:00:00.000-05:00",
    ...overrides,
  };
}
