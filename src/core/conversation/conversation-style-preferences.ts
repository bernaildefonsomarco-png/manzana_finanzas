import {
  ConversationStyleProfileSchema,
  type ConversationStyleProfile,
} from "@/agents/conversation-agent";

const METADATA_KEY = "conversation_style";

export function readPersistentConversationStyle(input: {
  metadata: unknown;
  legacyToneStyle?: string | null;
  now?: string;
}): ConversationStyleProfile | null {
  const metadata = asRecord(input.metadata);
  const parsed = ConversationStyleProfileSchema.safeParse(metadata[METADATA_KEY]);
  if (parsed.success && parsed.data.scope === "persistent") {
    return parsed.data;
  }

  const legacyInstruction = cleanString(input.legacyToneStyle);
  if (!legacyInstruction) return null;

  return ConversationStyleProfileSchema.parse({
    instruction: legacyInstruction,
    response_length: "inherit",
    formality: "inherit",
    warmth: "inherit",
    playfulness: "inherit",
    directness: "inherit",
    emoji_policy: "inherit",
    scope: "persistent",
    source: "explicit_user_request",
    updated_at: input.now ?? new Date().toISOString(),
  });
}

export function writePersistentConversationStyle(input: {
  metadata: unknown;
  style: ConversationStyleProfile | null;
}): Record<string, unknown> {
  const metadata = { ...asRecord(input.metadata) };
  if (!input.style) {
    delete metadata[METADATA_KEY];
    return metadata;
  }

  if (input.style.scope !== "persistent") return metadata;
  metadata[METADATA_KEY] = input.style;
  return metadata;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function cleanString(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
