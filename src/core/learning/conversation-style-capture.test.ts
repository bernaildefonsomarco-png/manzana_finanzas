import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationStyleProfile } from "@/agents/conversation-agent";
import { captureExplicitConversationStyle } from "./conversation-style-capture";
import { LearningEngine } from "./learning-engine";
import {
  getLearningPreferences,
  listFinancialMemory,
  manageFinancialMemory,
} from "@/data/repositories/financial-memory.repository";

vi.mock("@/data/repositories/financial-memory.repository", () => ({
  getLearningPreferences: vi.fn(),
  listFinancialMemory: vi.fn(),
  manageFinancialMemory: vi.fn(),
}));

vi.mock("./learning-engine", () => ({
  LearningEngine: vi.fn(),
}));

const mockedPreferences = vi.mocked(getLearningPreferences);
const mockedList = vi.mocked(listFinancialMemory);
const mockedManage = vi.mocked(manageFinancialMemory);
const mockedEngine = vi.mocked(LearningEngine);

const learnExplicitPreference = vi.fn();

/**
 * `user_preferences` es la unica tabla que toca el modulo directamente; el
 * resto pasa por repositorios ya mockeados.
 */
function clientStub() {
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  return {
    client: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { metadata: {} },
              error: null,
            }),
          }),
        }),
        update,
      }),
    } as never,
    update,
  };
}

function style(
  overrides: Partial<ConversationStyleProfile> = {},
): ConversationStyleProfile {
  return {
    instruction: "Responder con tono chistoso y usando emojis",
    response_length: "inherit",
    formality: "casual",
    warmth: "warm",
    playfulness: "playful",
    directness: "inherit",
    emoji_policy: "limited",
    scope: "persistent",
    source: "explicit_user_request",
    updated_at: "2026-08-07T12:00:00.000Z",
    ...overrides,
  };
}

function captureInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    styleUpdate: style(),
    resetStyle: false,
    evidenceRef: "event-1",
    observedAt: "2026-08-07T12:00:00.000Z",
    traceId: "trace-1",
    confidence: 0.95,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  learnExplicitPreference.mockReset();
  // Debe ser `function`: una arrow no sirve como constructor para `new`.
  mockedEngine.mockImplementation(function () {
    return { learnExplicitPreference } as never;
  } as never);
  mockedPreferences.mockResolvedValue({ enabled: true } as never);
  mockedList.mockResolvedValue([]);
  mockedManage.mockResolvedValue({} as never);
});

describe("Captura de preferencias de conversacion declaradas", () => {
  it("recuerda una preferencia que el usuario pidio para siempre", async () => {
    learnExplicitPreference.mockResolvedValue([
      { promoted_to_memory: true, memory_id: "mem-1" },
    ]);
    const { client, update } = clientStub();

    const result = await captureExplicitConversationStyle({
      client,
      ...captureInput(),
    } as never);

    expect(result).toEqual({
      captured: true,
      reason: "captured",
      memory_id: "mem-1",
    });
    expect(learnExplicitPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        canonicalKey: "preference:conversation_style:event-1",
        confidence: 0.95,
      }),
    );
    // El estilo vigente tambien queda espejado para los adaptadores de canal.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        tone_style: expect.stringContaining("tono chistoso"),
      }),
    );
  });

  it("no recuerda una frase acotada al turno ni una lectura dudosa", async () => {
    const { client } = clientStub();

    // "Hoy respondeme corto": el ejecutivo lo marca scope=turn.
    const acotada = await captureExplicitConversationStyle({
      client,
      ...captureInput({ styleUpdate: style({ scope: "turn" }) }),
    } as never);
    expect(acotada.reason).toBe("style_not_persistent");

    // Un ajuste de esta charla tampoco se vuelve permanente.
    const sesion = await captureExplicitConversationStyle({
      client,
      ...captureInput({ styleUpdate: style({ scope: "session" }) }),
    } as never);
    expect(sesion.reason).toBe("style_not_persistent");

    // Persistente pero con el turno mal entendido: queda por debajo del umbral.
    const dudosa = await captureExplicitConversationStyle({
      client,
      ...captureInput({ confidence: 0.6 }),
    } as never);
    expect(dudosa.reason).toBe("confidence_below_threshold");

    expect(learnExplicitPreference).not.toHaveBeenCalled();
  });

  it("no captura nada si el usuario apago el aprendizaje", async () => {
    mockedPreferences.mockResolvedValue({ enabled: false } as never);
    const { client, update } = clientStub();

    const result = await captureExplicitConversationStyle({
      client,
      ...captureInput(),
    } as never);

    expect(result.reason).toBe("learning_disabled_by_user");
    expect(result.captured).toBe(false);
    expect(learnExplicitPreference).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("un fallo de captura no rompe el turno", async () => {
    mockedPreferences.mockRejectedValue(new Error("supabase caido"));
    const { client } = clientStub();

    const result = await captureExplicitConversationStyle({
      client,
      ...captureInput(),
    } as never);

    expect(result).toEqual({
      captured: false,
      reason: "capture_failed",
      memory_id: null,
    });
  });

  it("no toca el estilo vigente cuando el gate no promueve el candidato", async () => {
    // Caso sensible: el gate lo manda a `pending_confirmation`.
    learnExplicitPreference.mockResolvedValue([
      { promoted_to_memory: false, memory_id: null },
    ]);
    const { client, update } = clientStub();

    const result = await captureExplicitConversationStyle({
      client,
      ...captureInput(),
    } as never);

    expect(result.reason).toBe("learning_not_promoted");
    expect(update).not.toHaveBeenCalled();
    expect(mockedManage).not.toHaveBeenCalled();
  });

  it("reemplaza la preferencia anterior en vez de acumularla", async () => {
    mockedList.mockResolvedValue([
      { id: "mem-old", canonical_key: "preference:conversation_style:event-0" },
    ] as never);
    learnExplicitPreference.mockResolvedValue([
      { promoted_to_memory: true, memory_id: "mem-1" },
    ]);
    const { client } = clientStub();

    await captureExplicitConversationStyle({
      client,
      ...captureInput(),
    } as never);

    expect(mockedManage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        memoryId: "mem-old",
        action: "forget",
        reason: "superseded_by_explicit_conversation_style",
      }),
    );
  });
});
