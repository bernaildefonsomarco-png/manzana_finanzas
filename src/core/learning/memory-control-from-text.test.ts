import { describe, expect, it, vi } from "vitest";
import {
  handleMemoryControlFromText,
  parseMemoryControlFromText,
} from "./memory-control-from-text";
import {
  getLearningPreferences,
  listFinancialMemory,
  manageFinancialMemory,
  setLearningPreferences,
} from "@/data/repositories/financial-memory.repository";

vi.mock("@/data/repositories/financial-memory.repository", () => ({
  getLearningPreferences: vi.fn(),
  listFinancialMemory: vi.fn(),
  manageFinancialMemory: vi.fn(),
  setLearningPreferences: vi.fn(),
}));

const mockedList = vi.mocked(listFinancialMemory);
const mockedManage = vi.mocked(manageFinancialMemory);
const mockedPreferences = vi.mocked(getLearningPreferences);
const mockedSetPreferences = vi.mocked(setLearningPreferences);

describe("Memory control from text", () => {
  it("no confunde un olvida generico con una orden de memoria", () => {
    expect(parseMemoryControlFromText("Olvídalo, elimínalo")).toBeNull();
    expect(parseMemoryControlFromText("¿Qué recuerdas de mí?")).toEqual({
      action: "list",
    });
  });

  it("lista memoria sensible sin exponer el contenido", async () => {
    mockedList.mockResolvedValue([
      memory({ sensitivity: "sensitive", summary: "Deuda personal con Luis" }),
    ]);
    const result = await handleMemoryControlFromText({
      client: {} as never,
      userId: "user-1",
      text: "Qué recuerdas de mí",
      traceId: "trace-1",
    });
    expect(result.response_text).toContain("Contexto sensible");
    expect(result.response_text).not.toContain("Luis");
  });

  it("olvida por codigo mediante el servicio gobernado", async () => {
    mockedList.mockResolvedValue([memory()]);
    mockedManage.mockResolvedValue({} as never);
    const result = await handleMemoryControlFromText({
      client: {} as never,
      userId: "user-1",
      text: "Olvida M-22222222",
      traceId: "trace-2",
    });
    expect(result.action).toBe("forget");
    expect(mockedManage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "forget",
        memoryId: "22222222-2222-4222-8222-222222222222",
      }),
    );
  });

  it("desactiva aprendizaje conservando los permisos granulares", async () => {
    mockedPreferences.mockResolvedValue({
      enabled: true,
      allow_narrative_memory: false,
      allow_sensitive_memory: true,
    } as never);
    mockedSetPreferences.mockResolvedValue({} as never);
    await handleMemoryControlFromText({
      client: {} as never,
      userId: "user-1",
      text: "Deja de aprender de mí",
      traceId: "trace-3",
    });
    expect(mockedSetPreferences).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        enabled: false,
        allowNarrativeMemory: false,
        allowSensitiveMemory: true,
      }),
    );
  });
});

function memory(
  patch: Partial<Awaited<ReturnType<typeof listFinancialMemory>>[number]> = {},
) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "user-1",
    kind: "preference" as const,
    canonical_key: "preference:conversation_style",
    summary: "Prefiero respuestas breves",
    search_terms: ["respuestas", "breves"],
    evidence_source: "explicit_user_statement",
    evidence_ref: "turn-1",
    confidence: 1,
    confirmation_status: "confirmed" as const,
    lifecycle_status: "confirmed" as const,
    sensitivity: "normal" as const,
    valid_until: null,
    superseded_at: null,
    positive_evidence_refs: ["turn-1"],
    negative_evidence_refs: [],
    positive_evidence_count: 1,
    negative_evidence_count: 0,
    explanation: "Confirmado por el usuario.",
    review_at: null,
    last_used_at: null,
    suspended_at: null,
    revoked_at: null,
    revoked_reason: null,
    sensitive_confirmed_at: null,
    source_candidate_id: "candidate-1",
    supersedes_memory_id: null,
    created_at: "2026-07-24T10:00:00.000Z",
    updated_at: "2026-07-24T10:00:00.000Z",
    metadata: {},
    ...patch,
  };
}
